import base64
import logging
import mimetypes
import re
import zipfile
from dataclasses import dataclass
from datetime import UTC
from datetime import datetime

import h5py
import numpy as np
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
            raise ValueError("No channels found in DigitalRF data")

        channel = channels[0]
        start_sample, end_sample = reader.get_bounds(channel)

        # Get metadata from DigitalRF properties
        drf_props_path = f"{drf_data_path}/{channel}/drf_properties.h5"
        with h5py.File(drf_props_path, "r") as f:
            sample_rate = (
                f.attrs["sample_rate_numerator"] / f.attrs["sample_rate_denominator"]
            )
            center_freq = f.attrs.get("center_freq", 0)

        return DigitalRFContext(
            reader=reader,
            channel=channel,
            sample_rate=sample_rate,
            center_freq=center_freq,
            start_sample=start_sample,
            end_sample=end_sample,
        )

    @staticmethod
    def to_waterfall_file(
        drf_data_path: str,
        fft_size: int = 1024,
        start_idx: int | None = None,
        end_idx: int | None = None,
        samples_per_slice: int = SAMPLES_PER_SLICE,
    ) -> list[dict]:
        """Convert DigitalRF data to WaterfallFile format.

        This method reads DigitalRF data, performs FFT processing, and converts
        it to the standardized WaterfallFile format used by the frontend.

        Args:
            drf_data_path: Path to the DigitalRF data directory
            fft_size: FFT size for processing (default: 1024)
            start_idx: Start index for the sliding window (default: None, uses 0)
            end_idx: End index for the sliding window (default: None, uses last available slice)
            samples_per_slice: Number of samples per waterfall slice (default: 1024)

        Returns:
            list[dict]: List of WaterfallFile objects (may contain single item for single slice)

        Raises:
            ValueError: If required fields are missing or invalid
        """
        try:
            # Create context and configuration
            context = DigitalRFUtility._create_context(drf_data_path)
            config = ProcessingConfig(
                fft_size=fft_size,
                samples_per_slice=samples_per_slice,
                start_idx=start_idx,
                end_idx=end_idx,
            )

            # Calculate frequency range
            freq_range = FrequencyRange.from_sample_rate_and_center(
                context.sample_rate, context.center_freq
            )

            # Calculate total slices and set defaults
            total_samples = context.end_sample - context.start_sample
            total_slices = total_samples // config.samples_per_slice

            if config.start_idx is None:
                config.start_idx = 0
            if config.end_idx is None:
                config.end_idx = total_slices - 1

            # Process the specified slice range
            return DigitalRFUtility._process_window_slices(context, config, freq_range)

        except Exception as e:
            error_message = (
                f"Error converting DigitalRF data to WaterfallFile format: {e}"
            )
            logger.error(error_message)
            raise ValueError(error_message)

    @staticmethod
    def _process_window_slices(
        context: DigitalRFContext,
        config: ProcessingConfig,
        freq_range: FrequencyRange,
    ) -> list[dict]:
        """Process multiple slices of DigitalRF data for a sliding window.

        Args:
            context: DigitalRF context object
            config: Processing configuration
            freq_range: Frequency range information

        Returns:
            list[dict]: List of WaterfallFile format data
        """
        waterfall_files = []

        # Calculate the number of slices to process
        num_slices = config.end_idx - config.start_idx + 1

        for i in range(num_slices):
            # Calculate the sample range for this slice
            slice_start_sample = (
                context.start_sample + (config.start_idx + i) * config.samples_per_slice
            )
            slice_num_samples = min(
                config.samples_per_slice,
                context.end_sample - slice_start_sample,
            )

            if slice_num_samples <= 0:
                break

            # Process this slice
            waterfall_file = DigitalRFUtility._process_single_slice(
                context,
                config,
                freq_range,
                slice_start_sample,
                slice_num_samples,
            )

            waterfall_files.append(waterfall_file)

        return waterfall_files

    @staticmethod
    def _process_single_slice(
        context: DigitalRFContext,
        config: ProcessingConfig,
        freq_range: FrequencyRange,
        slice_start_sample: int,
        slice_num_samples: int,
    ) -> dict:
        """Process a single slice of DigitalRF data.

        Args:
            context: DigitalRF context object
            config: Processing configuration
            freq_range: Frequency range information
            slice_start_sample: Starting sample index for this slice
            slice_num_samples: Number of samples to process for this slice

        Returns:
            dict: WaterfallFile format data
        """
        # Read the data
        data_array = context.reader.read_vector(
            slice_start_sample, slice_num_samples, context.channel, 0
        )

        # Perform FFT processing
        fft_data = np.fft.fft(data_array, n=config.fft_size)
        power_spectrum = np.abs(fft_data) ** 2

        # Convert to dB
        power_spectrum_db = 10 * np.log10(power_spectrum + 1e-12)

        # Convert power spectrum to binary string for transmission
        data_bytes = power_spectrum_db.astype(np.float32).tobytes()
        data_string = base64.b64encode(data_bytes).decode("utf-8")

        # Create timestamp from sample index
        timestamp = datetime.fromtimestamp(
            slice_start_sample / context.sample_rate, tz=UTC
        ).isoformat()

        # Build WaterfallFile format
        waterfall_file = {
            "data": data_string,
            "data_type": "float32",
            "timestamp": timestamp,
            "min_frequency": freq_range.min_frequency,
            "max_frequency": freq_range.max_frequency,
            "num_samples": config.fft_size,
            "sample_rate": context.sample_rate,
            "mac_address": f"drf_{context.channel}_0",
            "center_frequency": freq_range.center_frequency,
            "custom_fields": {
                "num_subchannels": 1,  # Will be updated by caller
                "channel_name": context.channel,
                "subchannel": 0,
                "start_sample": slice_start_sample,
                "num_samples": slice_num_samples,
                "fft_size": config.fft_size,
            },
        }

        return waterfall_file

    @staticmethod
    def get_total_slices(
        drf_data_path: str, samples_per_slice: int = SAMPLES_PER_SLICE
    ) -> int:
        """Calculate the total number of slices available in a DigitalRF capture.

        Args:
            drf_data_path: Path to the DigitalRF data directory
            samples_per_slice: Number of samples per slice

        Returns:
            int: Total number of slices available

        Raises:
            ValueError: If required fields are missing or invalid
        """
        try:
            context = DigitalRFUtility._create_context(drf_data_path)
            total_samples = context.end_sample - context.start_sample
            total_slices = total_samples // samples_per_slice
            return max(1, total_slices)  # Ensure at least 1 slice

        except Exception as e:
            error_message = f"Error calculating total slices for DigitalRF data: {e}"
            logger.error(error_message)
            raise ValueError(error_message)
