import argparse
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import h5py
import matplotlib.pyplot as plt
import numpy as np
from digital_rf import DigitalRFReader
from scipy.signal import ShortTimeFFT
from scipy.signal.windows import gaussian

# from sigmf import SigMFArchiveReader
from spectrumx_visualization_platform.spx_vis.models import CaptureType


@dataclass
class SpectrogramData:
    """Container for spectrogram data and metadata.

    Attributes:
        data_array: Complex data array
        sample_rate: Sample rate in Hz
        sample_count: Number of samples
        channel_name: Optional name of the channel (for DigitalRF)
    """

    data_array: np.ndarray
    sample_rate: float
    sample_count: int
    channel_name: str | None = None


def estimate_chunk_size(sample_rate: float, max_memory_mb: float = 1000) -> int:
    """Estimate appropriate chunk size based on memory constraints.

    Args:
        sample_rate: Sample rate in Hz
        max_memory_mb: Maximum memory to use for processing in MB

    Returns:
        int: Number of samples per chunk
    """
    # Estimate memory per sample (complex64 = 8 bytes)
    bytes_per_sample = 8
    max_samples = int((max_memory_mb * 1024 * 1024) // bytes_per_sample)

    # Ensure chunk size is reasonable (not too small, not too large)
    min_chunk_size = int(sample_rate * 10)  # 10 seconds minimum
    max_chunk_size = int(sample_rate * 300)  # 5 minutes maximum

    chunk_size = int(min(max_samples, max_chunk_size))
    chunk_size = int(max(chunk_size, min_chunk_size))

    return chunk_size


def make_spectrogram(
    job_metadata: dict[str, Any], config: dict[str, Any], file_paths: list[str]
) -> plt.Figure:
    """Generate a spectrogram from either SigMF or DigitalRF data.

    Args:
        job_metadata: Dictionary containing job configuration and file information
        config: Dictionary containing job configuration. Must contain 'capture_type' and
               'capture_ids' (list with single capture ID)
        file_paths: List of file paths to search through for data files

    Returns:
        matplotlib.figure.Figure: The generated spectrogram figure

    Raises:
        ValueError: If required files are not found or data format is unsupported
    """
    capture_type = config.get("capture_type", CaptureType.SigMF)
    config["width"] = config.get("width", 10)
    config["height"] = config.get("height", 10)

    # Load data based on capture type
    if capture_type == CaptureType.SigMF:
        spectrogram_data = _load_sigmf_data(file_paths)
    elif capture_type == CaptureType.DigitalRF:
        spectrogram_data = _load_digital_rf_data(file_paths, config)
    else:
        raise ValueError(f"Unsupported capture type: {capture_type}")

    # Generate spectrogram using unified logic
    return _generate_spectrogram(spectrogram_data, config)


def _load_sigmf_data(file_paths: list[str]) -> SpectrogramData:
    """Load data from SigMF format.

    Args:
        job_metadata: Dictionary containing job configuration and file information
        file_paths: List of file paths to search through
        config: Dictionary containing job configuration

    Returns:
        SpectrogramData: Container with loaded data and metadata

    Raises:
        ValueError: If required files are not found
    """
    # Find SigMF files in the provided paths
    data_file = next((Path(p) for p in file_paths if p.endswith(".sigmf-data")), None)
    metadata_file = next(
        (Path(p) for p in file_paths if p.endswith(".sigmf-meta")), None
    )

    if not data_file or not metadata_file:
        msg = "Could not find SigMF data or metadata files"
        raise ValueError(msg)

    # Get sample rate from metadata file
    with metadata_file.open() as f:
        metadata = json.load(f)
    sample_rate = metadata["global"]["core:sample_rate"]

    # Load data array
    data_array = np.fromfile(data_file, dtype=np.complex64)
    sample_count = len(data_array)

    return SpectrogramData(
        data_array=data_array, sample_rate=sample_rate, sample_count=sample_count
    )


def _load_digital_rf_data(
    file_paths: list[str], config: dict[str, Any]
) -> SpectrogramData:
    """Load data from DigitalRF format.

    Args:
        job_metadata: Dictionary containing job configuration and file information
        file_paths: List of file paths to search through
        config: Dictionary containing job configuration

    Returns:
        SpectrogramData: Container with loaded data and metadata

    Raises:
        ValueError: If required files are not found
    """
    # Find the DigitalRF directory by looking for drf_properties.h5
    drf_props = next(
        (Path(p) for p in file_paths if p.endswith("drf_properties.h5")), None
    )
    if not drf_props:
        msg = "Could not find DigitalRF properties file"
        raise ValueError(msg)

    # The DigitalRF directory is the parent of the channel directory
    drf_dir = drf_props.parent.parent
    channel = drf_props.parent.name

    try:
        # Initialize DigitalRF reader
        reader = DigitalRFReader(str(drf_dir))
        channels = reader.get_channels()

        if not channels:
            msg = "No channels found in DigitalRF data"
            _raise_error(msg)

        # Use the specified channel
        subchannel = config.get("subchannel", 0)
        start_sample, end_sample = reader.get_bounds(channel)

        # Get sample rate from metadata
        with h5py.File(drf_props, "r") as f:
            sample_rate = (
                f.attrs["sample_rate_numerator"] / f.attrs["sample_rate_denominator"]
            )

        num_samples = int(end_sample - start_sample)

        # Validate sample count
        if num_samples <= 0:
            raise ValueError(f"Invalid sample count: {num_samples}. Must be positive.")

        data_array = reader.read_vector(start_sample, num_samples, channel, subchannel)

        return SpectrogramData(
            data_array=data_array,
            sample_rate=sample_rate,
            sample_count=num_samples,
            channel_name=channel,
        )

    except Exception as e:
        logging.error(f"Error processing DigitalRF data: {e}")
        raise


def _generate_spectrogram_chunked(
    spectrogram_data: SpectrogramData, config: dict[str, Any]
) -> plt.Figure:
    """Generate a spectrogram from complex data using chunked processing for large datasets.

    Args:
        spectrogram_data: Container with data and metadata
        config: Dictionary containing job configuration

    Returns:
        matplotlib.figure.Figure: The generated spectrogram figure
    """
    # Standard deviation for Gaussian window in samples
    std_dev = config.get("stdDev", 100)
    fft_size = config.get("fftSize", 1024)
    gaussian_window = gaussian(fft_size, std=std_dev, sym=True)
    width = config["width"]
    height = config["height"]

    # Estimate chunk size based on memory constraints
    max_memory_mb = config.get("max_memory_mb", 1000)
    chunk_size = estimate_chunk_size(spectrogram_data.sample_rate, max_memory_mb)

    logging.info(
        f"Processing {spectrogram_data.sample_count} samples in chunks of {chunk_size}"
    )
    logging.info(
        f"Sample rate: {spectrogram_data.sample_rate}, Chunk size: {chunk_size} (type: {type(chunk_size)})"
    )

    # Create ShortTimeFFT object
    short_time_fft = ShortTimeFFT(
        gaussian_window,
        hop=config.get("hopSize", 500),
        fs=spectrogram_data.sample_rate,
        mfft=fft_size,
        fft_mode="centered",
    )

    # Process data in chunks
    all_spectrograms = []
    total_chunks = int((spectrogram_data.sample_count + chunk_size - 1) // chunk_size)

    logging.info(f"Total chunks: {total_chunks} (type: {type(total_chunks)})")

    # Safety check
    if chunk_size <= 0:
        raise ValueError(f"Invalid chunk size: {chunk_size}. Must be positive.")
    if total_chunks <= 0:
        raise ValueError(f"Invalid total chunks: {total_chunks}. Must be positive.")

    for chunk_idx in range(total_chunks):
        start_idx = int(chunk_idx * chunk_size)
        end_idx = int(min(start_idx + chunk_size, spectrogram_data.sample_count))

        logging.info(
            f"Processing chunk {chunk_idx + 1}/{total_chunks} (samples {start_idx}-{end_idx})"
        )

        # Extract chunk
        chunk_data = spectrogram_data.data_array[start_idx:end_idx]

        # Generate spectrogram for this chunk
        chunk_spectrogram = short_time_fft.spectrogram(chunk_data)
        all_spectrograms.append(chunk_spectrogram)

        # Log memory usage
        chunk_memory_mb = chunk_spectrogram.nbytes / 1024 / 1024
        logging.info(f"Chunk {chunk_idx + 1} spectrogram size: {chunk_memory_mb:.1f}MB")

    # Combine all spectrograms
    if len(all_spectrograms) == 1:
        combined_spectrogram = all_spectrograms[0]
    else:
        # Concatenate along time axis
        combined_spectrogram = np.concatenate(all_spectrograms, axis=1)

    # Create the final figure
    return _create_spectrogram_figure(
        combined_spectrogram, short_time_fft, spectrogram_data, config
    )


def _generate_spectrogram(
    spectrogram_data: SpectrogramData, config: dict[str, Any]
) -> plt.Figure:
    """Generate a spectrogram from complex data.

    Args:
        spectrogram_data: Container with data and metadata
        config: Dictionary containing job configuration

    Returns:
        matplotlib.figure.Figure: The generated spectrogram figure
    """
    # Check if we should use chunked processing
    use_chunked = config.get("use_chunked_processing", False)
    data_size_mb = spectrogram_data.data_array.nbytes / 1024 / 1024

    if use_chunked or data_size_mb > 500:  # Use chunked processing for large datasets
        logging.info(f"Using chunked processing for dataset of {data_size_mb:.1f}MB")
        return _generate_spectrogram_chunked(spectrogram_data, config)

    # Standard processing for smaller datasets
    std_dev = config.get("stdDev", 100)
    fft_size = config.get("fftSize", 1024)
    gaussian_window = gaussian(fft_size, std=std_dev, sym=True)
    width = config["width"]
    height = config["height"]

    short_time_fft = ShortTimeFFT(
        gaussian_window,
        hop=config.get("hopSize", 500),
        fs=spectrogram_data.sample_rate,
        mfft=fft_size,
        fft_mode="centered",
    )

    spectrogram = short_time_fft.spectrogram(spectrogram_data.data_array)

    return _create_spectrogram_figure(
        spectrogram, short_time_fft, spectrogram_data, config
    )


def _create_spectrogram_figure(
    spectrogram: np.ndarray,
    short_time_fft: ShortTimeFFT,
    spectrogram_data: SpectrogramData,
    config: dict[str, Any],
) -> plt.Figure:
    """Create the final spectrogram figure.

    Args:
        spectrogram: The computed spectrogram array
        short_time_fft: The ShortTimeFFT object used for computation
        spectrogram_data: Container with data and metadata
        config: Dictionary containing job configuration

    Returns:
        matplotlib.figure.Figure: The generated spectrogram figure
    """
    extent = short_time_fft.extent(spectrogram_data.sample_count)
    time_min, time_max = extent[:2]
    width = config["width"]
    height = config["height"]

    # Create figure
    figure, axes = plt.subplots(figsize=(width, height))

    # Set title with channel name if available
    title = rf"Spectrogram ({short_time_fft.m_num*short_time_fft.T:g}$\,s$ Gaussian "
    title += rf"window, $\sigma_t={config.get('stdDev', 100)*short_time_fft.T:g}\,$s)"
    if spectrogram_data.channel_name:
        title = f"{spectrogram_data.channel_name} - {title}"
    axes.set_title(title, fontsize=16)

    # Set axis labels and limits
    axes.set(
        xlabel=f"Time $t$ in seconds ({short_time_fft.p_num(spectrogram_data.sample_count)} slices, "
        rf"$\Delta t = {short_time_fft.delta_t:g}\,$s)",
        ylabel=f"Freq. $f$ in Hz ({short_time_fft.f_pts} bins, "
        rf"$\Delta f = {short_time_fft.delta_f:g}\,$Hz)",
        xlim=(time_min, time_max),
    )

    # Increase font sizes for axis labels
    axes.xaxis.label.set_size(14)
    axes.yaxis.label.set_size(14)

    # Increase font sizes for tick labels
    axes.tick_params(axis="both", which="major", labelsize=12)

    # Plot spectrogram
    spectrogram_db_limited = 10 * np.log10(np.fmax(spectrogram, 1e-4))
    image = axes.imshow(
        spectrogram_db_limited,
        origin="lower",
        aspect="auto",
        extent=extent,
        cmap=config.get("colormap", "magma"),
    )

    # Add colorbar
    colorbar = figure.colorbar(
        image,
        label="Power Spectral Density " + r"$20\,\log_{10}|S_x(t, f)|$ in dB",
    )

    # Increase font size for colorbar label and tick labels
    colorbar.ax.set_ylabel(
        "Power Spectral Density " + r"$20\,\log_{10}|S_x(t, f)|$ in dB", fontsize=14
    )
    colorbar.ax.tick_params(labelsize=12)

    figure.tight_layout()
    return figure


def _raise_error(msg: str) -> None:
    """Raise a ValueError with the given message and log it.

    Args:
        msg: Error message to raise and log
    """
    logging.error(msg)
    raise ValueError(msg)


if __name__ == "__main__":
    arg_parser = argparse.ArgumentParser(
        description=(
            "Make a spectrogram from SigMF or DigitalRF data. "
            "Figure is saved to 'spectrogram.png'."
        ),
    )
    arg_parser.add_argument("--type", type=str, required=True, choices=["sigmf", "drf"])
    arg_parser.add_argument("--data", type=str, required=True)
    arg_parser.add_argument("--meta", type=str, required=True)
    args = arg_parser.parse_args()

    job_data = {
        "capture_type": args.type,
        "data": {"local_files": [{"name": args.data}, {"name": args.meta}]},
    }
    fig = make_spectrogram(job_data)
    fig.savefig("spectrogram.png")
