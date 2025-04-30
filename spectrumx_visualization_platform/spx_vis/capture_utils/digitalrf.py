import logging
import mimetypes
import re
import zipfile
from datetime import UTC
from datetime import datetime
from pathlib import Path

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
        """Get the DigitalRF data and metadata files needed for spectrogram generation.

        Args:
            capture_files: List of file paths
            width: Width of the spectrogram in inches
            height: Height of the spectrogram in inches

        Returns:
            Job: The submitted job

        Raises:
            ValueError: If the required DigitalRF files are not found
        """
        # Find the metadata file and data directories
        meta_file = None
        data_dirs = []

        for f in capture_files:
            if f.endswith("/"):
                data_dirs.append(f)
            elif f.endswith("metadata.h5"):
                meta_file = f

        if not meta_file:
            error_message = "Required DigitalRF metadata file not found"
            logger.error(error_message)
            raise ValueError(error_message)

        if not data_dirs:
            error_message = "No data directories found in DigitalRF files"
            logger.error(error_message)
            raise ValueError(error_message)

        config = {
            "width": width,
            "height": height,
            "capture_type": CaptureType.DigitalRF,
        }

        # Get all HDF5 files from all data directories
        local_files = [meta_file]
        for data_dir in data_dirs:
            data_dir_path = Path(data_dir)
            if not data_dir_path.exists():
                error_message = f"Data directory {data_dir} does not exist"
                logger.error(error_message)
                raise ValueError(error_message)

            # Get all HDF5 files in the data directory
            h5_files = [str(f) for f in data_dir_path.glob("**/*.h5")]
            if not h5_files:
                error_message = f"No HDF5 files found in data directory {data_dir}"
                logger.error(error_message)
                raise ValueError(error_message)

            local_files.extend(h5_files)

        return request_job_submission(
            visualization_type="spectrogram",
            owner=user,
            local_files=local_files,
            config=config,
        )
