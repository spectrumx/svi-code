import logging
import os
import shutil
import time
from pathlib import Path

from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist
from django.db import connection
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
from .visualizations.spectrogram import make_spectrogram

logger = logging.getLogger(__name__)


@shared_task
def submit_job(job_id: int, token: str, config: dict | None = None):
    """
    Submit a job for processing.

    Args:
        job_id: The ID of the job to process
        token: Authentication token for API access
        config: Optional configuration dictionary
    """
    logger.info(f"Starting job {job_id} processing")

    # Ensure we have a fresh database connection
    connection.close()

    # First, verify the job exists in the database with retry logic
    max_retries = 5
    retry_delay = 0.5

    for attempt in range(max_retries):
        try:
            job = Job.objects.get(id=job_id)
            logger.info(
                f"Job {job_id} found in database with status '{job.status}' on attempt {attempt + 1}"
            )
            break
        except ObjectDoesNotExist:
            if attempt < max_retries - 1:
                logger.warning(
                    f"Job {job_id} not found in database on attempt {attempt + 1}, retrying in {retry_delay}s..."
                )
                time.sleep(retry_delay)
                retry_delay *= 1.5  # Gradual backoff
            else:
                logger.error(
                    f"Job {job_id} does not exist in database after {max_retries} attempts - this indicates a transaction isolation issue"
                )
                return
        except Exception as e:
            logger.error(f"Error accessing job {job_id} in database: {e}")
            return

    # Retry logic for status update - sometimes the job might not be immediately
    # visible due to database transaction isolation
    max_retries = 3
    retry_delay = 0.5

    for attempt in range(max_retries):
        if update_job_status(job_id, "running", token):
            logger.info(
                f"Successfully updated job {job_id} status to 'running' on attempt {attempt + 1}"
            )
            break
        elif attempt < max_retries - 1:
            logger.warning(
                f"Failed to update job {job_id} status to 'running' on attempt {attempt + 1}, retrying in {retry_delay}s..."
            )
            time.sleep(retry_delay)
            retry_delay *= 2  # Exponential backoff
        else:
            logger.error(
                f"Failed to update job {job_id} status to 'running' after {max_retries} attempts. Aborting job."
            )
            # Don't raise an exception here as it might cause the task to retry
            # Instead, we'll let the job remain in its current state
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
        except Exception as e:
            error_msg = f"Error downloading SDS data: {e!s}"
            logger.error(f"Job {job_id}: {error_msg}")
            update_job_status(job_id, "failed", token, info=error_msg)
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
            raise ValueError(error_msg)

        file_path = Path("jobs/job_files") / f["name"]
        with file_path.open("wb") as new_file:
            new_file.write(data)
        file_paths.append(str(file_path))
        logger.info(f"Job {job_id}: Successfully saved local file {f['name']}")

    if job_metadata["data"]["type"] == "spectrogram":
        try:
            logger.info(f"Job {job_id}: Generating spectrogram")
            figure = make_spectrogram(
                job_metadata,
                config,
                file_paths=file_paths,
            )
            figure.savefig(f"jobs/job_results/{job_id}.png")
            logger.info(f"Job {job_id}: Successfully generated spectrogram")
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
    else:
        error_msg = f"Unknown job type: {job_metadata['data']['type']}"
        logger.error(f"Job {job_id}: {error_msg}")
        update_job_status(
            job_id,
            "failed",
            token,
            info=error_msg,
        )
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
