import logging
import os
import shutil
from pathlib import Path

from celery import shared_task
from spectrumx import Client as SDSClient
from spectrumx.errors import Result
from spectrumx.models.captures import CaptureType
from spectrumx.models.files import File

from spectrumx_visualization_platform.users.models import User

from .io import get_job_file
from .io import get_job_meta
from .io import post_results
from .io import update_job_status
from .visualizations.spectrogram import make_spectrogram


@shared_task
def submit_job(job_id: int, token: str, config: dict | None = None):
    # The very first thing we should do is update the Job status to "running"
    update_job_status(job_id, "running", token)

    # The next thing we do is get the job information. This will tell us:
    # 1. What type of visualization we should do
    # 2. A list of files we'll need
    job_metadata = get_job_meta(job_id, token)
    if job_metadata is None:
        error_msg = "Could not get job information."
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
            file_paths = download_sds_files(
                job_id, token, config["capture_ids"], user, config["capture_type"]
            )
        except Exception as e:
            error_msg = f"Error downloading SDS data: {e!s}"
            update_job_status(job_id, "failed", token, info=error_msg)
            raise ValueError(error_msg)

    # Process local files
    for f in job_metadata["data"]["local_files"]:
        data = get_job_file(f["id"], token, "local")

        if data is None:
            error_msg = "Could not fetch local file."
            update_job_status(
                job_id,
                "failed",
                token,
                info="Could not fetch local file.",
            )
            raise ValueError(error_msg)

        file_path = Path("jobs/job_files") / f["name"]
        with file_path.open("wb") as new_file:
            new_file.write(data)
        file_paths.append(str(file_path))

    if job_metadata["data"]["type"] == "spectrogram":
        try:
            figure = make_spectrogram(
                job_metadata,
                config,
                file_paths=file_paths,
            )
            figure.savefig(f"jobs/job_results/{job_id}.png")
        except Exception as e:
            update_job_status(
                job_id,
                "failed",
                token,
                info=f"Could not make spectrogram: {e}",
            )
            raise
    else:
        error_msg = f"Unknown job type: {job_metadata['data']['type']}"
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
        update_job_status(job_id, "failed", token, info=error_msg)
        raise ValueError(error_msg)

    # Clean up job files
    cleanup_job_files(job_id)

    # Update the job as complete
    info = {
        "results_id": response["file_ids"]["figure.png"],
    }
    update_job_status(job_id, "completed", token, info=info)


@shared_task
def error_handler(request, exc, _traceback):
    update_job_status(request.job_id, "failed", request.token, info=str(exc))


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
