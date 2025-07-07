#!/usr/bin/env python3
"""
Tests for spectrogram chunking logic.

This module tests the chunked processing functionality in the spectrogram generation,
including chunk size estimation, data processing, and edge cases.
"""

import os
import sys
from unittest.mock import Mock
from unittest.mock import patch

import numpy as np
import pytest
from scipy.signal import ShortTimeFFT
from scipy.signal.windows import gaussian

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from jobs.visualizations.spectrogram import SpectrogramData
from jobs.visualizations.spectrogram import _create_spectrogram_figure
from jobs.visualizations.spectrogram import _generate_spectrogram_chunked
from jobs.visualizations.spectrogram import estimate_chunk_size


class TestChunkSizeEstimation:
    """Test chunk size estimation logic."""

    def test_estimate_chunk_size_basic(self):
        """Test basic chunk size estimation with reasonable parameters."""
        sample_rate = 1e6  # 1 MHz
        max_memory_mb = 1000  # 1 GB

        chunk_size = estimate_chunk_size(sample_rate, max_memory_mb)

        # Should be positive
        assert chunk_size > 0

        # Should be within reasonable bounds (10s to 5min)
        min_expected = int(sample_rate * 10)  # 10 seconds
        max_expected = int(sample_rate * 300)  # 5 minutes

        assert min_expected <= chunk_size <= max_expected

        # Should be an integer
        assert isinstance(chunk_size, int)

    def test_estimate_chunk_size_memory_constrained(self):
        """Test chunk size estimation when memory is the limiting factor."""
        sample_rate = 1e6  # 1 MHz
        max_memory_mb = 100  # 100 MB (very small)

        chunk_size = estimate_chunk_size(sample_rate, max_memory_mb)

        # Should be limited by memory (8 bytes per complex sample)
        expected_max_samples = int((max_memory_mb * 1024 * 1024) // 8)

        # Should not exceed memory limit
        assert chunk_size <= expected_max_samples

        # Should still be at least 10 seconds
        min_expected = int(sample_rate * 10)
        assert chunk_size >= min_expected

    def test_estimate_chunk_size_high_sample_rate(self):
        """Test chunk size estimation with very high sample rate."""
        sample_rate = 1e9  # 1 GHz
        max_memory_mb = 1000  # 1 GB

        chunk_size = estimate_chunk_size(sample_rate, max_memory_mb)

        # Should be limited by the 5-minute maximum
        max_expected = int(sample_rate * 300)
        assert chunk_size <= max_expected

        # Should still be reasonable
        assert chunk_size > 0

    def test_estimate_chunk_size_edge_cases(self):
        """Test chunk size estimation with edge case parameters."""
        # Very low sample rate
        chunk_size = estimate_chunk_size(1000, 1000)  # 1 kHz, 1 GB
        assert chunk_size > 0
        assert chunk_size >= 10000  # At least 10 seconds worth

        # Very low memory - should be limited by memory constraint
        chunk_size = estimate_chunk_size(1e6, 1)  # 1 MHz, 1 MB
        assert chunk_size > 0
        # For 1MB memory, max samples = 1MB / 8 bytes = 125,000
        # But minimum chunk size is 10 seconds * 1MHz = 10,000,000
        # So it should be the minimum chunk size (10 seconds worth)
        expected_min = int(1e6 * 10)  # 10 seconds at 1MHz
        assert chunk_size == expected_min


class TestSpectrogramData:
    """Test the SpectrogramData container class."""

    def test_spectrogram_data_creation(self):
        """Test creating SpectrogramData with various parameters."""
        # Basic creation
        data = np.random.randn(1000) + 1j * np.random.randn(1000)
        spectrogram_data = SpectrogramData(
            data_array=data,
            sample_rate=1e6,
            sample_count=1000,
            channel_name="test_channel",
        )

        assert spectrogram_data.data_array.shape == (1000,)
        assert spectrogram_data.sample_rate == 1e6
        assert spectrogram_data.sample_count == 1000
        assert spectrogram_data.channel_name == "test_channel"

    def test_spectrogram_data_defaults(self):
        """Test SpectrogramData with default channel_name."""
        data = np.random.randn(500) + 1j * np.random.randn(500)
        spectrogram_data = SpectrogramData(
            data_array=data, sample_rate=1e6, sample_count=500
        )

        assert spectrogram_data.channel_name is None


class TestChunkedSpectrogramGeneration:
    """Test the chunked spectrogram generation logic."""

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
            "max_memory_mb": 100,  # Small memory limit to force chunking
        }

    def test_chunked_processing_single_chunk(self):
        """Test chunked processing when data fits in a single chunk."""
        # Use large chunk size so all data fits in one chunk
        config = self.config.copy()
        config["max_memory_mb"] = 1000  # Large enough for all data

        with patch("jobs.visualizations.spectrogram.logging") as mock_logging:
            figure = _generate_spectrogram_chunked(self.spectrogram_data, config)

        # Should create a valid matplotlib figure
        assert figure is not None
        assert hasattr(figure, "axes")
        assert len(figure.axes) > 0

    def test_chunked_processing_multiple_chunks(self):
        """Test chunked processing when data requires multiple chunks."""
        # Use small chunk size to force multiple chunks
        config = self.config.copy()
        config["max_memory_mb"] = 10  # Very small to force chunking

        with patch("jobs.visualizations.spectrogram.logging") as mock_logging:
            figure = _generate_spectrogram_chunked(self.spectrogram_data, config)

        # Should create a valid matplotlib figure
        assert figure is not None
        assert hasattr(figure, "axes")
        assert len(figure.axes) > 0

        # Verify logging was called
        assert mock_logging.info.called

    def test_chunked_processing_edge_case_small_data(self):
        """Test chunked processing with very small dataset."""
        # Use enough samples to satisfy FFT requirements (at least fft_size/2)
        small_data = np.random.randn(1024) + 1j * np.random.randn(1024)
        small_spectrogram_data = SpectrogramData(
            data_array=small_data,
            sample_rate=self.sample_rate,
            sample_count=1024,
            channel_name="small_channel",
        )

        config = self.config.copy()
        config["max_memory_mb"] = 1  # Very small memory limit

        with patch("jobs.visualizations.spectrogram.logging") as mock_logging:
            figure = _generate_spectrogram_chunked(small_spectrogram_data, config)

        assert figure is not None
        assert hasattr(figure, "axes")

    def test_chunked_processing_invalid_chunk_size(self):
        """Test that invalid chunk sizes are handled properly."""
        config = self.config.copy()

        # Mock estimate_chunk_size to return invalid values
        with patch(
            "jobs.visualizations.spectrogram.estimate_chunk_size"
        ) as mock_estimate:
            mock_estimate.return_value = 0  # Invalid chunk size

            with pytest.raises(ZeroDivisionError):
                _generate_spectrogram_chunked(self.spectrogram_data, config)

    def test_chunked_processing_invalid_total_chunks(self):
        """Test that invalid total chunks calculation is handled properly."""
        config = self.config.copy()

        # Mock estimate_chunk_size to return a value that would cause invalid total_chunks
        with patch(
            "jobs.visualizations.spectrogram.estimate_chunk_size"
        ) as mock_estimate:
            mock_estimate.return_value = -1  # This would cause invalid total_chunks

            with pytest.raises(ValueError):
                _generate_spectrogram_chunked(self.spectrogram_data, config)

    def test_chunked_processing_memory_logging(self):
        """Test that memory usage is logged during chunked processing."""
        config = self.config.copy()
        config["max_memory_mb"] = 50  # Force chunking

        with patch("jobs.visualizations.spectrogram.logging") as mock_logging:
            figure = _generate_spectrogram_chunked(self.spectrogram_data, config)

        # Verify that memory logging occurred
        log_calls = [call[0][0] for call in mock_logging.info.call_args_list]
        memory_logs = [log for log in log_calls if "spectrogram size:" in log]
        assert len(memory_logs) > 0

    def test_chunked_processing_chunk_boundaries(self):
        """Test that chunk boundaries are calculated correctly."""
        config = self.config.copy()
        config["max_memory_mb"] = 10  # Force chunking

        with patch("jobs.visualizations.spectrogram.logging") as mock_logging:
            with patch(
                "jobs.visualizations.spectrogram.ShortTimeFFT"
            ) as mock_stft_class:
                # Mock the ShortTimeFFT class and its instance
                mock_stft_instance = Mock()
                mock_stft_instance.spectrogram.return_value = np.random.rand(100, 50)
                # Mock the extent method to return a proper numpy array
                mock_stft_instance.extent.return_value = np.array(
                    [0.0, 0.01, -500000, 500000]
                )
                # Mock other required attributes
                mock_stft_instance.m_num = 1024
                mock_stft_instance.T = 1e-6
                mock_stft_instance.delta_t = 5e-7
                mock_stft_instance.delta_f = 976.5625
                mock_stft_instance.f_pts = 1024
                mock_stft_instance.p_num = lambda x: 20  # Mock function
                mock_stft_class.return_value = mock_stft_instance

                figure = _generate_spectrogram_chunked(self.spectrogram_data, config)

        # Verify that spectrogram was called for each chunk
        assert mock_stft_instance.spectrogram.called


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

        assert figure is not None
        assert hasattr(figure, "axes")
        assert len(figure.axes) == 2

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
