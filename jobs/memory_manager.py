import logging
import os
import threading
import time
from typing import Any

import psutil
from celery import current_app
from django.conf import settings
from django.utils import timezone
from rest_framework.authtoken.models import Token

from .io import update_job_status
from .models import Job

logger = logging.getLogger(__name__)


class MemoryManager:
    """Global memory manager for monitoring and managing job memory usage."""

    def __init__(self):
        self._memory_monitor_active = False
        self._memory_monitor_thread = None
        self._active_jobs: dict[int, dict[str, Any]] = {}
        self._memory_monitor_lock = threading.Lock()

    def get_memory_usage(self) -> dict[str, float]:
        """Get current memory usage statistics.

        Returns:
            dict: Memory usage statistics in MB
        """
        memory_info = psutil.virtual_memory()
        return {
            "rss_mb": memory_info.used / 1024 / 1024,  # Resident Set Size
            "vms_mb": memory_info.total / 1024 / 1024,  # Virtual Memory Size
            "percent": memory_info.percent,
        }

    def get_process_memory_usage(self) -> dict[int, float]:
        """Get memory usage for all Python processes.

        Returns:
            dict: Mapping of process ID to memory usage in MB
        """
        process_memory = {}

        for proc in psutil.process_iter(["pid", "memory_info", "cmdline"]):
            try:
                # Only consider Python processes that are likely our workers
                if proc.info["cmdline"] and any(
                    "celery" in cmd.lower() or "python" in cmd.lower()
                    for cmd in proc.info["cmdline"]
                ):
                    memory_mb = proc.info["memory_info"].rss / 1024 / 1024
                    process_memory[proc.info["pid"]] = memory_mb
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        return process_memory

    def log_memory_usage(self, stage: str, job_id: int) -> None:
        """Log memory usage at a specific stage.

        Args:
            stage: Description of the current processing stage
            job_id: Job ID for logging context
        """
        memory_stats = self.get_memory_usage()
        logger.info(
            f"Job {job_id} memory usage at {stage}: "
            f"RSS: {memory_stats['rss_mb']:.1f}MB, "
            f"VMS: {memory_stats['vms_mb']:.1f}MB, "
            f"Percent: {memory_stats['percent']:.1f}%"
        )

    def _terminate_celery_task(self, task_id: str, job_id: int) -> bool:
        """Terminate a Celery task by revoking it.

        Args:
            task_id: The Celery task ID to terminate
            job_id: The job ID for logging context

        Returns:
            bool: True if task was successfully revoked, False otherwise
        """
        try:
            logger.info(f"Job {job_id}: Attempting to terminate Celery task {task_id}")

            # First, try to revoke the task gracefully
            current_app.control.revoke(task_id, terminate=True, signal="SIGTERM")

            # Wait a moment for graceful termination
            time.sleep(1.0)

            # Check if the task is still running by inspecting active tasks
            try:
                inspect = current_app.control.inspect()
                active_tasks = inspect.active()

                if active_tasks:
                    for worker_name, tasks in active_tasks.items():
                        for task in tasks:
                            if task.get("id") == task_id:
                                logger.warning(
                                    f"Job {job_id}: Task {task_id} still running after SIGTERM, forcing termination"
                                )
                                # Force terminate with SIGKILL
                                current_app.control.revoke(
                                    task_id, terminate=True, signal="SIGKILL"
                                )
                                break
                        else:
                            continue
                        break
                    else:
                        logger.info(
                            f"Job {job_id}: Task {task_id} successfully terminated"
                        )
                else:
                    logger.info(
                        f"Job {job_id}: No active tasks found, assuming task {task_id} terminated"
                    )

            except Exception as inspect_error:
                logger.warning(
                    f"Job {job_id}: Could not inspect active tasks: {inspect_error}"
                )
                # Assume termination was successful if we can't inspect

            logger.info(f"Job {job_id}: Successfully revoked Celery task {task_id}")
            return True

        except Exception as e:
            logger.error(f"Job {job_id}: Failed to revoke Celery task {task_id}: {e}")
            return False

    def _memory_monitor_worker(
        self, memory_threshold: float = 95.0, check_interval: float = 5.0
    ):
        """Background thread to monitor memory usage during task execution.

        Args:
            memory_threshold: Memory usage percentage threshold (default 95%)
            check_interval: How often to check memory usage in seconds (default 5s)
        """
        logger.info(
            f"Starting global memory monitor (threshold: {memory_threshold}%, interval: {check_interval}s)"
        )
        # Grace period to allow for job to be terminated
        grace_period_count = 0

        while self._memory_monitor_active:
            if grace_period_count > 0:
                logger.info("In grace period to allow for job to be terminated...")
                grace_period_count -= 1
                time.sleep(check_interval)
                continue

            try:
                memory_stats = self.get_memory_usage()
                memory_percent = memory_stats["percent"]

                if memory_percent > memory_threshold:
                    logger.error(
                        f"CRITICAL MEMORY USAGE - {memory_percent:.1f}% exceeds threshold {memory_threshold}%"
                    )

                    # Find the job using the most memory
                    with self._memory_monitor_lock:
                        if not self._active_jobs:
                            logger.warning("No active jobs found during memory crisis")
                            time.sleep(check_interval)
                            continue

                        # Get current process memory usage
                        process_memory = self.get_process_memory_usage()
                        current_pid = os.getpid()
                        current_memory = process_memory.get(current_pid, 0)

                        # Find the job with the highest estimated memory usage
                        heaviest_job_id = max(
                            self._active_jobs.keys(),
                            key=lambda job_id: self._active_jobs[job_id].get(
                                "estimated_memory_mb", 0
                            ),
                        )
                        heaviest_job_info = self._active_jobs[heaviest_job_id]

                        logger.error(
                            f"Terminating heaviest job {heaviest_job_id} "
                            f"(estimated: {heaviest_job_info.get('estimated_memory_mb', 0):.1f}MB, "
                            f"current process: {current_memory:.1f}MB)"
                        )

                    # Actually terminate the Celery task
                    task_id = heaviest_job_info.get("task_id")
                    if task_id:
                        task_terminated = self._terminate_celery_task(
                            task_id, heaviest_job_id
                        )
                        if task_terminated:
                            grace_period_count = 2
                        else:
                            logger.error(
                                f"Job {heaviest_job_id}: Failed to terminate Celery task, falling back to status update only"
                            )
                    else:
                        logger.warning(
                            f"Job {heaviest_job_id}: No task_id found, cannot terminate Celery task"
                        )

                    # Mark the job as failed due to memory pressure
                    try:
                        # Get or create a token for the job owner
                        job = Job.objects.get(id=heaviest_job_id)
                        token, _ = Token.objects.get_or_create(user=job.owner)

                        update_job_status(
                            heaviest_job_id,
                            "failed",
                            token.key,
                            info={
                                "error": "Job terminated due to system memory pressure",
                            },
                        )
                        logger.error(
                            f"Job {heaviest_job_id}: Marked as failed due to memory pressure"
                        )

                        # Unregister the terminated job
                        self.unregister_job(heaviest_job_id)

                    except Exception as e:
                        logger.error(
                            f"Failed to update job {heaviest_job_id} status: {e}"
                        )

                elif memory_percent > 85.0:
                    logger.warning(
                        f"High memory usage detected - {memory_percent:.1f}% "
                        f"({len(self._active_jobs)} active jobs)"
                    )

                time.sleep(check_interval)

            except Exception as e:
                logger.error(f"Memory monitor error: {e}")
                time.sleep(check_interval)

    def start_global_memory_monitor(self, memory_threshold: float = 95.0) -> None:
        """Start the global memory monitor if it's not already running.

        Args:
            memory_threshold: Memory usage percentage threshold
        """
        with self._memory_monitor_lock:
            if not self._memory_monitor_active:
                self._memory_monitor_active = True
                self._memory_monitor_thread = threading.Thread(
                    target=self._memory_monitor_worker,
                    args=(memory_threshold,),
                    daemon=True,
                )
                self._memory_monitor_thread.start()
                logger.info("Global memory monitor started")

    def stop_global_memory_monitor(self) -> None:
        """Stop the global memory monitor if no jobs are active."""
        with self._memory_monitor_lock:
            if self._active_jobs:
                logger.info(
                    f"Memory monitor kept running for {len(self._active_jobs)} active jobs"
                )
                return

            if self._memory_monitor_active:
                self._memory_monitor_active = False
                if (
                    self._memory_monitor_thread
                    and self._memory_monitor_thread.is_alive()
                ):
                    self._memory_monitor_thread.join(timeout=2.0)
                    logger.info("Global memory monitor stopped")

    def register_job(
        self, job_id: int, estimated_memory_mb: float = 0, task_id: str | None = None
    ) -> None:
        """Register a job for memory monitoring.

        Args:
            job_id: The job ID to monitor
            estimated_memory_mb: Estimated memory usage for this job in MB
            task_id: The Celery task ID for this job (optional)
        """
        with self._memory_monitor_lock:
            self._active_jobs[job_id] = {
                "estimated_memory_mb": estimated_memory_mb,
                "registered_at": timezone.now().isoformat(),
                "task_id": task_id,
            }
            logger.info(
                f"Job {job_id} registered for memory monitoring "
                f"(estimated: {estimated_memory_mb:.1f}MB, task_id: {task_id}, {len(self._active_jobs)} total)"
            )

        # Start memory monitor if this is the first job
        if len(self._active_jobs) == 1:
            memory_threshold = getattr(settings, "MEMORY_SAFEGUARD_THRESHOLD", 95.0)
            self.start_global_memory_monitor(memory_threshold)

    def unregister_job(self, job_id: int) -> None:
        """Unregister a job from memory monitoring.

        Args:
            job_id: The job ID to unregister
        """
        with self._memory_monitor_lock:
            if job_id in self._active_jobs:
                del self._active_jobs[job_id]
                logger.info(
                    f"Job {job_id} unregistered from memory monitoring ({len(self._active_jobs)} remaining)"
                )

        # Stop memory monitor if no jobs are active
        if not self._active_jobs:
            self.stop_global_memory_monitor()

    def update_job_memory_estimate(
        self, job_id: int, estimated_memory_mb: float
    ) -> None:
        """Update the memory estimate for a registered job.

        Args:
            job_id: The job ID to update
            estimated_memory_mb: Updated estimated memory usage in MB
        """
        with self._memory_monitor_lock:
            if job_id in self._active_jobs:
                self._active_jobs[job_id]["estimated_memory_mb"] = estimated_memory_mb
                logger.info(
                    f"Job {job_id} memory estimate updated to {estimated_memory_mb:.1f}MB"
                )

    def update_job_task_id(self, job_id: int, task_id: str) -> None:
        """Update the task ID for a registered job.

        Args:
            job_id: The job ID to update
            task_id: The Celery task ID for this job
        """
        with self._memory_monitor_lock:
            if job_id in self._active_jobs:
                self._active_jobs[job_id]["task_id"] = task_id
                logger.info(f"Job {job_id} task ID updated to {task_id}")

    def terminate_job(self, job_id: int, reason: str = "manual_termination") -> bool:
        """Manually terminate a specific job.

        Args:
            job_id: The job ID to terminate
            reason: Reason for termination

        Returns:
            bool: True if job was successfully terminated, False otherwise
        """
        with self._memory_monitor_lock:
            if job_id not in self._active_jobs:
                logger.warning(f"Job {job_id} not found in active jobs")
                return False

            job_info = self._active_jobs[job_id]
            task_id = job_info.get("task_id")

        if task_id:
            logger.info(
                f"Manually terminating job {job_id} (task_id: {task_id}, reason: {reason})"
            )
            task_terminated = self._terminate_celery_task(task_id, job_id)
            if task_terminated:
                logger.info(f"Job {job_id}: Successfully terminated Celery task")
            else:
                logger.error(f"Job {job_id}: Failed to terminate Celery task")
        else:
            logger.warning(
                f"Job {job_id}: No task_id found, cannot terminate Celery task"
            )

        # Unregister the job regardless of whether task termination succeeded
        self.unregister_job(job_id)
        return True

    def get_active_jobs_count(self) -> int:
        """Get the number of currently active jobs.

        Returns:
            int: Number of active jobs
        """
        with self._memory_monitor_lock:
            return len(self._active_jobs)

    def get_active_jobs_info(self) -> dict[int, dict[str, Any]]:
        """Get information about all active jobs.

        Returns:
            dict: Copy of active jobs information
        """
        with self._memory_monitor_lock:
            return self._active_jobs.copy()


# Global instance of the memory manager
memory_manager = MemoryManager()
