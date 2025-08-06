import logging
import mimetypes
import re
import zipfile
from dataclasses import dataclass
from datetime import UTC
from datetime import datetime
from pathlib import Path

import h5py
from digital_rf import DigitalRFReader
from django.core.files.uploadedfile import UploadedFile

from .base import CaptureUtility

logger = logging.getLogger(__name__)

# Constants for DigitalRF processing
SAMPLES_PER_SLICE = 1024  # Number of samples per waterfall slice


@dataclass
class DigitalRFContext:
    """Context object containing DigitalRF reader and channel information."""

    reader: DigitalRFReader
    channel: str
    sample_rate: float
    center_freq: float
    start_sample: int
    end_sample: int
    device_name: str | None = None
    gain: float | None = None
    comments: str | None = None


@dataclass
class ProcessingConfig:
    """Configuration for DigitalRF processing."""

    fft_size: int = 1024
    samples_per_slice: int = SAMPLES_PER_SLICE
    start_idx: int | None = None
    end_idx: int | None = None


@dataclass
class FrequencyRange:
    """Frequency range information."""

    min_frequency: float
    max_frequency: float
    center_frequency: float

    @classmethod
    def from_sample_rate_and_center(
        cls, sample_rate: float, center_freq: float
    ) -> "FrequencyRange":
        """Create frequency range from sample rate and center frequency."""
        min_freq = center_freq - sample_rate / 2
        max_freq = center_freq + sample_rate / 2
        return cls(min_freq, max_freq, center_freq)


class DigitalRFUtility(CaptureUtility):
    """Utility for DigitalRF capture type operations.

    Provides utilities for processing and extracting information from DigitalRF files.
    DigitalRF files typically consist of a directory structure with metadata and data files.
    """

    @staticmethod
    def extract_timestamp(files: list[UploadedFile]) -> datetime | None:
        """Extract timestamp from DigitalRF files.

        The DigitalRF files are expected to be in a zip archive containing directories
        with timestamps in the format '2024-06-27T14-00-00'. Each directory contains
        files with names like 'rf@1719499740.000.h5' where the number before the decimal
        is UNIX seconds and the three digits after are milliseconds.

        Args:
            files: The uploaded DigitalRF files

        Returns:
            datetime: The extracted timestamp if found, None otherwise
        """
        if not files:
            logger.warning("No files provided for timestamp extraction")
            return None

        # DigitalRF files are expected to be a single zip archive
        zip_file = next((f for f in files if f.name.endswith(".zip")), None)
        if not zip_file:
            logger.warning("No zip archive found in DigitalRF files")
            return None

        earliest_timestamp: datetime | None = None
        timestamp_pattern = re.compile(r"rf@(\d+)\.(\d+)\.h5")

        try:
            with zipfile.ZipFile(zip_file, "r") as zf:
                for name in zf.namelist():
                    # Look for files matching the timestamp pattern
                    match = timestamp_pattern.search(name)
                    if match:
                        seconds = int(match.group(1))
                        milliseconds = int(match.group(2))
                        # Convert to microseconds for datetime
                        microseconds = milliseconds * 1000
                        current_timestamp = datetime.fromtimestamp(
                            seconds, tz=UTC
                        ).replace(microsecond=microseconds)

                        if (
                            earliest_timestamp is None
                            or current_timestamp < earliest_timestamp
                        ):
                            earliest_timestamp = current_timestamp

        except (zipfile.BadZipFile, ValueError) as e:
            logger.error(f"Error processing DigitalRF zip archive: {e}")
            return None

        if earliest_timestamp is None:
            logger.warning("No valid timestamps found in DigitalRF files")

        return earliest_timestamp

    @staticmethod
    def get_media_type(file: UploadedFile) -> str:
        """Get the media type for a DigitalRF file.

        Args:
            file: The uploaded DigitalRF file

        Returns:
            str: The media type for the DigitalRF file
        """
        if file.name.endswith(".zip"):
            return "application/zip"
        if file.name.endswith(".h5"):
            return "application/x-hdf5"
        media_type, _ = mimetypes.guess_type(file.name)
        if media_type is None:
            media_type = "application/octet-stream"

        return media_type

    @staticmethod
    def get_capture_name(files: list[UploadedFile], name: str | None) -> str:
        """Infer the capture name from the files.

        Args:
            files: The uploaded DigitalRF files
            name: The requested name for the capture

        Returns:
            str: The inferred capture name

        Raises:
            ValueError: If the required DigitalRF files are not found
        """
        if name:
            return name

        # Use the file name (without extension) as the capture name
        return ".".join(files[0].name.split(".")[:-1])

    @staticmethod
    def get_frequency_range(drf_data_path: str) -> tuple[float, float]:
        """Get the frequency range for a DigitalRF capture.

        Args:
            drf_data_path: Path to the DigitalRF data directory

        Returns:
            tuple[float, float]: The frequency range (min_freq, max_freq)

        Raises:
            ValueError: If the frequency range cannot be determined
        """
        try:
            context = DigitalRFUtility._create_context(drf_data_path)
            freq_range = FrequencyRange.from_sample_rate_and_center(
                context.sample_rate, context.center_freq
            )
            return (freq_range.min_frequency, freq_range.max_frequency)
        except Exception as e:
            error_message = f"Error getting frequency range for DigitalRF data: {e}"
            logger.error(error_message)
            raise ValueError(error_message)

    @staticmethod
    def _create_context(drf_data_path: str) -> DigitalRFContext:
        """Create a DigitalRF context object.

        Args:
            drf_data_path: Path to the DigitalRF data directory

        Returns:
            DigitalRFContext: Context object with reader and metadata

        Raises:
            ValueError: If required fields are missing or invalid
        """
        reader = DigitalRFReader(drf_data_path)
        channels = reader.get_channels()

        if not channels:
            error_message = "No channels found in DigitalRF data"
            logger.error(error_message)
            raise ValueError(error_message)

        channel = channels[0]
        start_sample, end_sample = reader.get_bounds(channel)

        # Get metadata from DigitalRF properties
        drf_props_path = f"{drf_data_path}/{channel}/drf_properties.h5"
        with h5py.File(drf_props_path, "r") as f:
            sample_rate = (
                f.attrs["sample_rate_numerator"] / f.attrs["sample_rate_denominator"]
            )

        # Try to get additional metadata using DigitalRFReader's read_metadata method
        device_name = None
        gain = None
        comments = None
        center_freq = None

        # Get metadata for the first sample range
        metadata_dict = DigitalRFUtility._extract_metadata(
            reader, channel, start_sample, min(1000, end_sample - start_sample)
        )

        # Extract metadata from the dictionary
        device_name = metadata_dict.get("device_name")
        gain = metadata_dict.get("gain")
        comments = metadata_dict.get("comments")
        center_freq = metadata_dict.get("center_freq")

        return DigitalRFContext(
            reader=reader,
            channel=channel,
            sample_rate=sample_rate,
            center_freq=center_freq,
            start_sample=start_sample,
            end_sample=end_sample,
            device_name=device_name,
            gain=gain,
            comments=comments,
        )

    @staticmethod
    def _extract_metadata(
        reader: DigitalRFReader, channel: str, start_sample: int, num_samples: int
    ) -> dict:
        """Extract metadata using DigitalRFReader's read_metadata method.

        Args:
            reader: DigitalRFReader instance
            channel: Channel name
            start_sample: Starting sample index
            num_samples: Number of samples to read metadata for

        Returns:
            dict: Dictionary containing extracted metadata
        """
        metadata = {}

        try:
            # Use the reader's read_metadata method to get metadata for the sample range
            metadata_samples = reader.read_metadata(
                start_sample=start_sample,
                end_sample=start_sample + num_samples,
                channel_name=channel,
            )

            # Extract metadata from the first available sample
            for sample_metadata in metadata_samples.values():
                logger.info(f"sample_metadata: {sample_metadata}")
                if sample_metadata:
                    # Extract common metadata fields
                    for key, value in sample_metadata.items():
                        logger.info(f"key: {key}, value: {value}")
                        if key == "center_frequencies":
                            metadata["center_freq"] = value[0]
                        if key == "receiver":
                            metadata["device_name"] = value.get("id")
                            metadata["gain"] = value.get("gain")
                            metadata["comments"] = value.get("description")
                    # Only need metadata from the first sample
                    break

        except Exception as e:
            logger.error(f"Could not read metadata using DigitalRFReader: {e}")

        return metadata

    @staticmethod
    def get_total_slices_from_zip(
        zip_file: zipfile.ZipFile,
        capture_ids: list[str],
        samples_per_slice: int = SAMPLES_PER_SLICE,
    ) -> int:
        """Calculate the total number of slices available in a DigitalRF capture from ZIP.

        Args:
            zip_file: ZIP file containing DigitalRF data
            capture_ids: List of capture IDs to process (only one capture supported)
            samples_per_slice: Number of samples per slice

        Returns:
            int: Total number of slices available

        Raises:
            ValueError: If required fields are missing or invalid
        """
        # We only support one capture per visualization
        capture_id = capture_ids[0]
        capture_dir = f"{capture_id}/"

        # Find the DigitalRF data directory
        for file_info in zip_file.infolist():
            if file_info.filename.startswith(
                capture_dir
            ) and file_info.filename.endswith("drf_properties.h5"):
                # Extract the DigitalRF data to a temporary directory
                import os
                import shutil
                import tempfile

                with tempfile.TemporaryDirectory() as temp_dir:
                    # Extract all files for this capture
                    for extract_info in zip_file.infolist():
                        if extract_info.filename.startswith(capture_dir):
                            # Create the directory structure
                            file_path = (
                                Path(temp_dir)
                                / extract_info.filename[len(capture_dir) :]
                            )
                            file_path.parent.mkdir(parents=True, exist_ok=True)

                            # Extract the file
                            with (
                                zip_file.open(extract_info) as source,
                                open(file_path, "wb") as target,
                            ):
                                shutil.copyfileobj(source, target)

                    # Find the DigitalRF root directory (parent of the channel directory)
                    for root, _dirs, files in os.walk(temp_dir):
                        if "drf_properties.h5" in files:
                            drf_data_path = str(Path(root).parent)
                            break

                    if drf_data_path:
                        try:
                            context = DigitalRFUtility._create_context(drf_data_path)
                            total_samples = context.end_sample - context.start_sample
                            total_slices = total_samples // samples_per_slice
                            return max(1, total_slices)  # Ensure at least 1 slice

                        except Exception as e:
                            error_message = f"Error calculating total slices for DigitalRF data: {e}"
                            logger.error(error_message)
                            raise ValueError(error_message)

                    break  # Only process the first drf_properties.h5 file

        error_message = "No waterfall data found for total slices calculation"
        logger.error(error_message)
        raise ValueError(error_message)

    @staticmethod
    def get_total_slices(
        user, capture_ids: list[str], samples_per_slice: int = SAMPLES_PER_SLICE
    ) -> int:
        """Get total slices for DigitalRF captures from SDS post-processed metadata.

        This method gets the total slice count from the SDS post-processed waterfall
        metadata.

        Args:
            user: The user object
            capture_ids: List of capture IDs to process (only one capture supported)
            samples_per_slice: Number of samples per slice (unused, for compatibility)

        Returns:
            int: Total number of slices available

        Raises:
            ValueError: If capture is not found, has no post-processed data, or API call fails
        """
        import requests
        from django.conf import settings

        # We only support one capture per visualization
        capture_id = capture_ids[0]

        try:
            # Get the user's SDS token
            token = user.sds_token

            # Make HTTP request to the new SDS metadata endpoint
            protocol = "http" if settings.USE_LOCAL_SDS else "https"
            sds_url = f"{protocol}://{settings.SDS_CLIENT_URL}/api/latest/assets/captures/{capture_id}/get_post_processed_metadata/?processing_type=waterfall"

            response = requests.get(
                sds_url,
                headers={"Authorization": f"Api-Key: {token}"},
                timeout=10,
            )

            if response.status_code == 404:
                raise ValueError(
                    f"No post-processed waterfall data found for capture {capture_id}. "
                    "Please ensure post-processing has been completed."
                )
            if response.status_code != 200:
                raise ValueError(
                    f"Failed to get post-processed metadata: {response.status_code} - {response.text}"
                )

            # Parse the response and extract total_slices from metadata
            metadata_response = response.json()
            metadata = metadata_response.get("metadata", {})
            total_slices = metadata.get("total_slices")

            if total_slices is None:
                raise ValueError(
                    f"No total_slices found in post-processed metadata for capture {capture_id}"
                )

            return int(total_slices)

        except requests.RequestException as e:
            raise ValueError(f"Failed to fetch post-processed metadata from SDS: {e}")
        except (KeyError, AttributeError) as e:
            raise ValueError(f"Invalid response format from SDS metadata endpoint: {e}")
