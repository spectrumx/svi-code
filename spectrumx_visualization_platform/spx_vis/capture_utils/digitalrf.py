import logging
import mimetypes
import os
import re
import shutil
import tarfile
import tempfile
import zipfile
from datetime import UTC
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile

from jobs.submission import request_job_submission
from spectrumx_visualization_platform.spx_vis.models import CaptureType

from .base import CaptureUtility

logger = logging.getLogger(__name__)


class DigitalRFUtility(CaptureUtility):
    """Utility for DigitalRF capture type operations.

    Provides utilities for processing and extracting information from DigitalRF files.
    DigitalRF files typically consist of a directory structure with metadata and data files.
    """

    @staticmethod
    def extract_timestamp(files: list[UploadedFile]) -> datetime | None:
        """Extract timestamp from DigitalRF files.

        The DigitalRF files are expected to be in a zip archive containing directories
        with timestamps in the format '2024-06-27T14-00-00'. Each directory contains
        files with names like 'rf@1719499740.000.h5' where the number before the decimal
        is UNIX seconds and the three digits after are milliseconds.

        Args:
            files: The uploaded DigitalRF files

        Returns:
            datetime: The extracted timestamp if found, None otherwise
        """
        if not files:
            logger.warning("No files provided for timestamp extraction")
            return None

        # DigitalRF files are expected to be a single zip archive
        zip_file = next((f for f in files if f.name.endswith(".zip")), None)
        if not zip_file:
            logger.warning("No zip archive found in DigitalRF files")
            return None

        earliest_timestamp: datetime | None = None
        timestamp_pattern = re.compile(r"rf@(\d+)\.(\d+)\.h5")

        try:
            with zipfile.ZipFile(zip_file, "r") as zf:
                for name in zf.namelist():
                    # Look for files matching the timestamp pattern
                    match = timestamp_pattern.search(name)
                    if match:
                        seconds = int(match.group(1))
                        milliseconds = int(match.group(2))
                        # Convert to microseconds for datetime
                        microseconds = milliseconds * 1000
                        current_timestamp = datetime.fromtimestamp(
                            seconds, tz=UTC
                        ).replace(microsecond=microseconds)

                        if (
                            earliest_timestamp is None
                            or current_timestamp < earliest_timestamp
                        ):
                            earliest_timestamp = current_timestamp

        except (zipfile.BadZipFile, ValueError) as e:
            logger.error(f"Error processing DigitalRF zip archive: {e}")
            return None

        if earliest_timestamp is None:
            logger.warning("No valid timestamps found in DigitalRF files")

        return earliest_timestamp

    @staticmethod
    def get_media_type(file: UploadedFile) -> str:
        """Get the media type for a DigitalRF file.

        Args:
            file: The uploaded DigitalRF file

        Returns:
            str: The media type for the DigitalRF file
        """
        if file.name.endswith(".zip"):
            return "application/zip"
        if file.name.endswith(".h5"):
            return "application/x-hdf5"
        media_type, _ = mimetypes.guess_type(file.name)
        if media_type is None:
            media_type = "application/octet-stream"

        return media_type

    @staticmethod
    def get_capture_name(files: list[UploadedFile], name: str | None) -> str:
        """Infer the capture name from the files.

        Args:
            files: The uploaded DigitalRF files
            name: The requested name for the capture

        Returns:
            str: The inferred capture name

        Raises:
            ValueError: If the required DigitalRF files are not found
        """
        if name:
            return name

        # Use the file name (without extension) as the capture name
        return ".".join(files[0].name.split(".")[:-1])

    @staticmethod
    def submit_spectrogram_job(user, capture_files, width=10, height=10):
        """Get the Digital RF data and metadata files needed for spectrogram generation.

        Args:
            capture_files: List of file paths that make up a Digital RF channel directory structure
            width: Width of the spectrogram in inches
            height: Height of the spectrogram in inches

        Returns:
            Job: The submitted job

        Raises:
            ValueError: If the required Digital RF files are not found
        """
        # Find the metadata file and data directories
        meta_file = None

        for f in capture_files:
            if f.endswith("drf_properties.h5"):
                meta_file = f

        if not meta_file:
            error_message = "Required Digital RF metadata file not found"
            logger.error(error_message)
            raise ValueError(error_message)

        # Create a temporary directory for archive creation
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create the tar file in the temporary directory
            timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
            parent_dir = os.path.commonpath(capture_files)
            archive_filename = f"{parent_dir.split('/')[-1][:30]}_{timestamp}.tar.gz"
            temp_archive_path = Path(temp_dir) / archive_filename

            # Create the tar archive in the temporary directory
            logger.info(f"Creating tar archive in temp directory: {temp_archive_path}")
            with tarfile.open(temp_archive_path, "w:gz") as tf:
                tf.add(parent_dir, arcname=parent_dir.split("/")[-1])

            # Create the final destination directory
            # final_archive_path = (
            #     Path("/app/jobs/job_files/zip") / str(user.uuid) / archive_filename
            # )
            final_archive_path = Path(settings.MEDIA_ROOT)
            # final_archive_path.parent.mkdir(exist_ok=True)

            # Move the archive file to its final location
            logger.info(f"Moving tar archive to final location: {final_archive_path}")
            shutil.move(str(temp_archive_path), str(final_archive_path))

        config = {
            "width": width,
            "height": height,
            "capture_type": CaptureType.DigitalRF,
        }

        # Submit the job with the archive file
        return request_job_submission(
            visualization_type="spectrogram",
            owner=user,
            local_files=[archive_filename],
            config=config,
        )
