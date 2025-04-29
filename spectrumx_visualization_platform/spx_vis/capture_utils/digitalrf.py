import logging
import mimetypes
from datetime import datetime
from pathlib import Path

from django.core.files.uploadedfile import UploadedFile

from jobs.submission import request_job_submission

from .base import CaptureUtility

logger = logging.getLogger(__name__)


class DigitalRFUtility(CaptureUtility):
    """Utility for DigitalRF capture type operations.

    Provides utilities for processing and extracting information from DigitalRF files.
    DigitalRF files typically consist of a directory structure with metadata and data files.
    """

    @staticmethod
    def extract_timestamp(files: list[UploadedFile]) -> datetime | None:
        """Extract timestamp from DigitalRF metadata file.

        Args:
            files: The uploaded DigitalRF files

        Returns:
            datetime: The extracted timestamp if found, None otherwise
        """
        # DigitalRF typically stores metadata in a metadata.h5 file
        meta_file = next((f for f in files if f.name.endswith("metadata.h5")), None)

        if not meta_file:
            return None

        try:
            # TODO: Implement actual DigitalRF metadata parsing
            # This would require the digital_rf package to read the HDF5 metadata
            # For now, we'll return None as a placeholder
            return None

        except Exception as e:
            logger.error(f"Error extracting timestamp from DigitalRF metadata: {e}")
            return None

    @staticmethod
    def get_media_type(file: UploadedFile) -> str:
        """Get the media type for a DigitalRF file.

        Args:
            file: The uploaded DigitalRF file

        Returns:
            str: The media type for the DigitalRF file
        """
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

        # DigitalRF typically has a metadata.h5 file
        meta_file = next((f for f in files if f.name.endswith("metadata.h5")), None)
        if not meta_file:
            error_message = "Required DigitalRF metadata file not found"
            logger.error(error_message)
            raise ValueError(error_message)

        # Use the directory name as the capture name
        return str(Path(meta_file.name).parent)

    @staticmethod
    def submit_spectrogram_job(user, capture_files, width=10, height=10):
        """Get the DigitalRF data and metadata files needed for spectrogram generation.

        Args:
            capture_files: QuerySet of File objects associated with the capture
            width: Width of the spectrogram in inches
            height: Height of the spectrogram in inches

        Returns:
            Job: The submitted job

        Raises:
            ValueError: If the required DigitalRF files are not found
        """
        # DigitalRF typically requires the metadata.h5 file and the data directory
        meta_file = capture_files.filter(name__endswith="metadata.h5").first()
        data_dir = next((f for f in capture_files if f.name.endswith("/")), None)

        if not meta_file or not data_dir:
            error_message = (
                "Required DigitalRF files (metadata and/or data directory) not found"
            )
            logger.error(error_message)
            raise ValueError(error_message)

        dimensions = {"width": width, "height": height}

        return request_job_submission(
            visualization_type="spectrogram",
            owner=user,
            local_files=[meta_file.file.name, data_dir.file.name],
            config=dimensions,
        )
