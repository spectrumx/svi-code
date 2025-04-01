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

    @staticmethod
    @abstractmethod
    def get_capture_name(files: list[UploadedFile], name: str | None) -> str:
        """Return name for capture being created. This may be inferred from the
        files or provided by the user, with extra processing sometimes necessary.

        Args:
            files: The uploaded capture files
            name: The requested name for the capture, if provided

        Returns:
            str: The inferred capture name
        """
