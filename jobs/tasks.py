import logging
import os
import shutil
import signal
import time
from collections.abc import Callable
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
from spectrumx import Client as SDSClient
from spectrumx.errors import Result
from spectrumx.models.captures import CaptureType
from spectrumx.models.files import File

from spectrumx_visualization_platform.users.models import User

from .io import get_job_file
from .io import get_job_meta
from .io import post_results
from .io import update_job_status
from .memory_manager import memory_manager
from .models import Job
from .models import JobStatusUpdate
from .visualizations.spectrogram import make_spectrogram

logger = logging.getLogger(__name__)

T = TypeVar("T")


def estimate_memory_requirements(file_paths: list[str]) -> dict[str, float]:
    """Estimate memory requirements for a spectrogram job.

    Args:
        file_paths: List of file paths to process

    Returns:
        dict: Estimated memory requirements in MB
    """
    total_size_mb = 0
    for file_path in file_paths:
        if Path(file_path).exists():
            total_size_mb += Path(file_path).stat().st_size / 1024 / 1024

    # Estimate memory needed for processing (typically 2-4x file size for complex data)
    processing_multiplier = 5.0
    estimated_processing_mb = total_size_mb * processing_multiplier

    # Add overhead for matplotlib and other libraries
    overhead_mb = 1000  # 1GB overhead

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


def _get_job_from_database(job_id: int) -> Job:
    """Retrieve job from database with retry logic.

    Args:
        job_id: The ID of the job to retrieve

    Returns:
        Job: The job object

    Raises:
        ObjectDoesNotExist: If job doesn't exist after retries
        Exception: If database access fails
    """
    try:
        job = retry_operation(
            lambda: Job.objects.get(id=job_id),
            max_retries=5,
            base_delay=0.5,
            operation_name=f"Database lookup for job {job_id}",
        )
        logger.info(f"Job {job_id} found in database with status '{job.status}'")
        return job
    except ObjectDoesNotExist:
        logger.error(
            f"Job {job_id} does not exist in database after retries - "
            "this indicates a transaction isolation issue"
        )
        raise
    except Exception as e:
        logger.error(f"Error accessing job {job_id} in database: {e}")
        raise


def _process_sds_files(
    job_id: int, token: str, config: dict, job_metadata: dict
) -> list[str]:
    """Process SDS files if capture_ids are provided in config.

    Args:
        job_id: The ID of the job
        token: Authentication token
        config: Job configuration
        job_metadata: Job metadata from API

    Returns:
        list[str]: List of file paths for downloaded SDS files

    Raises:
        ValueError: If SDS download fails
    """
    if not config or "capture_ids" not in config:
        return []

    try:
        user = User.objects.get(uuid=job_metadata["data"]["user_id"])
        logger.info(
            f"Job {job_id}: Downloading SDS files for capture {config['capture_ids']}"
        )
        file_paths = download_sds_files(
            job_id, token, config["capture_ids"], user, config["capture_type"]
        )
        logger.info(f"Job {job_id}: Successfully downloaded SDS files")
        memory_manager.log_memory_usage("after_sds_download", job_id)
        return file_paths
    except Exception as e:
        error_msg = f"Error downloading SDS data: {e!s}"
        logger.error(f"Job {job_id}: {error_msg}")
        update_job_status(job_id, "failed", token, info=error_msg)
        raise ValueError(error_msg)


def _process_local_files(job_id: int, token: str, job_metadata: dict) -> list[str]:
    """Process local files from job metadata.

    Args:
        job_id: The ID of the job
        token: Authentication token
        job_metadata: Job metadata containing local files

    Returns:
        list[str]: List of file paths for local files

    Raises:
        ValueError: If local file processing fails
    """
    file_paths = []
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
            raise ValueError(error_msg)

        file_path = Path("jobs/job_files") / f["name"]
        with file_path.open("wb") as new_file:
            new_file.write(data)
        file_paths.append(str(file_path))
        logger.info(f"Job {job_id}: Successfully saved local file {f['name']}")

    return file_paths


def _check_memory_requirements(job_id: int, token: str, file_paths: list[str]) -> None:
    """Check and log memory requirements for the job.

    Args:
        job_id: The ID of the job
        token: Authentication token
        file_paths: List of file paths to process
        config: Job configuration
    """
    memory_estimate = estimate_memory_requirements(file_paths)
    logger.info(
        f"Job {job_id}: Memory estimate - "
        f"Files: {memory_estimate['file_size_mb']:.1f}MB, "
        f"Processing: {memory_estimate['estimated_processing_mb']:.1f}MB, "
        f"Total: {memory_estimate['total_estimated_mb']:.1f}MB"
    )

    # Update the job's memory estimate for monitoring
    memory_manager.update_job_memory_estimate(
        job_id, memory_estimate["total_estimated_mb"]
    )

    # Check if we have enough memory - log warning but continue
    available_memory = psutil.virtual_memory().available / 1024 / 1024  # MB
    memory_usage_percent = (
        memory_estimate["total_estimated_mb"] / available_memory
    ) * 100

    if (
        memory_estimate["total_estimated_mb"] > available_memory * 0.6
    ):  # 60% of available
        logger.info(
            f"Job {job_id}: High memory usage expected - "
            f"Estimated: {memory_estimate['total_estimated_mb']:.1f}MB, "
            f"Available: {available_memory:.1f}MB, "
            f"Usage: {memory_usage_percent:.1f}%"
        )
        # Update job status with memory warning
        update_job_status(
            job_id,
            "running",
            token,
            info={
                "memory_warning": f"High memory usage expected ({memory_usage_percent:.1f}% of available)",
            },
        )
    else:
        logger.info(
            f"Job {job_id}: Low memory usage expected - "
            f"Estimated: {memory_estimate['total_estimated_mb']:.1f}MB, "
            f"Available: {available_memory:.1f}MB, "
            f"Usage: {memory_usage_percent:.1f}%"
        )


def _generate_visualization(
    job_id: int, token: str, job_metadata: dict, config: dict, file_paths: list[str]
) -> None:
    """Generate the visualization based on job type.

    Args:
        job_id: The ID of the job
        token: Authentication token
        job_metadata: Job metadata
        config: Job configuration
        file_paths: List of file paths to process

    Raises:
        ValueError: If job type is unsupported or generation fails
        SoftTimeLimitExceeded: If job exceeds soft time limit
        TimeLimitExceeded: If job exceeds hard time limit
    """
    if job_metadata["data"]["type"] != "spectrogram":
        error_msg = f"Unknown job type: {job_metadata['data']['type']}"
        logger.error(f"Job {job_id}: {error_msg}")
        update_job_status(
            job_id,
            "failed",
            token,
            info=error_msg,
        )
        raise ValueError(error_msg)

    try:
        logger.info(f"Job {job_id}: Generating spectrogram")
        memory_manager.log_memory_usage("before_spectrogram", job_id)

        figure = make_spectrogram(config, file_paths)

        memory_manager.log_memory_usage("after_spectrogram", job_id)
        figure.savefig(f"jobs/job_results/{job_id}.png")
        logger.info(f"Job {job_id}: Successfully generated spectrogram")
    except SoftTimeLimitExceeded:
        error_msg = "Job exceeded soft time limit during spectrogram generation"
        logger.error(f"Job {job_id}: {error_msg}")
        update_job_status(job_id, "failed", token, info=error_msg)
        raise
    except TimeLimitExceeded:
        error_msg = "Job exceeded hard time limit during spectrogram generation"
        logger.error(f"Job {job_id}: {error_msg}")
        update_job_status(job_id, "failed", token, info=error_msg)
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
        raise


def _setup_job_environment(job_id: int, token: str) -> tuple[Job, dict]:
    """Set up the job environment and get job metadata.

    Args:
        job_id: The ID of the job
        token: Authentication token

    Returns:
        tuple: (job object, job metadata)

    Raises:
        ValueError: If setup fails
    """
    connection.close()

    try:
        job = _get_job_from_database(job_id)
    except (ObjectDoesNotExist, Exception):
        memory_manager.unregister_job(job_id)
        error_msg = "Failed to retrieve job from database"
        raise ValueError(error_msg)

    if not update_job_status(job_id, "running", token):
        logger.error(
            f"Failed to update job {job_id} status to 'running'. Aborting job."
        )
        memory_manager.unregister_job(job_id)
        error_msg = "Failed to update job status"
        raise ValueError(error_msg)

    job_metadata = get_job_meta(job_id, token)
    if job_metadata is None:
        error_msg = "Could not get job information."
        logger.error(f"Job {job_id}: {error_msg}")
        update_job_status(job_id, "failed", token, info=error_msg)
        memory_manager.unregister_job(job_id)
        raise ValueError(error_msg)

    return job, job_metadata


def _prepare_directories_and_files(
    job_id: int, token: str, config: dict, job_metadata: dict
) -> list[str]:
    """Prepare directories and process all files.

    Args:
        job_id: The ID of the job
        token: Authentication token
        config: Job configuration
        job_metadata: Job metadata

    Returns:
        list[str]: List of file paths
    """
    Path("jobs/job_files").mkdir(parents=True, exist_ok=True)
    Path("jobs/job_results").mkdir(parents=True, exist_ok=True)

    file_paths = _process_sds_files(job_id, token, config, job_metadata)
    file_paths.extend(_process_local_files(job_id, token, job_metadata))

    return file_paths


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
    # Initialize job processing setup
    logger.info(f"Starting job {job_id} processing")
    memory_manager.log_memory_usage("job_start", job_id)
    memory_manager.register_job(job_id, estimated_memory_mb=0, task_id=self.request.id)

    # Set up signal handlers for graceful shutdown
    def signal_handler(signum, frame):  # noqa: ARG001
        logger.warning(
            f"Job {job_id}: Received signal {signum}, attempting graceful shutdown"
        )
        memory_manager.unregister_job(job_id)
        update_job_status(
            job_id, "failed", token, info=f"Worker terminated by signal {signum}"
        )
        raise SystemExit(1)

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    try:
        job, job_metadata = _setup_job_environment(job_id, token)
        file_paths = _prepare_directories_and_files(
            job_id, token, config or {}, job_metadata
        )

        _check_memory_requirements(job_id, token, file_paths)
        _generate_visualization(job_id, token, job_metadata, config or {}, file_paths)

        # Upload job results to the main system
        logger.info(f"Job {job_id}: Uploading results")
        with Path.open(f"jobs/job_results/{job_id}.png", "rb") as results_file:
            response = post_results(
                job_id,
                token,
                file_data=results_file.read(),
                file_name="figure.png",
            )

        if not response:
            error_msg = "Could not post results."
            _handle_job_error(job_id, token, error_msg, logger)

        # Mark job as completed and clean up
        logger.info(f"Job {job_id}: Cleaning up temporary files")
        cleanup_job_files(job_id)

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

        memory_manager.log_memory_usage("job_complete", job_id)

    except (MemoryError, SoftTimeLimitExceeded, TimeLimitExceeded, Exception) as e:
        # Handle exceptions during job processing
        if isinstance(e, MemoryError):
            error_msg = "Worker ran out of memory"
        elif isinstance(e, SoftTimeLimitExceeded):
            error_msg = "Job exceeded soft time limit"
        elif isinstance(e, TimeLimitExceeded):
            error_msg = "Job exceeded hard time limit"
        else:
            error_msg = f"Unexpected error in job {job_id}: {e}"

        logger.error(f"Job {job_id}: {error_msg}")
        update_job_status(job_id, "failed", token, info=error_msg)
        memory_manager.unregister_job(job_id)
        raise
    finally:
        memory_manager.unregister_job(job_id)


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


def _handle_job_error(
    job_id: int, token: str, error_msg: str, logger_instance: logging.Logger
) -> None:
    """Handle job errors by logging, updating status, and raising ValueError.

    Args:
        job_id: The ID of the job
        token: Authentication token
        error_msg: Error message to log and raise
        logger_instance: Logger instance to use

    Raises:
        ValueError: Always raised with the error message
    """
    logger_instance.error(f"Job {job_id}: {error_msg}")
    update_job_status(job_id, "failed", token, info=error_msg)
    raise ValueError(error_msg)


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


def check_job_running_on_worker(job_id: int) -> bool:
    """
    Check if a job is actually running on any Celery worker.

    Args:
        job_id: The job ID to check

    Returns:
        bool: True if the job is running on a worker, False otherwise
    """
    try:
        # Get the Celery app instance
        from celery import current_app

        app = current_app

        # Inspect active tasks on all workers
        inspect = app.control.inspect()
        active_tasks = inspect.active()

        if not active_tasks:
            return False

        # Check if any worker has our job task running
        for tasks in active_tasks.values():
            for task in tasks:
                # Check if this is a submit_job task and if it's processing our job_id
                if (
                    task.get("name") == "jobs.tasks.submit_job"
                    and task.get("args")
                    and len(task.get("args", [])) > 0
                    and task["args"][0] == job_id
                ):
                    return True

        return False

    except Exception as e:
        # If we can't inspect workers, assume the job might be running
        # This is a conservative approach to avoid false positives
        logger.warning(f"Error checking if job {job_id} is running on worker: {e}")
        return True


def detect_zombie_job(job: Job) -> bool:
    """
    Detect if a job is a "zombie" - appears to be running but isn't actually on a worker.

    Args:
        job: The job object to check

    Returns:
        bool: True if the job is a zombie (should be marked as failed), False otherwise
    """
    # Only check jobs that appear to be running
    if job.status != "running":
        return False

    # Check if the job is actually running on a worker
    is_running = check_job_running_on_worker(job.id)

    if not is_running:
        logger.warning(
            f"Job {job.id}: Detected as zombie - status '{job.status}' but not running on any worker"
        )
        return True

    return False


@shared_task
def check_zombie_jobs() -> dict[str, int]:
    """
    Periodic task to check for and fix zombie jobs.

    This task detects jobs that appear to be running but aren't actually executing
    on any Celery worker. Such jobs are marked as failed with appropriate status
    updates.

    Returns:
        dict: Summary of zombie job detection results
    """
    logger.info("Starting zombie job detection task")

    # Get all jobs that appear to be running
    running_jobs = Job.objects.filter(status__in=["running", "submitted"])
    zombie_count = 0
    processed_count = 0

    for job in running_jobs:
        try:
            processed_count += 1

            if detect_zombie_job(job):
                # Mark the job as failed
                job.status = "failed"
                job.save()

                # Create a status update for the zombie detection
                JobStatusUpdate.objects.create(
                    job=job,
                    status="failed",
                    info={
                        "reason": "Job detected as zombie - not running on any worker",
                        "detected_at": timezone.now().isoformat(),
                        "previous_status": job.status,
                        "detected_by": "periodic_zombie_check",
                    },
                )

                logger.info(f"Job {job.id}: Marked as failed due to zombie detection")
                zombie_count += 1

        except Exception as e:
            logger.error(f"Error processing job {job.id} for zombie detection: {e}")
            continue

    logger.info(
        f"Zombie job detection completed: {zombie_count} zombies found out of {processed_count} jobs checked"
    )

    return {
        "zombies_found": zombie_count,
        "jobs_checked": processed_count,
        "timestamp": timezone.now().isoformat(),
    }
