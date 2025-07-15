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
    def get_frequency_range(file: UploadedFile) -> tuple[float, float]:
        """Get the frequency range for a RadioHound file.

        Args:
            file: The uploaded RadioHound file

        Returns:
            tuple[float, float]: The frequency range for the file

        Raises:
            ValueError: If the file is not a RadioHound file
        """
        if not file.name.endswith(RadioHoundUtility.file_extensions):
            error_message = f"File {file.name} is not a RadioHound file"
            logger.error(error_message)
            raise ValueError(error_message)

        data = json.load(file)
        metadata = data["metadata"]
        min_freq = metadata["fmin"]
        max_freq = metadata["fmax"]

        if min_freq is None or max_freq is None:
            error_message = f"File {file.name} does not contain frequency range"
            logger.error(error_message)
            raise ValueError(error_message)

        return (min_freq, max_freq)

    @staticmethod
    def get_media_type(file: UploadedFile) -> str:  # noqa: ARG004
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

    @staticmethod
    def get_total_slices(user, capture_ids: list[str]) -> int:
        """Calculate total slices for RadioHound captures from SDS.

        This method handles the entire process of getting capture info from SDS
        and calculating total slices without downloading files.

        Args:
            user: The user object
            capture_ids: List of capture IDs to process (only one capture supported)

        Returns:
            int: Total number of slices available

        Raises:
            ValueError: If capture is not found or has no files
        """
        from spectrumx_visualization_platform.spx_vis.source_utils.sds import (
            get_sds_captures,
        )

        # Get SDS captures info without downloading files
        sds_captures, sds_errors = get_sds_captures(user, capture_ids)
        if sds_errors:
            raise ValueError(f"Error getting SDS captures: {sds_errors}")

        # We only support one capture per visualization
        capture_id = capture_ids[0]
        capture = next(
            (c for c in sds_captures if str(c["uuid"]) == str(capture_id)), None
        )

        if capture is None:
            raise ValueError(f"Capture ID {capture_id} not found in SDS")

        files = capture.get("files", [])
        if not files:
            raise ValueError(f"No files found for capture ID {capture_id}")

        # Use the RadioHound utility to calculate total slices
        return len(files)

    @staticmethod
    def to_waterfall_file(rh_data: dict) -> dict:
        """Convert RadioHound data to WaterfallFile format.

        Args:
            rh_data: Dictionary containing RadioHound file data

        Returns:
            dict: Data in WaterfallFile format

        Raises:
            ValueError: If required fields are missing or invalid
        """
        try:
            metadata = rh_data.get("metadata", {})

            waterfall_file = RadioHoundUtility._get_required_waterfall_fields(
                rh_data, metadata
            )
            waterfall_file.update(
                RadioHoundUtility._get_extra_waterfall_fields(rh_data, metadata)
            )

            return waterfall_file

        except Exception as e:
            error_message = (
                f"Error converting RadioHound data to WaterfallFile format: {e}"
            )
            logger.error(error_message)
            raise ValueError(error_message)

    @staticmethod
    def _get_required_waterfall_fields(rh_data: dict, metadata: dict) -> dict:
        """Extract required fields from RadioHound data.

        Args:
            rh_data: Dictionary containing RadioHound file data
            metadata: Dictionary containing RadioHound metadata

        Returns:
            dict: Required fields in WaterfallFile format
        """
        required_fields = {
            "data": rh_data.get("data", ""),
            "data_type": rh_data.get("type", ""),
            "timestamp": rh_data.get("timestamp", ""),
            "min_frequency": metadata.get("fmin"),
            "max_frequency": metadata.get("fmax"),
            "num_samples": metadata.get("nfft"),
            "sample_rate": rh_data.get("sample_rate"),
            "mac_address": rh_data.get("mac_address", ""),
        }
        missing_fields = []
        for field, value in required_fields.items():
            if value is None or value == "":
                missing_fields.append(field)

        if missing_fields:
            raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

        return required_fields

    @staticmethod
    def _get_extra_waterfall_fields(rh_data: dict, metadata: dict) -> dict:
        """Extract optional and custom fields from RadioHound data.

        Args:
            rh_data: Dictionary containing RadioHound file data
            metadata: Dictionary containing RadioHound metadata

        Returns:
            dict: Additional fields in WaterfallFile format
        """
        additional_fields = {}
        requested = rh_data.get("requested", {})

        # Optional fields
        if "center_frequency" in rh_data:
            additional_fields["center_frequency"] = rh_data["center_frequency"]
        if "short_name" in rh_data:
            additional_fields["device_name"] = rh_data["short_name"]

        # Custom fields
        custom_fields = {}
        if "fmin" in requested or "fmax" in requested:
            custom_fields["requested"] = {}
            if "fmin" in requested:
                custom_fields["requested"]["min_frequency"] = requested["fmin"]
            if "fmax" in requested:
                custom_fields["requested"]["max_frequency"] = requested["fmax"]

        for field in ["scan_time", "gain", "gps_lock", "name", "comments"]:
            if field in metadata:
                key = "job_name" if field == "name" else field
                custom_fields[key] = metadata[field]

        if custom_fields:
            additional_fields["custom_fields"] = custom_fields

        return additional_fields
