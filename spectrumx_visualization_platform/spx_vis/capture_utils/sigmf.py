import json
import logging
import mimetypes
from datetime import datetime

from django.core.files.uploadedfile import UploadedFile

from jobs.submission import request_job_submission

from .base import CaptureUtility

logger = logging.getLogger(__name__)


class SigMFUtility(CaptureUtility):
    """Utility for SigMF capture type operations.

    Provides utilities for processing and extracting information from SigMF files.
    """

    @staticmethod
    def extract_timestamp(files: list[UploadedFile]) -> datetime | None:
        """Extract timestamp from SigMF metadata file.

        Args:
            meta_file: The uploaded SigMF metadata file

        Returns:
            datetime: The extracted timestamp if found, None otherwise
        """
        meta_file = next((f for f in files if f.name.endswith(".sigmf-meta")), None)

        if not meta_file:
            return None
        try:
            meta_content = json.load(meta_file)
            # Get the first capture segment's datetime
            capture_time: str = meta_content["captures"][0]["core:datetime"]

            if capture_time:
                return datetime.fromisoformat(capture_time)
            return None

        except (json.JSONDecodeError, KeyError, IndexError, ValueError) as e:
            logger.error(f"Error extracting timestamp from SigMF metadata: {e}")
            return None

    @staticmethod
    def get_media_type(file: UploadedFile) -> str:
        """Get the media type for a SigMF file.

        Returns:
            str: The media type for the SigMF file
        """
        if file.name.endswith(".sigmf-meta"):
            media_type = "application/json"
        elif file.name.endswith(".sigmf-data"):
            media_type = "application/octet-stream"
        else:
            media_type, _ = mimetypes.guess_type(file.name)
            if media_type is None:
                media_type = "application/octet-stream"

        return media_type

    @staticmethod
    def submit_spectrogram_job(user, capture_files, width=10, height=10):
        """Get the SigMF data and metadata files needed for spectrogram generation.

        Args:
            capture_files: QuerySet of File objects associated with the capture

        Returns:
            Job: The submitted job

        Raises:
            ValueError: If the required SigMF files are not found
        """
        data_file = capture_files.filter(name__endswith=".sigmf-data").first()
        meta_file = capture_files.filter(name__endswith=".sigmf-meta").first()

        if not data_file or not meta_file:
            error_message = "Required SigMF files (data and/or metadata) not found"
            logger.error(error_message)
            raise ValueError(error_message)

        dimensions = {"width": width, "height": height}

        return request_job_submission(
            visualization_type="spectrogram",
            owner=user,
            local_files=[data_file.file.name, meta_file.file.name],
            config=dimensions,
        )
