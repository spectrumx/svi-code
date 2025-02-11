"""Utilities for extracting timestamps from different capture file formats."""

import json
from datetime import datetime

from django.core.files.uploadedfile import UploadedFile


def extract_radiohound_timestamp(rh_file: UploadedFile) -> datetime | None:
    """Extract the timestamp from a RadioHound JSON file.

    Args:
        rh_file: The uploaded RadioHound file

    Returns:
        datetime: The extracted timestamp or None if not found

    Raises:
        json.JSONDecodeError: If file is not valid JSON
    """
    try:
        data = json.load(rh_file)
        timestamp: str = data.get("timestamp")
        if timestamp:
            return datetime.fromisoformat(timestamp)
        return None
    except (json.JSONDecodeError, ValueError):
        # Log error here
        return None


def extract_sigmf_timestamp(meta_file: UploadedFile) -> datetime | None:
    """Extract the timestamp from a SigMF metadata file.

    Args:
        meta_file: The uploaded SigMF metadata file

    Returns:
        datetime: The extracted timestamp or None if not found

    Raises:
        json.JSONDecodeError: If metadata file is not valid JSON
        KeyError: If required metadata fields are missing
    """
    try:
        meta_content = json.load(meta_file)
        # Get the first capture segment's datetime
        capture_time: str = meta_content["captures"][0]["core:datetime"]
        if capture_time:
            return datetime.fromisoformat(capture_time)
        return None
    except (json.JSONDecodeError, KeyError, IndexError, ValueError):
        # Log error here
        return None


# def extract_digitalrf_timestamp(drf_file: UploadedFile) -> Optional[datetime]:
#     """Extract the timestamp from a DigitalRF file.

#     Args:
#         drf_file: The uploaded DigitalRF file

#     Returns:
#         datetime: The extracted timestamp or None if not found

#     Raises:
#         digitalrf.DigitalRFError: If file is not valid DigitalRF format
#     """
#     try:
#         # Save file temporarily since DigitalRF needs file path
#         temp_path = Path("/tmp") / drf_file.name
#         with open(temp_path, "wb") as f:
#             f.write(drf_file.read())

#         drf_reader = digitalrf.DigitalRFReader(str(temp_path))
#         start_time = drf_reader.get_bounds("ch0")[0]  # Get first channel start time
#         return datetime.fromtimestamp(start_time, tz=datetime.UTC)
#     except Exception as e:
#         # Log error here
#         return None
#     finally:
#         temp_path.unlink(missing_ok=True)  # Clean up temp file
#         drf_file.seek(0)  # Reset file pointer
