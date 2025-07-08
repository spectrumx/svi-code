"""
Tests for spectrogram generation logic.

This module tests the spectrogram generation functionality,
including data loading and figure creation.
"""

import sys
from pathlib import Path

import numpy as np
import pytest
from scipy.signal import ShortTimeFFT
from scipy.signal.windows import gaussian

# Add the project root to the Python path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from jobs.visualizations.spectrogram import SpectrogramData
from jobs.visualizations.spectrogram import _create_spectrogram_figure
from jobs.visualizations.spectrogram import _generate_spectrogram


class TestSpectrogramData:
    """Test the SpectrogramData container class."""

    def test_spectrogram_data_creation(self):
        """Test creating SpectrogramData with various parameters."""
        # Basic creation
        sample_rate = 1e6
        sample_count = 1000
        data = np.random.randn(sample_count) + 1j * np.random.randn(sample_count)
        spectrogram_data = SpectrogramData(
            data_array=data,
            sample_rate=sample_rate,
            sample_count=sample_count,
            channel_name="test_channel",
        )

        assert spectrogram_data.data_array.shape == (sample_count,)
        assert spectrogram_data.sample_rate == sample_rate
        assert spectrogram_data.sample_count == sample_count
        assert spectrogram_data.channel_name == "test_channel"

    def test_spectrogram_data_defaults(self):
        """Test SpectrogramData with default channel_name."""
        data = np.random.randn(500) + 1j * np.random.randn(500)
        spectrogram_data = SpectrogramData(
            data_array=data, sample_rate=1e6, sample_count=500
        )

        assert spectrogram_data.channel_name is None


class TestSpectrogramGeneration:
    """Test the spectrogram generation logic."""

    def setup_method(self):
        """Set up test data for each test method."""
        # Create test data
        self.sample_rate = 1e6  # 1 MHz
        self.sample_count = 10000
        self.data_array = np.random.randn(self.sample_count) + 1j * np.random.randn(
            self.sample_count
        )

        self.spectrogram_data = SpectrogramData(
            data_array=self.data_array,
            sample_rate=self.sample_rate,
            sample_count=self.sample_count,
            channel_name="test_channel",
        )

        self.config = {
            "stdDev": 100,
            "fftSize": 1024,
            "hopSize": 500,
            "width": 10,
            "height": 8,
            "colormap": "viridis",
        }

    def test_spectrogram_generation_basic(self):
        """Test basic spectrogram generation."""
        figure = _generate_spectrogram(self.spectrogram_data, self.config)

        # Should create a valid matplotlib figure
        assert figure is not None
        assert hasattr(figure, "axes")
        assert len(figure.axes) > 0

    def test_spectrogram_generation_small_data(self):
        """Test spectrogram generation with very small dataset."""
        # Use enough samples to satisfy FFT requirements (at least fft_size/2)
        small_data = np.random.randn(1024) + 1j * np.random.randn(1024)
        small_spectrogram_data = SpectrogramData(
            data_array=small_data,
            sample_rate=self.sample_rate,
            sample_count=1024,
            channel_name="small_channel",
        )

        figure = _generate_spectrogram(small_spectrogram_data, self.config)

        assert figure is not None
        assert hasattr(figure, "axes")


class TestSpectrogramFigureCreation:
    """Test the spectrogram figure creation logic."""

    def setup_method(self):
        """Set up test data for figure creation tests."""
        self.sample_rate = 1e6
        self.sample_count = 1000
        self.data_array = np.random.randn(self.sample_count) + 1j * np.random.randn(
            self.sample_count
        )

        self.spectrogram_data = SpectrogramData(
            data_array=self.data_array,
            sample_rate=self.sample_rate,
            sample_count=self.sample_count,
            channel_name="test_channel",
        )

        self.config = {
            "stdDev": 100,
            "fftSize": 1024,
            "hopSize": 500,
            "width": 10,
            "height": 8,
            "colormap": "viridis",
        }

    def test_create_spectrogram_figure_basic(self):
        """Test basic figure creation."""
        # Create a mock spectrogram
        spectrogram = np.random.rand(100, 50)

        # Create ShortTimeFFT object
        gaussian_window = gaussian(1024, std=100, sym=True)
        short_time_fft = ShortTimeFFT(
            gaussian_window,
            hop=500,
            fs=self.sample_rate,
            mfft=1024,
            fft_mode="centered",
        )

        figure = _create_spectrogram_figure(
            spectrogram, short_time_fft, self.spectrogram_data, self.config
        )

        num_axes = 2

        assert figure is not None
        assert hasattr(figure, "axes")
        assert len(figure.axes) == num_axes

        # Check that the figure has the expected properties
        ax = figure.axes[0]
        assert ax.get_title() != ""
        assert ax.get_xlabel() != ""
        assert ax.get_ylabel() != ""

    def test_create_spectrogram_figure_custom_colormap(self):
        """Test figure creation with custom colormap."""
        spectrogram = np.random.rand(100, 50)
        gaussian_window = gaussian(1024, std=100, sym=True)
        short_time_fft = ShortTimeFFT(
            gaussian_window,
            hop=500,
            fs=self.sample_rate,
            mfft=1024,
            fft_mode="centered",
        )

        config_with_colormap = self.config.copy()
        config_with_colormap["colormap"] = "plasma"

        figure = _create_spectrogram_figure(
            spectrogram, short_time_fft, self.spectrogram_data, config_with_colormap
        )

        assert figure is not None
        # Note: We can't easily test the colormap was applied without more complex matplotlib testing


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])
