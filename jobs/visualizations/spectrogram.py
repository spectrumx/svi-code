# import tarfile
import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from scipy.signal import ShortTimeFFT
from scipy.signal.windows import gaussian

# from sigmf import SigMFArchiveReader


def make_spectrogram(job_data, width, height, files_dir=""):
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
        data_array,
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
            "Make a spectrogram from SigMF data and metadata files. "
            "Figure is saved to 'spectrogram.png'."
        ),
    )
    arg_parser.add_argument("--data", type=str, required=True)
    arg_parser.add_argument("--meta", type=str, required=True)
    args = arg_parser.parse_args()

    job_data = {
        "data": {"local_files": [{"name": args.data}, {"name": args.meta}]},
    }
    fig = make_spectrogram(job_data)
    fig.savefig("spectrogram.png")
