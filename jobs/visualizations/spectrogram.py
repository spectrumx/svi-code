import matplotlib.pyplot as plt
import numpy as np
from scipy.signal import ShortTimeFFT
from scipy.signal.windows import gaussian
from sigmf import SigMFFile


def make_spectrogram(
    data_file_path: str,
    metadata_file_path: str,
    fft_size: int = 1024,
):
    # Load a SigMF file
    sigmf = SigMFFile(metadata_file_path, data_file_path)

    # Access metadata
    metadata = sigmf._metadata
    print(metadata["global"])

    # Access associated signal data
    signal_data = np.fromfile(
        data_file_path,
        dtype=np.complex64,
    )  # Assuming complex data

    fs = metadata["global"]["core:sample_rate"]
    x = signal_data
    N = len(x)

    fig, ax1 = plt.subplots()

    g_std = 12  # standard deviation for Gaussian window in samples
    win = gaussian(50, std=g_std, sym=True)  # symmetric Gaussian window
    SFT = ShortTimeFFT(win, hop=2, fs=fs, mfft=800, scale_to="psd")
    Sx2 = SFT.spectrogram(x)  # calculate absolute square of STFT

    Sx_dB = 10 * np.log10(np.fmax(Sx2, 1e-4))  # convert to dB
    im1 = ax1.imshow(
        Sx_dB,
        origin="lower",
        aspect="auto",
        extent=SFT.extent(N),
        cmap="magma",
    )

    # Return plot as image
    return fig
