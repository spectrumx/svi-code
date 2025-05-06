# import tarfile
import argparse
import json
import logging
import tempfile
import zipfile
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from digital_rf import DigitalRFReader
from scipy.signal import ShortTimeFFT
from scipy.signal.windows import gaussian

# from sigmf import SigMFArchiveReader
from spectrumx_visualization_platform.spx_vis.models import CaptureType


def make_spectrogram(job_data, width, height, files_dir=""):
    """Generate a spectrogram from either SigMF or DigitalRF data.

    Args:
        job_data: Dictionary containing job configuration and file information
        width: Width of the spectrogram in inches
        height: Height of the spectrogram in inches
        files_dir: Directory containing the input files

    Returns:
        matplotlib.figure.Figure: The generated spectrogram figure

    Raises:
        ValueError: If required files are not found or data format is unsupported
    """
    capture_type = job_data.get("capture_type", CaptureType.SigMF)

    if capture_type == CaptureType.SigMF:
        return _make_sigmf_spectrogram(job_data, width, height, files_dir)
    if capture_type == CaptureType.DigitalRF:
        return _make_digital_rf_spectrogram(job_data, width, height, files_dir)
    raise ValueError(f"Unsupported capture type: {capture_type}")


def _make_sigmf_spectrogram(job_data, width, height, files_dir=""):
    """Generate a spectrogram from SigMF data.

    Args:
        job_data: Dictionary containing job configuration and file information
        width: Width of the spectrogram in inches
        height: Height of the spectrogram in inches
        files_dir: Directory containing the input files

    Returns:
        matplotlib.figure.Figure: The generated spectrogram figure

    Raises:
        ValueError: If required files are not found
    """
    # Get the data and metadata files by looking for the appropriate file extensions
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

    # # Create tar from both files
    # sigmf_filename = data_file["name"].replace(".sigmf-data", ".sigmf")
    # with tarfile.open(sigmf_filename, "w") as tar:
    #     tar.add(data_file["name"])
    #     tar.add(metadata_file["name"])

    # # Load a SigMF file
    # sigmf = SigMFArchiveReader(sigmf_filename)

    # # Access metadata
    # metadata = sigmf._metadata
    # print(metadata["global"])

    # sample_rate = metadata["global"]["core:sample_rate"]
    # data_array = sigmf.read_samples()

    # Get sample rate from metadata file
    with Path.open(f"{files_dir}{metadata_file['name']}") as f:
        metadata = json.load(f)
    sample_rate = metadata["global"]["core:sample_rate"]

    data_array = np.fromfile(f"{files_dir}{data_file['name']}", dtype=np.complex64)
    sample_count = len(data_array)

    return _generate_spectrogram(data_array, sample_rate, sample_count, width, height)


def _make_digital_rf_spectrogram(job_data, width, height, files_dir=""):
    """Generate a spectrogram from Digital RF data.

    Args:
        job_data: Dictionary containing job configuration and file information
        width: Width of the spectrogram in inches
        height: Height of the spectrogram in inches
        files_dir: Directory containing the input files

    Returns:
        matplotlib.figure.Figure: The generated spectrogram figure

    Raises:
        ValueError: If required files are not found
    """
    # Find the ZIP file
    zip_file = None
    for f in job_data["data"]["local_files"]:
        if f["name"].endswith(".zip"):
            zip_file = f"{files_dir}{f['name']}"
            break

    if not zip_file:
        msg = "ZIP file not found in job data"
        logging.error(msg)
        raise ValueError(msg)

    # Create a temporary directory to extract the ZIP file
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Extract the ZIP file
            with zipfile.ZipFile(zip_file, "r") as zf:
                zf.extractall(temp_dir)

            # Initialize DigitalRF reader with the extracted directory
            reader = DigitalRFReader(temp_dir)
            channels = reader.get_channels()

            if not channels:
                msg = "No channels found in DigitalRF data"
                logging.error(msg)
                raise ValueError(msg)

            # For now, we'll use the first channel
            channel = channels[0]
            start_sample, end_sample = reader.get_bounds(channel)

            # Get sample rate from metadata
            sample_rate = reader.get_properties(channel)["sample_rate"]

            # Read a portion of the data (adjust duration as needed)
            duration = 1  # seconds
            num_samples = int(sample_rate * duration)
            data_array = reader.read_vector(start_sample, num_samples, channel)
            sample_count = len(data_array)

            return _generate_spectrogram(
                data_array, sample_rate, sample_count, width, height
            )

        except Exception as e:
            logging.error(f"Error processing DigitalRF data: {e}")
            raise


def _generate_spectrogram(data_array, sample_rate, sample_count, width, height):
    """Generate a spectrogram from complex data.

    Args:
        data_array: Complex data array
        sample_rate: Sample rate in Hz
        sample_count: Number of samples
        width: Width of the spectrogram in inches
        height: Height of the spectrogram in inches

    Returns:
        matplotlib.figure.Figure: The generated spectrogram figure
    """
    std_dev = 100  # standard deviation for Gaussian window in samples
    gaussian_window = gaussian(1000, std=std_dev, sym=True)  # symmetric Gaussian window
    fft_size = 1024

    short_time_fft = ShortTimeFFT(
        gaussian_window,
        hop=500,
        fs=sample_rate,
        mfft=fft_size,
        fft_mode="centered",
    )

    spectrogram = short_time_fft.spectrogram(
        data_array
    )  # calculate absolute square of STFT

    figure, axes = plt.subplots(figsize=(width, height))  # enlarge plot a bit
    extent = short_time_fft.extent(sample_count)
    time_min, time_max = extent[:2]  # time range of plot
    axes.set_title(
        rf"Spectrogram ({short_time_fft.m_num*short_time_fft.T:g}$\,s$ Gaussian "
        rf"window, $\sigma_t={std_dev*short_time_fft.T:g}\,$s)",
    )
    axes.set(
        xlabel=f"Time $t$ in seconds ({short_time_fft.p_num(sample_count)} slices, "
        rf"$\Delta t = {short_time_fft.delta_t:g}\,$s)",
        ylabel=f"Freq. $f$ in Hz ({short_time_fft.f_pts} bins, "
        rf"$\Delta f = {short_time_fft.delta_f:g}\,$Hz)",
        xlim=(time_min, time_max),
    )
    spectrogram_db_limited = 10 * np.log10(
        np.fmax(spectrogram, 1e-4),
    )  # limit range to -40 dB
    image = axes.imshow(
        spectrogram_db_limited,
        origin="lower",
        aspect="auto",
        extent=extent,
        cmap="magma",
    )
    figure.colorbar(
        image,
        label="Power Spectral Density " + r"$20\,\log_{10}|S_x(t, f)|$ in dB",
    )
    axes.legend()
    figure.tight_layout()

    return figure


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
