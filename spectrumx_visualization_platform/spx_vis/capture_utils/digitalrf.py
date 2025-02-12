import logging
import mimetypes
from datetime import datetime

from django.core.files.uploadedfile import UploadedFile

from .base import CaptureUtility

logger = logging.getLogger(__name__)


class DigitalRFUtility(CaptureUtility):
    """Utility for DigitalRF capture type operations.

    Provides utilities for processing and extracting information from DigitalRF files.
    """

    @staticmethod
    def extract_timestamp(file: UploadedFile) -> datetime | None:
        """Extract timestamp from DigitalRF file.

        Args:
            file: The uploaded DigitalRF file

        Returns:
            datetime: The extracted timestamp if found, None otherwise
        """
        # TODO: Implement DigitalRF timestamp extraction
        # This would depend on the specific format of your DigitalRF files
        logger.warning("DigitalRF format not yet supported")
        return None

    @staticmethod
    def get_media_type(file: UploadedFile) -> str:
        """Get the media type for a DigitalRF file.

        Returns:
            str: The media type for the DigitalRF file
        """
        media_type, _ = mimetypes.guess_type(file.name)
        if media_type is None:
            media_type = "application/octet-stream"
        return media_type
