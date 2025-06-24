import logging
import mimetypes
import re
import zipfile
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
    def to_waterfall_file(
        drf_data_path: str,
        subchannel: int = 0,
        start_sample: int | None = None,
        num_samples: int | None = None,
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
            subchannel: Subchannel index to process (default: 0)
            start_sample: Starting sample index (default: None, uses first available)
            num_samples: Number of samples to process (default: None, uses available)
            fft_size: FFT size for processing (default: 1024)
            start_idx: Start index for the sliding window (default: None, processes all data)
            end_idx: End index for the sliding window (default: None, processes all data)
            samples_per_slice: Number of samples per waterfall slice (default: 1024)

        Returns:
            list[dict]: List of WaterfallFile objects (may contain single item for single slice)

        Raises:
            ValueError: If required fields are missing or invalid
        """
        try:
            # Initialize DigitalRF reader
            reader = DigitalRFReader(drf_data_path)
            channels = reader.get_channels()

            if not channels:
                raise ValueError("No channels found in DigitalRF data")

            # Use the first channel (or specified channel)
            channel = channels[0]

            # Get sample bounds
            if start_sample is None or num_samples is None:
                start_sample, end_sample = reader.get_bounds(channel)
                if num_samples is None:
                    num_samples = end_sample - start_sample

            # Get metadata from DigitalRF properties
            drf_props_path = f"{drf_data_path}/{channel}/drf_properties.h5"
            with h5py.File(drf_props_path, "r") as f:
                sample_rate = (
                    f.attrs["sample_rate_numerator"]
                    / f.attrs["sample_rate_denominator"]
                )
                center_freq = f.attrs.get("center_freq", 0)

            # Calculate frequency range
            freq_step = sample_rate / fft_size
            min_frequency = center_freq - sample_rate / 2
            max_frequency = center_freq + sample_rate / 2

            # If window parameters are provided, process multiple slices
            if start_idx is not None and end_idx is not None:
                return DigitalRFUtility._process_window_slices(
                    reader,
                    channel,
                    subchannel,
                    start_sample,
                    sample_rate,
                    min_frequency,
                    max_frequency,
                    fft_size,
                    start_idx,
                    end_idx,
                    samples_per_slice,
                )
            else:
                # Process single slice and return as list
                waterfall_file = DigitalRFUtility._process_single_slice(
                    reader,
                    channel,
                    subchannel,
                    start_sample,
                    num_samples,
                    sample_rate,
                    min_frequency,
                    max_frequency,
                    fft_size,
                )
                return [waterfall_file]

        except Exception as e:
            error_message = (
                f"Error converting DigitalRF data to WaterfallFile format: {e}"
            )
            logger.error(error_message)
            raise ValueError(error_message)

    @staticmethod
    def _process_single_slice(
        reader: DigitalRFReader,
        channel: str,
        subchannel: int,
        start_sample: int,
        num_samples: int,
        sample_rate: float,
        min_frequency: float,
        max_frequency: float,
        fft_size: int,
    ) -> dict:
        """Process a single slice of DigitalRF data.

        Args:
            reader: DigitalRF reader instance
            channel: Channel name
            subchannel: Subchannel index
            start_sample: Starting sample index
            num_samples: Number of samples to process
            sample_rate: Sample rate in Hz
            min_frequency: Minimum frequency
            max_frequency: Maximum frequency
            fft_size: FFT size

        Returns:
            dict: WaterfallFile format data
        """
        # Read the data
        data_array = reader.read_vector(start_sample, num_samples, channel, subchannel)

        # Perform FFT processing
        fft_data = np.fft.fft(data_array, n=fft_size)
        power_spectrum = np.abs(fft_data) ** 2

        # Convert to dB
        power_spectrum_db = 10 * np.log10(power_spectrum + 1e-12)

        # Convert power spectrum to binary string for transmission
        data_bytes = power_spectrum_db.astype(np.float32).tobytes()
        data_b64 = np.frombuffer(data_bytes, dtype=np.uint8)
        data_string = "".join([chr(b) for b in data_b64])

        # Create timestamp from sample index
        timestamp = datetime.fromtimestamp(
            start_sample / sample_rate, tz=UTC
        ).isoformat()

        # Build WaterfallFile format
        waterfall_file = {
            "data": data_string,
            "data_type": "float32",
            "timestamp": timestamp,
            "min_frequency": min_frequency,
            "max_frequency": max_frequency,
            "num_samples": fft_size,
            "sample_rate": sample_rate,
            "mac_address": f"drf_{channel}_{subchannel}",
            "center_frequency": (min_frequency + max_frequency) / 2,
            "custom_fields": {
                "num_subchannels": 1,  # Will be updated by caller
                "channel_name": channel,
                "subchannel": subchannel,
                "start_sample": start_sample,
                "num_samples": num_samples,
                "fft_size": fft_size,
            },
        }

        return waterfall_file

    @staticmethod
    def _process_window_slices(
        reader: DigitalRFReader,
        channel: str,
        subchannel: int,
        start_sample: int,
        sample_rate: float,
        min_frequency: float,
        max_frequency: float,
        fft_size: int,
        start_idx: int,
        end_idx: int,
        samples_per_slice: int,
    ) -> list[dict]:
        """Process multiple slices of DigitalRF data for a sliding window.

        Args:
            reader: DigitalRF reader instance
            channel: Channel name
            subchannel: Subchannel index
            start_sample: Starting sample index
            sample_rate: Sample rate in Hz
            min_frequency: Minimum frequency
            max_frequency: Maximum frequency
            fft_size: FFT size
            start_idx: Start index for the sliding window
            end_idx: End index for the sliding window
            samples_per_slice: Number of samples per slice

        Returns:
            list[dict]: List of WaterfallFile format data
        """
        waterfall_files = []

        # Calculate the number of slices to process
        num_slices = end_idx - start_idx

        for i in range(num_slices):
            # Calculate the sample range for this slice
            slice_start_sample = start_sample + (start_idx + i) * samples_per_slice
            slice_num_samples = min(
                samples_per_slice,
                start_sample + (end_idx * samples_per_slice) - slice_start_sample,
            )

            if slice_num_samples <= 0:
                break

            # Process this slice
            waterfall_file = DigitalRFUtility._process_single_slice(
                reader,
                channel,
                subchannel,
                slice_start_sample,
                slice_num_samples,
                sample_rate,
                min_frequency,
                max_frequency,
                fft_size,
            )

            # Update the timestamp to reflect the slice position
            waterfall_file["timestamp"] = datetime.fromtimestamp(
                slice_start_sample / sample_rate, tz=UTC
            ).isoformat()

            waterfall_files.append(waterfall_file)

        return waterfall_files

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
            # Initialize DigitalRF reader
            reader = DigitalRFReader(drf_data_path)
            channels = reader.get_channels()

            if not channels:
                raise ValueError("No channels found in DigitalRF data")

            # Use the first channel
            channel = channels[0]

            # Get sample bounds
            start_sample, end_sample = reader.get_bounds(channel)
            total_samples = end_sample - start_sample

            # Calculate total slices
            total_slices = total_samples // samples_per_slice

            return max(1, total_slices)  # Ensure at least 1 slice

        except Exception as e:
            error_message = f"Error calculating total slices for DigitalRF data: {e}"
            logger.error(error_message)
            raise ValueError(error_message)
