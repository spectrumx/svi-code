import logging
import os
import shutil
import signal
import threading
import time
from collections.abc import Callable
from datetime import timedelta
from pathlib import Path
from typing import TypeVar

import psutil
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from celery.exceptions import TimeLimitExceeded
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import connection
from django.utils import timezone
from rest_framework.authtoken.models import Token
from spectrumx import Client as SDSClient
from spectrumx.errors import Result
from spectrumx.models.captures import CaptureType
from spectrumx.models.files import File

from spectrumx_visualization_platform.users.models import User

from .io import get_job_file
from .io import get_job_meta
from .io import post_results
from .io import update_job_status
from .models import Job
from .models import JobStatusUpdate
from .visualizations.spectrogram import make_spectrogram

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Global flag to track if memory monitoring is active
_memory_monitor_active = False
_memory_monitor_thread = None


def get_memory_usage() -> dict[str, float]:
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


def log_memory_usage(stage: str, job_id: int) -> None:
    """Log memory usage at a specific stage.

    Args:
        stage: Description of the current processing stage
        job_id: Job ID for logging context
    """
    memory_stats = get_memory_usage()
    logger.info(
        f"Job {job_id} memory usage at {stage}: "
        f"RSS: {memory_stats['rss_mb']:.1f}MB, "
        f"VMS: {memory_stats['vms_mb']:.1f}MB, "
        f"Percent: {memory_stats['percent']:.1f}%"
    )


def memory_monitor_worker(
    job_id: int, token: str, memory_threshold: float = 95.0, check_interval: float = 5.0
):
    """Background thread to monitor memory usage during task execution.

    Args:
        job_id: The job ID being monitored
        token: Authentication token for status updates
        memory_threshold: Memory usage percentage threshold (default 95%)
        check_interval: How often to check memory usage in seconds (default 5s)
    """
    global _memory_monitor_active

    logger.info(
        f"Starting memory monitor for job {job_id} (threshold: {memory_threshold}%, interval: {check_interval}s)"
    )

    while _memory_monitor_active:
        try:
            memory_stats = get_memory_usage()
            memory_percent = memory_stats["percent"]

            if memory_percent > memory_threshold:
                logger.error(
                    f"Job {job_id}: CRITICAL MEMORY USAGE - {memory_percent:.1f}% exceeds threshold {memory_threshold}%"
                )

                # Update job status with memory error
                update_job_status(
                    job_id,
                    "failed",
                    token,
                    info={
                        "error": "Memory usage exceeded safety threshold",
                        "memory_percent": memory_percent,
                        "threshold": memory_threshold,
                        "timestamp": timezone.now().isoformat(),
                    },
                    retry=False,
                )

                # Force exit the process to prevent system crash
                logger.critical(
                    f"Job {job_id}: Forcing process termination due to memory usage"
                )
                os._exit(1)  # Force exit without cleanup

            elif memory_percent > 85.0:
                logger.warning(
                    f"Job {job_id}: High memory usage detected - {memory_percent:.1f}%"
                )

            time.sleep(check_interval)

        except Exception as e:
            logger.error(f"Memory monitor error for job {job_id}: {e}")
            time.sleep(check_interval)


def start_memory_monitor(
    job_id: int, token: str, memory_threshold: float = 95.0
) -> None:
    """Start memory monitoring for a job.

    Args:
        job_id: The job ID to monitor
        token: Authentication token for status updates
        memory_threshold: Memory usage percentage threshold
    """
    global _memory_monitor_active, _memory_monitor_thread

    _memory_monitor_active = True
    _memory_monitor_thread = threading.Thread(
        target=memory_monitor_worker,
        args=(job_id, token, memory_threshold),
        daemon=True,
    )
    _memory_monitor_thread.start()
    logger.info(f"Memory monitor started for job {job_id}")


def stop_memory_monitor() -> None:
    """Stop memory monitoring."""
    global _memory_monitor_active, _memory_monitor_thread

    _memory_monitor_active = False
    if _memory_monitor_thread and _memory_monitor_thread.is_alive():
        _memory_monitor_thread.join(timeout=2.0)
        logger.info("Memory monitor stopped")


def estimate_memory_requirements(
    file_paths: list[str], config: dict
) -> dict[str, float]:
    """Estimate memory requirements for a spectrogram job.

    Args:
        file_paths: List of file paths to process
        config: Job configuration

    Returns:
        dict: Estimated memory requirements in MB
    """
    total_size_mb = 0
    for file_path in file_paths:
        if os.path.exists(file_path):
            total_size_mb += os.path.getsize(file_path) / 1024 / 1024

    # Estimate memory needed for processing (typically 2-4x file size for complex data)
    processing_multiplier = 3.0
    estimated_processing_mb = total_size_mb * processing_multiplier

    # Add overhead for matplotlib and other libraries
    overhead_mb = 500  # 500MB overhead

    return {
        "file_size_mb": total_size_mb,
        "estimated_processing_mb": estimated_processing_mb,
        "total_estimated_mb": estimated_processing_mb + overhead_mb,
    }


def retry_operation(
    operation: Callable[[], T],
    max_retries: int = 5,
    base_delay: float = 0.5,
    backoff_factor: float = 1.5,
    operation_name: str = "operation",
) -> T:
    """
    Retry an operation with exponential backoff.

    Args:
        operation: The operation to retry
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay between retries in seconds
        backoff_factor: Factor to multiply delay by on each retry
        operation_name: Name of the operation for logging purposes

    Returns:
        The result of the operation if successful

    Raises:
        The last exception encountered if all retries fail
    """
    last_exception = None
    delay = base_delay

    for attempt in range(max_retries):
        try:
            return operation()
        except Exception as e:
            last_exception = e
            if attempt < max_retries - 1:
                logger.warning(
                    f"{operation_name} failed on attempt {attempt + 1}/{max_retries}: {e}. "
                    f"Retrying in {delay:.1f}s..."
                )
                time.sleep(delay)
                delay *= backoff_factor
            else:
                logger.error(
                    f"{operation_name} failed after {max_retries} attempts. "
                    f"Last error: {e}"
                )

    raise last_exception


@shared_task
def cleanup_stale_jobs():
    """Periodic task to clean up stale jobs that have been running too long."""
    timeout_hours = (
        getattr(settings, "JOB_MONITORING", {}).get("STALE_JOB_TIMEOUT", 3600) // 3600
    )
    cutoff_time = timezone.now() - timedelta(hours=timeout_hours)

    # Find jobs that have been running for too long
    stale_jobs = Job.objects.filter(
        status__in=["running", "submitted"], created_at__lt=cutoff_time
    )

    logger.info(
        f"Found {stale_jobs.count()} stale jobs older than {timeout_hours} hour(s)"
    )

    cleaned_count = 0
    for job in stale_jobs:
        try:
            # Get or create a token for the job owner
            token, _ = Token.objects.get_or_create(user=job.owner)

            # Mark job as failed
            job.status = "failed"
            job.save()

            # Create status update
            JobStatusUpdate.objects.create(
                job=job,
                status="failed",
                info={
                    "reason": "Job marked as stale by periodic cleanup task",
                    "timeout_hours": timeout_hours,
                    "cutoff_time": cutoff_time.isoformat(),
                },
            )

            logger.info(f"Marked stale job {job.id} as failed")
            cleaned_count += 1

        except Exception as e:
            logger.error(f"Failed to update stale job {job.id}: {e}")

    logger.info(f"Cleaned up {cleaned_count} stale jobs")
    return cleaned_count


@shared_task
def cleanup_zombie_jobs():
    """Periodic task to clean up zombie jobs (jobs that appear running but aren't on workers)."""
    from .views import detect_zombie_job

    # Find jobs that appear to be running
    potential_zombies = Job.objects.filter(status__in=["running", "submitted"])

    logger.info(f"Checking {potential_zombies.count()} jobs for zombie detection")

    zombie_count = 0
    for job in potential_zombies:
        try:
            if detect_zombie_job(job):
                zombie_count += 1

                # Mark the job as failed
                job.status = "failed"
                job.save()

                # Create status update
                JobStatusUpdate.objects.create(
                    job=job,
                    status="failed",
                    info={
                        "reason": "Job detected as zombie by periodic cleanup task",
                        "detected_at": timezone.now().isoformat(),
                        "previous_status": job.status,
                    },
                )

                logger.info(f"Marked zombie job {job.id} as failed")

        except Exception as e:
            logger.error(f"Failed to check job {job.id} for zombie detection: {e}")

    logger.info(f"Cleaned up {zombie_count} zombie jobs")
    return zombie_count


@shared_task(
    bind=True,
    soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_TASK_TIME_LIMIT,
    autoretry_for=(Exception, OSError),
    retry_kwargs={"max_retries": 2},
    retry_backoff=True,
)
def submit_job(self, job_id: int, token: str, config: dict | None = None):
    """
    Submit a job for processing with enhanced memory and timeout monitoring.

    Args:
        job_id: The ID of the job to process
        token: Authentication token for API access
        config: Optional configuration dictionary
    """
    logger.info(f"Starting job {job_id} processing")
    log_memory_usage("job_start", job_id)

    # Start memory monitoring
    memory_threshold = getattr(settings, "MEMORY_SAFEGUARD_THRESHOLD", 95.0)
    start_memory_monitor(job_id, token, memory_threshold)

    # Set up signal handlers for graceful shutdown
    def signal_handler(signum, frame):
        logger.warning(
            f"Job {job_id}: Received signal {signum}, attempting graceful shutdown"
        )
        stop_memory_monitor()
        update_job_status(
            job_id, "failed", token, info=f"Worker terminated by signal {signum}"
        )
        raise SystemExit(1)

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    try:
        # Ensure we have a fresh database connection
        connection.close()

        # Get the job from database with retry logic
        try:
            job = retry_operation(
                lambda: Job.objects.get(id=job_id),
                max_retries=5,
                base_delay=0.5,
                operation_name=f"Database lookup for job {job_id}",
            )
            logger.info(f"Job {job_id} found in database with status '{job.status}'")
        except ObjectDoesNotExist:
            logger.error(
                f"Job {job_id} does not exist in database after retries - "
                "this indicates a transaction isolation issue"
            )
            stop_memory_monitor()
            return
        except Exception as e:
            logger.error(f"Error accessing job {job_id} in database: {e}")
            stop_memory_monitor()
            return

        # Update job status to running - the API call now has built-in retries
        if not update_job_status(job_id, "running", token):
            logger.error(
                f"Failed to update job {job_id} status to 'running' after retries. Aborting job."
            )
            stop_memory_monitor()
            return

        # The next thing we do is get the job information. This will tell us:
        # 1. What type of visualization we should do
        # 2. A list of files we'll need
        job_metadata = get_job_meta(job_id, token)
        if job_metadata is None:
            error_msg = "Could not get job information."
            logger.error(f"Job {job_id}: {error_msg}")
            update_job_status(
                job_id,
                "failed",
                token,
                info=error_msg,
            )
            stop_memory_monitor()
            raise ValueError(error_msg)

        # Create directories for job files and results
        Path("jobs/job_files").mkdir(parents=True, exist_ok=True)
        Path("jobs/job_results").mkdir(parents=True, exist_ok=True)

        # Handle SDS data downloading if needed
        file_paths = []
        if config and "capture_ids" in config:
            try:
                # Get user from token
                user = User.objects.get(uuid=job_metadata["data"]["user_id"])
                logger.info(
                    f"Job {job_id}: Downloading SDS files for capture {config['capture_ids']}"
                )
                file_paths = download_sds_files(
                    job_id, token, config["capture_ids"], user, config["capture_type"]
                )
                logger.info(f"Job {job_id}: Successfully downloaded SDS files")
                log_memory_usage("after_sds_download", job_id)
            except Exception as e:
                error_msg = f"Error downloading SDS data: {e!s}"
                logger.error(f"Job {job_id}: {error_msg}")
                update_job_status(job_id, "failed", token, info=error_msg)
                stop_memory_monitor()
                raise ValueError(error_msg)

        # Process local files
        for f in job_metadata["data"]["local_files"]:
            logger.info(f"Job {job_id}: Fetching local file {f['name']}")
            data = get_job_file(f["id"], token, "local")

            if data is None:
                error_msg = f"Could not fetch local file {f['name']}."
                logger.error(f"Job {job_id}: {error_msg}")
                update_job_status(
                    job_id,
                    "failed",
                    token,
                    info=error_msg,
                )
                stop_memory_monitor()
                raise ValueError(error_msg)

            file_path = Path("jobs/job_files") / f["name"]
            with file_path.open("wb") as new_file:
                new_file.write(data)
            file_paths.append(str(file_path))
            logger.info(f"Job {job_id}: Successfully saved local file {f['name']}")

        # Estimate memory requirements before processing
        memory_estimate = estimate_memory_requirements(file_paths, config or {})
        logger.info(
            f"Job {job_id}: Memory estimate - "
            f"Files: {memory_estimate['file_size_mb']:.1f}MB, "
            f"Processing: {memory_estimate['estimated_processing_mb']:.1f}MB, "
            f"Total: {memory_estimate['total_estimated_mb']:.1f}MB"
        )

        # Check if we have enough memory - log warning but continue
        available_memory = psutil.virtual_memory().available / 1024 / 1024  # MB
        memory_usage_percent = (
            memory_estimate["total_estimated_mb"] / available_memory
        ) * 100

        if (
            memory_estimate["total_estimated_mb"] > available_memory * 0.8
        ):  # 80% of available
            logger.warning(
                f"Job {job_id}: High memory usage expected - "
                f"Estimated: {memory_estimate['total_estimated_mb']:.1f}MB, "
                f"Available: {available_memory:.1f}MB, "
                f"Usage: {memory_usage_percent:.1f}%. "
                f"Job will proceed but may cause memory pressure."
            )

            # Update job status with memory warning
            update_job_status(
                job_id,
                "running",
                token,
                info={
                    "memory_warning": f"High memory usage expected ({memory_usage_percent:.1f}% of available)",
                    "estimated_memory_mb": memory_estimate["total_estimated_mb"],
                    "available_memory_mb": available_memory,
                },
            )
        elif (
            memory_estimate["total_estimated_mb"] > available_memory * 0.6
        ):  # 60% of available
            logger.info(
                f"Job {job_id}: Moderate memory usage expected - "
                f"Estimated: {memory_estimate['total_estimated_mb']:.1f}MB, "
                f"Available: {available_memory:.1f}MB, "
                f"Usage: {memory_usage_percent:.1f}%"
            )
        else:
            logger.info(
                f"Job {job_id}: Low memory usage expected - "
                f"Estimated: {memory_estimate['total_estimated_mb']:.1f}MB, "
                f"Available: {available_memory:.1f}MB, "
                f"Usage: {memory_usage_percent:.1f}%"
            )

        if (
            memory_estimate["total_estimated_mb"] > available_memory * 0.5
        ):  # Use 50% threshold
            # Force chunked processing
            logger.info(f"Job {job_id}: Forcing chunked processing")
            config["use_chunked_processing"] = True
            config["max_memory_mb"] = available_memory * 0.4  # Conservative limit

        if job_metadata["data"]["type"] == "spectrogram":
            try:
                logger.info(f"Job {job_id}: Generating spectrogram")
                log_memory_usage("before_spectrogram", job_id)

                figure = make_spectrogram(
                    job_metadata,
                    config,
                    file_paths=file_paths,
                )

                log_memory_usage("after_spectrogram", job_id)
                figure.savefig(f"jobs/job_results/{job_id}.png")
                logger.info(f"Job {job_id}: Successfully generated spectrogram")
            except SoftTimeLimitExceeded:
                error_msg = "Job exceeded soft time limit during spectrogram generation"
                logger.error(f"Job {job_id}: {error_msg}")
                update_job_status(job_id, "failed", token, info=error_msg)
                stop_memory_monitor()
                raise
            except TimeLimitExceeded:
                error_msg = "Job exceeded hard time limit during spectrogram generation"
                logger.error(f"Job {job_id}: {error_msg}")
                update_job_status(job_id, "failed", token, info=error_msg)
                stop_memory_monitor()
                raise
            except Exception as e:
                error_msg = f"Could not make spectrogram: {e}"
                logger.error(f"Job {job_id}: {error_msg}")
                update_job_status(
                    job_id,
                    "failed",
                    token,
                    info=error_msg,
                )
                stop_memory_monitor()
                raise
        else:
            error_msg = f"Unknown job type: {job_metadata['data']['type']}"
            logger.error(f"Job {job_id}: {error_msg}")
            update_job_status(
                job_id,
                "failed",
                token,
                info=error_msg,
            )
            stop_memory_monitor()
            raise ValueError(error_msg)

        # Let's say the code dumped to a local file and we want to upload that.
        # We can do either that, or have an in-memory file. Either way,
        # "results_file" will be our file contents (byte format)
        logger.info(f"Job {job_id}: Uploading results")
        with Path.open(f"jobs/job_results/{job_id}.png", "rb") as results_file:
            # Post results -- we can make this call as many times as needed to get
            # results to send to the main system.
            # We can also mix JSON data and a file. It will save 2 records of
            # "JobData", one for the JSON and one for the file.
            # Remember that "json_data" should be a dictionary, and if we use a
            # file upload, to provide it a name.
            response = post_results(
                job_id,
                token,
                file_data=results_file.read(),
                file_name="figure.png",
            )

        if not response:
            error_msg = "Could not post results."
            logger.error(f"Job {job_id}: {error_msg}")
            update_job_status(job_id, "failed", token, info=error_msg)
            stop_memory_monitor()
            raise ValueError(error_msg)

        # Clean up job files
        logger.info(f"Job {job_id}: Cleaning up temporary files")
        cleanup_job_files(job_id)

        # Update the job as complete
        info = {
            "results_id": response["file_ids"]["figure.png"],
        }
        logger.info(f"Job {job_id}: Marking job as completed")
        if not update_job_status(job_id, "completed", token, info=info):
            logger.error(
                f"Job {job_id}: Failed to update status to completed, but job processing succeeded"
            )
        else:
            logger.info(f"Job {job_id}: Successfully completed")

        log_memory_usage("job_complete", job_id)

    except MemoryError:
        # Log memory error and update job status
        error_msg = "Worker ran out of memory"
        logger.error(f"Job {job_id}: {error_msg}")
        update_job_status(job_id, "failed", token, info=error_msg)
        stop_memory_monitor()
        raise
    except SoftTimeLimitExceeded:
        error_msg = "Job exceeded soft time limit"
        logger.error(f"Job {job_id}: {error_msg}")
        update_job_status(job_id, "failed", token, info=error_msg)
        stop_memory_monitor()
        raise
    except TimeLimitExceeded:
        error_msg = "Job exceeded hard time limit"
        logger.error(f"Job {job_id}: {error_msg}")
        update_job_status(job_id, "failed", token, info=error_msg)
        stop_memory_monitor()
        raise
    except Exception as e:
        error_msg = f"Unexpected error in job {job_id}: {e}"
        logger.error(error_msg)
        update_job_status(job_id, "failed", token, info=error_msg)
        stop_memory_monitor()
        raise
    finally:
        # Always stop memory monitoring
        stop_memory_monitor()


@shared_task
def error_handler(request, exc, _traceback):
    """
    Handle errors that occur during job processing.

    Args:
        request: The Celery request object containing job_id and token
        exc: The exception that occurred
        _traceback: The traceback (unused)
    """
    logger.error(f"Job {request.job_id}: Error handler called with exception: {exc}")
    if not update_job_status(request.job_id, "failed", request.token, info=str(exc)):
        logger.error(
            f"Job {request.job_id}: Failed to update status to failed in error handler"
        )
    else:
        logger.info(
            f"Job {request.job_id}: Successfully updated status to failed in error handler"
        )


def download_sds_files(
    job_id: int,
    token: str,
    capture_ids: list[str],
    user: User,
    capture_type: str,
) -> list[str]:
    """Download files from SDS for the given capture IDs and return their paths.

    Args:
        job_id: The ID of the job
        token: The authentication token
        capture_ids: List containing a single capture ID to download
        user: The user object
        capture_type: Type of capture (e.g., "digital_rf", "sigmf")

    Returns:
        list[str]: List of paths to the downloaded files

    Raises:
        ValueError: If there are any errors during the download process
    """
    sds_client = user.sds_client()
    sds_captures = sds_client.captures.listing(capture_type=capture_type)

    # Get the first capture ID
    capture_id = capture_ids[0]
    capture = next((c for c in sds_captures if str(c.uuid) == str(capture_id)), None)
    if not capture:
        error_msg = f"Capture ID {capture_id} not found in SDS"
        update_job_status(job_id, "failed", token, info=error_msg)
        raise ValueError(error_msg)

    # Get the UUIDs of the files in the capture for comparison later
    file_uuids = [file.uuid for file in capture.files]

    # Create a directory for this capture
    local_path = Path(
        "jobs/job_files",
        str(job_id),
        capture_id,
    )
    local_path.mkdir(parents=True)

    # Download files
    file_results = safe_sds_client_download(
        sds_client, capture.top_level_dir, local_path
    )

    downloaded_files = [result() for result in file_results if result]
    download_errors = [result.error_info for result in file_results if not result]

    if download_errors:
        error_msg = f"Failed to download SDS files: {download_errors}"
        update_job_status(job_id, "failed", token, info=error_msg)
        raise ValueError(error_msg)

    # Clean up unnecessary files and directories
    matching_files = []
    for f in downloaded_files:
        if f.uuid in file_uuids:
            matching_files.append(f)
        else:
            f.local_path.unlink()

    file_paths = [str(f.local_path) for f in matching_files]
    logging.info(
        f"Files matching capture (expected): {len(file_paths)} ({len(file_uuids)})"
    )
    logging.info(f"Extra files removed: {len(downloaded_files) - len(matching_files)}")

    if not file_paths:
        error_msg = f"No matching files found for capture {capture_id}"
        update_job_status(job_id, "failed", token, info=error_msg)
        raise ValueError(error_msg)

    if capture_type == CaptureType.DigitalRF:
        # For DigitalRF, maintain the directory structure
        common_path = os.path.commonpath(file_paths)
        shutil.move(common_path, local_path)
        sds_root = str(capture.files[0].directory).strip("/").split("/")[0]
        sds_root_path = local_path / sds_root
        if sds_root_path.exists():
            shutil.rmtree(sds_root_path)
        # Return all files in the directory structure
        return [str(p) for p in local_path.glob("**/*")]
    if capture_type == CaptureType.SigMF:
        # For SigMF, move files to the root of the capture directory
        for file_path in file_paths:
            file_name = Path(file_path).name
            shutil.move(file_path, local_path / file_name)
        # Return all files in the capture directory
        return [str(p) for p in local_path.glob("*")]

    raise ValueError(f"Unsupported capture type: {capture_type}")


def safe_sds_client_download(
    sds_client: SDSClient, from_sds_path: str, to_local_path: str
) -> list[Result[File]]:
    try:
        file_results = sds_client.download(
            from_sds_path=from_sds_path,
            to_local_path=to_local_path,
            skip_contents=False,
            overwrite=True,
            verbose=True,
        )
    except StopIteration:
        # Account for a bug in the SDS client
        logging.warning("Caught StopIteration error--continuing.")
    return file_results


def cleanup_job_files(job_id: int) -> None:
    """Clean up files and directories created for a specific job.

    Args:
        job_id: The ID of the job whose files should be cleaned up

    Note:
        This function only removes files and directories specific to the given job_id,
        preserving the main job_files and job_results directories for other jobs.
    """
    try:
        # Remove job-specific directories and files
        job_files_dir = Path("jobs/job_files")
        job_results_dir = Path("jobs/job_results")

        # Remove job-specific subdirectories in job_files
        if job_files_dir.exists():
            for item in job_files_dir.iterdir():
                if item.is_dir() and item.name == str(job_id):
                    shutil.rmtree(item)
                elif item.is_file():
                    # Remove individual files that were created for this job
                    item.unlink()

        # Remove job-specific result file
        result_file = job_results_dir / f"{job_id}.png"
        if result_file.exists():
            result_file.unlink()

    except Exception as e:
        logging.warning(f"Error cleaning up job files: {e}")
