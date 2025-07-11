import base64
import logging
import mimetypes
import os
import re
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import UTC
from datetime import datetime
from pathlib import Path

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
    # Additional metadata fields from DigitalMetadataReader
    device_name: str | None = None
    gain: float | None = None
    job_name: str | None = None
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

        # Try to get additional metadata using DigitalRFReader's read_metadata method
        device_name = None
        gain = None
        job_name = None
        comments = None

        # Get metadata for the first sample range
        metadata_dict = DigitalRFUtility._extract_metadata(
            reader, channel, start_sample, min(1000, end_sample - start_sample)
        )

        # Extract metadata from the dictionary
        device_name = metadata_dict.get("device_name")
        gain = metadata_dict.get("gain")
        job_name = metadata_dict.get("job_name")
        comments = metadata_dict.get("comments")
        center_freq = metadata_dict.get("center_freq")

        # Fallback: try to get metadata from HDF5 files if DigitalMetadataReader didn't work
        if not any([device_name, gain, job_name, comments]):
            try:
                # Look for metadata files in the channel directory
                metadata_path = f"{drf_data_path}/{channel}"
                if os.path.exists(metadata_path):
                    # Try to find metadata files
                    for filename in os.listdir(metadata_path):
                        if filename.endswith(".h5") and "metadata" in filename.lower():
                            metadata_file_path = os.path.join(metadata_path, filename)
                            try:
                                with h5py.File(metadata_file_path, "r") as meta_f:
                                    # Extract metadata attributes if available
                                    if "device_name" in meta_f.attrs:
                                        device_name = meta_f.attrs["device_name"]
                                    if "gain" in meta_f.attrs:
                                        gain = meta_f.attrs["gain"]
                                    if "job_name" in meta_f.attrs:
                                        job_name = meta_f.attrs["job_name"]
                                    if "comments" in meta_f.attrs:
                                        comments = meta_f.attrs["comments"]
                                    break
                            except Exception as e:
                                logger.debug(
                                    f"Could not read metadata from {filename}: {e}"
                                )
                                continue
            except Exception as e:
                logger.debug(f"Could not access metadata directory: {e}")

        return DigitalRFContext(
            reader=reader,
            channel=channel,
            sample_rate=sample_rate,
            center_freq=center_freq,
            start_sample=start_sample,
            end_sample=end_sample,
            device_name=device_name,
            gain=gain,
            job_name=job_name,
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
                if sample_metadata:
                    # Extract common metadata fields
                    for key, value in sample_metadata.items():
                        if key in [
                            "device_name",
                            "gain",
                            "job_name",
                        ]:
                            metadata[key] = value
                        if key == "center_frequencies":
                            metadata["center_freq"] = value[0]
                        if key == "description":
                            metadata["comments"] = value
                    # Only need metadata from the first sample
                    break

        except Exception as e:
            logger.debug(f"Could not read metadata using DigitalRFReader: {e}")

        return metadata

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

        # Build WaterfallFile format with enhanced metadata
        waterfall_file = {
            "data": data_string,
            "data_type": "float32",
            "timestamp": timestamp,
            "min_frequency": freq_range.min_frequency,
            "max_frequency": freq_range.max_frequency,
            "num_samples": slice_num_samples,
            "sample_rate": context.sample_rate,
            "mac_address": f"drf_{context.channel}_0",
            "center_frequency": freq_range.center_frequency,
        }

        # Add optional fields if available
        if context.device_name:
            waterfall_file["device_name"] = context.device_name

        # Build custom fields with all available metadata
        custom_fields = {
            "channel_name": context.channel,
            "start_sample": slice_start_sample,
            "num_samples": slice_num_samples,
            "fft_size": config.fft_size,
            "scan_time": slice_num_samples / context.sample_rate,
        }

        # Add metadata fields that match RadioHound format
        if context.gain is not None:
            custom_fields["gain"] = context.gain
        if context.job_name:
            custom_fields["job_name"] = context.job_name
        if context.comments:
            custom_fields["comments"] = context.comments

        waterfall_file["custom_fields"] = custom_fields
        return waterfall_file

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
                            file_path = os.path.join(
                                temp_dir, extract_info.filename[len(capture_dir) :]
                            )
                            os.makedirs(os.path.dirname(file_path), exist_ok=True)

                            # Extract the file
                            with (
                                zip_file.open(extract_info) as source,
                                open(file_path, "wb") as target,
                            ):
                                shutil.copyfileobj(source, target)

                    # Find the DigitalRF root directory (parent of the channel directory)
                    for root, dirs, files in os.walk(temp_dir):
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

        raise ValueError("No waterfall data found for total slices calculation")

    @staticmethod
    def get_total_slices(
        user, capture_ids: list[str], samples_per_slice: int = SAMPLES_PER_SLICE
    ) -> int:
        """Calculate total slices for DigitalRF captures from SDS.

        This method handles the entire process of downloading files from SDS
        and calculating total slices.

        Args:
            user: The user object
            capture_ids: List of capture IDs to process (only one capture supported)
            samples_per_slice: Number of samples per slice

        Returns:
            int: Total number of slices available

        Raises:
            ValueError: If capture is not found or has no files
        """
        import io
        import zipfile

        from spectrumx_visualization_platform.spx_vis.source_utils.sds import (
            get_sds_captures,
        )

        # Get SDS captures info
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

        # For DigitalRF, we need to download files to calculate total slices
        # Create a BytesIO object to store the ZIP file
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            # Download and add files to ZIP
            sds_client = user.sds_client()
            seen_filenames: set[str] = set()

            for file in files:
                file_uuid = file["uuid"]

                with tempfile.TemporaryDirectory() as temp_dir:
                    local_path = Path(temp_dir) / file["name"]
                    sds_file = sds_client.download_file(
                        file_uuid=file_uuid, to_local_path=local_path
                    )
                    if not sds_file.local_path.exists():
                        raise ValueError(f"Failed to download file {file_uuid}")

                    filename = sds_file.name

                    # Use the file's directory path from SDS (preserve structure)
                    file_directory = sds_file.directory
                    # Remove leading slash and create path relative to capture
                    relative_path = str(file_directory).lstrip("/")
                    zip_path = f"{capture_id}/{relative_path}/{filename}"

                    # Check for duplicate filename
                    if zip_path in seen_filenames:
                        raise ValueError(
                            f"Duplicate filename found for capture with ID {capture_id}. "
                            f"File name: {zip_path}"
                        )
                    seen_filenames.add(zip_path)

                    # Add file to ZIP
                    zip_file.write(sds_file.local_path, arcname=zip_path)

        # Reset buffer position to start
        zip_buffer.seek(0)

        # Use the DigitalRF utility to calculate total slices from ZIP
        with zipfile.ZipFile(zip_buffer, "r") as zip_file:
            return DigitalRFUtility.get_total_slices_from_zip(
                zip_file, capture_ids, samples_per_slice
            )
