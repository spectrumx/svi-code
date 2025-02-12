import json
import logging
from datetime import datetime

from django.core.files.uploadedfile import UploadedFile

from .base import CaptureUtility

logger = logging.getLogger(__name__)


class RadioHoundUtility(CaptureUtility):
    """Utility for RadioHound capture type operations.

    Provides utilities for processing and extracting information from RadioHound files.
    """

    @staticmethod
    def extract_timestamp(json_file: UploadedFile) -> datetime | None:
        """Extract timestamp from RadioHound JSON file.

        Args:
            json_file: The uploaded RadioHound JSON file

        Returns:
            datetime: The extracted timestamp if found, None otherwise
        """
        try:
            data = json.load(json_file)
            timestamp: str = data.get("timestamp")

            if timestamp:
                return datetime.fromisoformat(timestamp)
            return None

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error(f"Error extracting timestamp from RadioHound file: {e}")
            return None
