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
    def extract_timestamp(file: UploadedFile) -> datetime | None:
        """Extract timestamp from capture file.

        Args:
            file: The uploaded capture file

        Returns:
            datetime: The extracted timestamp if found, None otherwise
        """
