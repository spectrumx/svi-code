from abc import ABC
from abc import abstractmethod
from datetime import datetime

from django.core.files.uploadedfile import UploadedFile


class CaptureUtility(ABC):
    """Abstract base class for capture type utilities.

    Defines the interface that all capture type utilities must implement.
    """

    @staticmethod
    @abstractmethod
    def extract_timestamp(files: list[UploadedFile]) -> datetime | None:
        """Extract timestamp from capture file.

        Args:
            files: The uploaded capture files

        Returns:
            datetime: The extracted timestamp if found, None otherwise
        """

    @staticmethod
    @abstractmethod
    def get_media_type(file: UploadedFile) -> str:
        """Get the media type for a capture file.

        Args:
            file: The uploaded capture file

        Returns:
            str: The media type for the capture file
        """
