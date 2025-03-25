import json
import logging
from datetime import datetime

from django.core.files.uploadedfile import UploadedFile

from .base import CaptureUtility

logger = logging.getLogger(__name__)


class RadioHoundUtility(CaptureUtility):
    """Utility for RadioHound capture type operations.

    Provides utilities for processing and extracting information from RadioHound files.
    Each RadioHound file is a self-contained JSON file containing both metadata and data.
    Multiple RadioHound files can be grouped together to form a single capture.
    """

    file_extensions = (".json", ".rh")

    @staticmethod
    def extract_timestamp(files: list[UploadedFile]) -> datetime | None:
        """Extract timestamp from RadioHound JSON files.

        Finds the earliest timestamp from all RadioHound JSON files in the set.
        If no valid timestamps are found or files cannot be parsed, returns None.

        Args:
            files: List of uploaded RadioHound JSON files

        Returns:
            Optional[datetime]: The earliest timestamp found, None otherwise
        """
        if not files:
            logger.warning("No files provided for timestamp extraction")
            return None

        oldest_timestamp: datetime | None = None

        for file in files:
            if not file.name.endswith(RadioHoundUtility.file_extensions):
                logger.warning(f"File {file.name} is not a RadioHound JSON file")
                continue

            try:
                data = json.load(file)
                timestamp_str: str = data.get("timestamp")

                if timestamp_str:
                    current_timestamp = datetime.fromisoformat(timestamp_str)
                    if oldest_timestamp is None or current_timestamp < oldest_timestamp:
                        oldest_timestamp = current_timestamp
                else:
                    logger.warning(
                        f"No timestamp found in RadioHound file: {file.name}"
                    )

            except (json.JSONDecodeError, KeyError, ValueError) as e:
                logger.error(
                    f"Error extracting timestamp from RadioHound file {file.name}: {e}"
                )
                continue

        if oldest_timestamp is None:
            logger.warning("No valid timestamps found in any RadioHound files")

        return oldest_timestamp

    @staticmethod
    def get_media_type(file: UploadedFile) -> str:
        """Get the media type for a RadioHound file.

        Args:
            file: The uploaded RadioHound file

        Returns:
            str: The media type for the file (always application/json)
        """
        return "application/json"

    @staticmethod
    def get_capture_name(files: list[UploadedFile], name: str | None = None) -> str:
        """Generate a name for the RadioHound capture.

        If a name is provided, uses that. Otherwise, generates a name based on the first file.
        Returns a single-item list since we create one capture per set of files.

        Args:
            files: The uploaded RadioHound JSON files
            name: Optional name to use for the capture

        Returns:
            str: The inferred capture name

        Raises:
            ValueError: If no valid RadioHound files are found
        """
        if not files:
            error_message = "Cannot generate capture name: no files provided"
            logger.error(error_message)
            raise ValueError(error_message)

        if name:
            return name

        # Use the file name (without extension) as the capture name
        return ".".join(files[0].name.split(".")[:-1])
