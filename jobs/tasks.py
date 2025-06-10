import logging
import os
import shutil
from pathlib import Path

from celery import shared_task
from spectrumx.models.captures import CaptureType

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
    logging.info(f"job_metadata: {job_metadata}")
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
    if config and "capture_ids" in config:
        try:
            # Get user from token
            user = User.objects.get(uuid=job_metadata["data"]["user"])
            download_sds_files(
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

        with Path.open(f"jobs/job_files/{f['name']}", "wb") as new_file:
            new_file.write(data)

    if job_metadata["data"]["type"] == "spectrogram":
        try:
            figure = make_spectrogram(
                job_metadata,
                config,
                files_dir="jobs/job_files/",
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

    # Upload results
    with Path.open(f"jobs/job_results/{job_id}.png", "rb") as results_file:
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
    try:
        shutil.rmtree("jobs/job_files")
        shutil.rmtree("jobs/job_results")
    except Exception as e:
        logging.warning(f"Error cleaning up job files: {e}")

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
) -> None:
    """Download files from SDS for the given capture IDs.

    Args:
        job_id: The ID of the job
        token: The authentication token
        capture_ids: List of capture IDs to download
        user: The user object
        capture_type: Type of capture (e.g., "digital_rf", "sigmf")

    Raises:
        ValueError: If there are any errors during the download process
    """
    sds_client = user.sds_client()
    sds_captures = sds_client.captures.listing(capture_type=capture_type)

    # Download each capture's files
    for capture_id in capture_ids:
        capture = next(
            (c for c in sds_captures if str(c.uuid) == str(capture_id)), None
        )
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
        file_results = sds_client.download(
            from_sds_path=capture.top_level_dir,
            to_local_path=local_path,
            skip_contents=False,
            overwrite=True,
            verbose=True,
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
        logging.info(f"File paths: {file_paths}")
        logging.info(
            f"Files matching capture (expected): {len(file_paths)} ({len(file_uuids)})"
        )
        logging.info(
            f"Extra files removed: {len(downloaded_files) - len(matching_files)}"
        )

        if not file_paths:
            error_msg = f"No matching files found for capture {capture_id}"
            update_job_status(job_id, "failed", token, info=error_msg)
            raise ValueError(error_msg)

        if capture_type == CaptureType.DigitalRF:
            # For DigitalRF, maintain the directory structure
            common_path = os.path.commonpath(file_paths)
            logging.info(f"Common path: {common_path}")
            shutil.move(common_path, local_path)
            logging.info(f"Capture dir tree: {list(local_path.glob('*'))}")
            sds_root = str(capture.files[0].directory).strip("/").split("/")[0]
            sds_root_path = local_path / sds_root
            if sds_root_path.exists():
                shutil.rmtree(sds_root_path)
        else:
            # For SigMF, move files to the root of the capture directory
            for file_path in file_paths:
                file_name = Path(file_path).name
                shutil.move(file_path, local_path / file_name)
