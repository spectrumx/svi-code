# import tarfile
import argparse
import json
import logging
import tarfile
import tempfile
from pathlib import Path

import h5py
import matplotlib.pyplot as plt
import numpy as np
from digital_rf import DigitalRFReader
from scipy.signal import ShortTimeFFT
from scipy.signal.windows import gaussian

# from sigmf import SigMFArchiveReader
from spectrumx_visualization_platform.spx_vis.models import CaptureType


def make_spectrogram(job_data, config, files_dir=""):
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

    if capture_type == CaptureType.SigMF:
        return _make_sigmf_spectrogram(job_data, config, files_dir)
    if capture_type == CaptureType.DigitalRF:
        return _make_digital_rf_spectrogram(job_data, config, files_dir)
    raise ValueError(f"Unsupported capture type: {capture_type}")


### SigMF ###
def _make_sigmf_spectrogram(job_data, config, files_dir=""):
    """Generate a spectrogram from SigMF data.

    Args:
        job_data: Dictionary containing job configuration and file information
        config: Dictionary containing job configuration
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

    return _generate_spectrogram(data_array, sample_rate, sample_count, config)


def _generate_spectrogram(data_array, sample_rate, sample_count, config):
    """Generate a spectrogram from complex data.

    Args:
        data_array: Complex data array
        sample_rate: Sample rate in Hz
        sample_count: Number of samples
        config: Dictionary containing job configuration

    Returns:
        matplotlib.figure.Figure: The generated spectrogram figure
    """
    std_dev = 100  # standard deviation for Gaussian window in samples
    fft_size = config.get("fftSize", 1024)
    gaussian_window = gaussian(
        fft_size, std=std_dev, sym=True
    )  # symmetric Gaussian window
    width = config["width"]
    height = config["height"]

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


### Digital RF ###
def _make_digital_rf_spectrogram(job_data, config, files_dir=""):
    """Generate a spectrogram from Digital RF data.

    Args:
        job_data: Dictionary containing job configuration and file information
        config: Dictionary containing job configuration
        files_dir: Directory containing the input files

    Returns:
        matplotlib.figure.Figure: The generated spectrogram figure

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
        logging.error(msg)
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

            # Initialize DigitalRF reader with the extracted directory
            reader = DigitalRFReader(temp_dir)
            channels = reader.get_channels()

            if not channels:
                _raise_error("No channels found in DigitalRF data")

            # For now, we'll use the first channel
            channel = channels[0]
            start_sample, end_sample = reader.get_bounds(channel)

            # Get sample rate from metadata
            with h5py.File(f"{temp_dir}/{channel}/drf_properties.h5", "r") as f:
                sample_rate = (
                    f.attrs["sample_rate_numerator"]
                    / f.attrs["sample_rate_denominator"]
                )

            num_samples = end_sample - start_sample
            rf_data = reader.read_vector(start_sample, num_samples, channel)

            # Compute spectrogram
            fft_size = config.get("fftSize", 1024)
            window = gaussian(fft_size, std=100, sym=True)
            stfft = ShortTimeFFT(
                window, hop=500, fs=sample_rate, mfft=fft_size, fft_mode="centered"
            )
            spectrogram = stfft.spectrogram(rf_data)

            # Create extent for plotting
            extent = stfft.extent(num_samples)

            return drf_specgram_plot(
                data=spectrogram,
                extent=extent,
                log_scale=True,
                title=f"{channel} - FFT Size: {fft_size}",
                config=config,
            )

        except Exception as e:
            logging.error(f"Error processing DigitalRF data: {e}")
            raise


def drf_specgram_plot(data, extent, log_scale, title, config):
    """Plot a specgram from the data for a given fft size.

    Adapted from
    https://github.com/MITHaystack/digital_rf/blob/master/python/tools/drf_plot.py
    """
    # set to log scaling
    pss = 10.0 * np.log10(data + 1e-12) if log_scale else data

    # scale for zero centered kilohertz
    # determine image x-y extent

    # determine image color extent in log scale units
    # Auto compute zscale
    # Convert to dB
    spectrogram_db = 10.0 * np.log10(data + 1e-12)
    pss_ma = np.ma.masked_invalid(spectrogram_db)

    zscale_low = np.median(pss_ma.min())
    zscale_high = np.median(pss_ma.max())
    if log_scale:
        zscale_low -= 3.0
        zscale_high += 10.0

    fig = plt.figure(figsize=(config["width"], config["height"]))
    ax = fig.add_subplot(1, 1, 1)
    img = ax.imshow(
        pss,
        extent=extent,
        vmin=zscale_low,
        vmax=zscale_high,
        origin="lower",
        interpolation="none",
        aspect="auto",
    )
    cb = fig.colorbar(img, ax=ax)
    ax.set_xlabel("time (seconds)")
    ax.set_ylabel("frequency (MHz)", fontsize=12)
    if log_scale:
        cb.set_label("power (dB)")
    else:
        cb.set_label("power")
    ax.set_title(title)

    return fig


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
