import json
import logging
from datetime import datetime

from django.core.files.uploadedfile import UploadedFile

from .base import CaptureUtility

logger = logging.getLogger(__name__)


class SigMFUtility(CaptureUtility):
    """Utility for SigMF capture type operations.

    Provides utilities for processing and extracting information from SigMF files.
    """

    @staticmethod
    def extract_timestamp(meta_file: UploadedFile) -> datetime | None:
        """Extract timestamp from SigMF metadata file.

        Args:
            meta_file: The uploaded SigMF metadata file

        Returns:
            datetime: The extracted timestamp if found, None otherwise
        """
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
