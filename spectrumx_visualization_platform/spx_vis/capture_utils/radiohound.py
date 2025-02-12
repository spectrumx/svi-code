import json
import logging
import mimetypes
from datetime import datetime

from django.core.files.uploadedfile import UploadedFile

from .base import CaptureUtility

logger = logging.getLogger(__name__)


class RadioHoundUtility(CaptureUtility):
    """Utility for RadioHound capture type operations.

    Provides utilities for processing and extracting information from RadioHound files.
    """

    file_extensions = (".json", ".rh", ".rh.json")

    @staticmethod
    def extract_timestamp(files: list[UploadedFile]) -> datetime | None:
        """Extract timestamp from RadioHound JSON file.

        Args:
            json_file: The uploaded RadioHound JSON file

        Returns:
            datetime: The extracted timestamp if found, None otherwise
        """
        # Find the first file with a valid RadioHound extension
        json_file = next(
            (f for f in files if f.name.endswith(RadioHoundUtility.file_extensions)),
            None,
        )

        if not json_file:
            return None
        try:
            data = json.load(json_file)
            timestamp: str = data.get("timestamp")

            if timestamp:
                return datetime.fromisoformat(timestamp)
            return None

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error(f"Error extracting timestamp from RadioHound file: {e}")
            return None

    @staticmethod
    def get_media_type(file: UploadedFile) -> str:
        """Get the media type for a RadioHound file.

        Args:
            file: The uploaded RadioHound file

        Returns:
            str: The media type for the RadioHound file
        """
        if file.name.endswith(RadioHoundUtility.file_extensions):
            return "application/json"

        media_type, _ = mimetypes.guess_type(file.name)
        if media_type is None:
            media_type = "application/octet-stream"
        return media_type
