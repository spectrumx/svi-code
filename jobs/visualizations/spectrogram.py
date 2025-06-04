# import tarfile
import argparse
import json
import logging
import tarfile
import tempfile
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


def make_spectrogram(
    job_data: dict[str, Any], config: dict[str, Any], files_dir: str = ""
) -> plt.Figure:
    """Generate a spectrogram from either SigMF or DigitalRF data.

    Args:
        job_data: Dictionary containing job configuration and file information
        config: Dictionary containing job configuration
        files_dir: Directory containing the input files

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
        spectrogram_data = _load_sigmf_data(job_data, files_dir, config)
    elif capture_type == CaptureType.DigitalRF:
        spectrogram_data = _load_digital_rf_data(job_data, files_dir, config)
    else:
        raise ValueError(f"Unsupported capture type: {capture_type}")

    # Generate spectrogram using unified logic
    return _generate_spectrogram(spectrogram_data, config)


def _load_sigmf_data(
    job_data: dict[str, Any], files_dir: str, config: dict[str, Any]
) -> SpectrogramData:
    """Load data from SigMF format.

    Args:
        job_data: Dictionary containing job configuration and file information
        files_dir: Directory containing the input files

    Returns:
        SpectrogramData: Container with loaded data and metadata

    Raises:
        ValueError: If required files are not found
    """
    # Get the data and metadata files
    data_file = None
    metadata_file = None

    for f in job_data["data"]["local_files"]:
        if f["name"].endswith(".sigmf-data"):
            data_file = f
        elif f["name"].endswith(".sigmf-meta"):
            metadata_file = f

    if not data_file or not metadata_file:
        msg = "Data or metadata file not found in job data"
        raise ValueError(msg)

    # Get sample rate from metadata file
    with Path.open(f"{files_dir}{metadata_file['name']}") as f:
        metadata = json.load(f)
    sample_rate = metadata["global"]["core:sample_rate"]

    # Load data array
    data_array = np.fromfile(f"{files_dir}{data_file['name']}", dtype=np.complex64)
    sample_count = len(data_array)

    return SpectrogramData(
        data_array=data_array, sample_rate=sample_rate, sample_count=sample_count
    )


def _load_digital_rf_data(
    job_data: dict[str, Any], files_dir: str, config: dict[str, Any]
) -> SpectrogramData:
    """Load data from DigitalRF format.

    Args:
        job_data: Dictionary containing job configuration and file information
        files_dir: Directory containing the input files

    Returns:
        SpectrogramData: Container with loaded data and metadata

    Raises:
        ValueError: If required files are not found
    """
    # Find the tar.gz file
    tar_file = None
    for f in job_data["data"]["local_files"]:
        if f["name"].endswith(".tar.gz"):
            tar_file = f"{files_dir}{f['name']}"
            break

    if not tar_file:
        msg = "tar.gz file not found in job data"
        raise ValueError(msg)

    # Create a temporary directory to extract the tar.gz file
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Extract the tar.gz file
            with tarfile.open(tar_file, "r:gz") as tf:
                for member in tf.getmembers():
                    if member.name.startswith(("/", "..")):
                        continue
                    tf.extract(member, temp_dir)

            # Initialize DigitalRF reader
            reader = DigitalRFReader(temp_dir)
            channels = reader.get_channels()

            if not channels:
                msg = "No channels found in DigitalRF data"
                _raise_error(msg)

            # Use the first channel
            channel = channels[0]
            subchannel = config.get("subchannel", 0)
            start_sample, end_sample = reader.get_bounds(channel)

            # Get sample rate from metadata
            with h5py.File(f"{temp_dir}/{channel}/drf_properties.h5", "r") as f:
                sample_rate = (
                    f.attrs["sample_rate_numerator"]
                    / f.attrs["sample_rate_denominator"]
                )

            num_samples = end_sample - start_sample
            data_array = reader.read_vector(
                start_sample, num_samples, channel, subchannel
            )

            return SpectrogramData(
                data_array=data_array,
                sample_rate=sample_rate,
                sample_count=num_samples,
                channel_name=channel,
            )

        except Exception as e:
            logging.error(f"Error processing DigitalRF data: {e}")
            raise


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
    # Standard deviation for Gaussian window in samples
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
    extent = short_time_fft.extent(spectrogram_data.sample_count)
    time_min, time_max = extent[:2]

    # Create figure
    figure, axes = plt.subplots(figsize=(width, height))

    # Set title with channel name if available
    title = rf"Spectrogram ({short_time_fft.m_num*short_time_fft.T:g}$\,s$ Gaussian "
    title += rf"window, $\sigma_t={std_dev*short_time_fft.T:g}\,$s)"
    if spectrogram_data.channel_name:
        title = f"{spectrogram_data.channel_name} - {title}"
    axes.set_title(title)

    # Set axis labels and limits
    axes.set(
        xlabel=f"Time $t$ in seconds ({short_time_fft.p_num(spectrogram_data.sample_count)} slices, "
        rf"$\Delta t = {short_time_fft.delta_t:g}\,$s)",
        ylabel=f"Freq. $f$ in Hz ({short_time_fft.f_pts} bins, "
        rf"$\Delta f = {short_time_fft.delta_f:g}\,$Hz)",
        xlim=(time_min, time_max),
    )

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
    figure.colorbar(
        image,
        label="Power Spectral Density " + r"$20\,\log_{10}|S_x(t, f)|$ in dB",
    )

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
