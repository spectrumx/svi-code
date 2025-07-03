#!/usr/bin/env python3
"""
Test script to verify memory warning system functionality.
This script simulates the memory estimation and warning logic.
"""

import logging

import psutil

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def get_memory_usage() -> dict[str, float]:
    """Get current memory usage statistics."""
    process = psutil.Process()
    memory_info = process.memory_info()
    return {
        "rss_mb": memory_info.rss / 1024 / 1024,  # Resident Set Size
        "vms_mb": memory_info.vms / 1024 / 1024,  # Virtual Memory Size
        "percent": process.memory_percent(),
    }


def estimate_memory_requirements(
    file_paths: list[str], config: dict
) -> dict[str, float]:
    """Estimate memory requirements for a spectrogram job."""
    total_size_mb = 0
    for file_path in file_paths:
        if os.path.exists(file_path):
            total_size_mb += os.path.getsize(file_path) / 1024 / 1024

    # Estimate memory needed for processing (typically 2-4x file size for complex data)
    processing_multiplier = 3.0
    estimated_processing_mb = total_size_mb * processing_multiplier

    # Add overhead for matplotlib and other libraries
    overhead_mb = 500  # 500MB overhead

    return {
        "file_size_mb": total_size_mb,
        "estimated_processing_mb": estimated_processing_mb,
        "total_estimated_mb": estimated_processing_mb + overhead_mb,
    }


def test_memory_warning_system():
    """Test the memory warning system with different scenarios."""

    # Test scenarios with different estimated memory usage
    test_scenarios = [
        {
            "name": "Small dataset",
            "file_paths": [
                "small_file.dat"
            ],  # Will be estimated as 0MB since file doesn't exist
            "config": {},
        },
        {
            "name": "Medium dataset",
            "file_paths": ["medium_file.dat"],
            "config": {"estimated_size_mb": 200},
        },
        {
            "name": "Large dataset",
            "file_paths": ["large_file.dat"],
            "config": {"estimated_size_mb": 800},
        },
        {
            "name": "Very large dataset",
            "file_paths": ["very_large_file.dat"],
            "config": {"estimated_size_mb": 1500},
        },
    ]

    # Get current available memory
    available_memory = psutil.virtual_memory().available / 1024 / 1024  # MB
    logger.info(f"Available system memory: {available_memory:.1f}MB")

    for scenario in test_scenarios:
        logger.info(f"\n--- Testing {scenario['name']} ---")

        # Simulate file size for testing
        if "estimated_size_mb" in scenario["config"]:
            # Mock the file size estimation
            total_size_mb = scenario["config"]["estimated_size_mb"]
        else:
            total_size_mb = 0

        # Calculate memory estimate
        processing_multiplier = 3.0
        estimated_processing_mb = total_size_mb * processing_multiplier
        overhead_mb = 500
        total_estimated_mb = estimated_processing_mb + overhead_mb

        memory_estimate = {
            "file_size_mb": total_size_mb,
            "estimated_processing_mb": estimated_processing_mb,
            "total_estimated_mb": total_estimated_mb,
        }

        logger.info(
            f"Memory estimate - "
            f"Files: {memory_estimate['file_size_mb']:.1f}MB, "
            f"Processing: {memory_estimate['estimated_processing_mb']:.1f}MB, "
            f"Total: {memory_estimate['total_estimated_mb']:.1f}MB"
        )

        # Check memory usage thresholds
        memory_usage_percent = (
            memory_estimate["total_estimated_mb"] / available_memory
        ) * 100

        if (
            memory_estimate["total_estimated_mb"] > available_memory * 0.8
        ):  # 80% of available
            logger.warning(
                f"High memory usage expected - "
                f"Estimated: {memory_estimate['total_estimated_mb']:.1f}MB, "
                f"Available: {available_memory:.1f}MB, "
                f"Usage: {memory_usage_percent:.1f}%. "
                f"Job will proceed but may cause memory pressure."
            )
        elif (
            memory_estimate["total_estimated_mb"] > available_memory * 0.6
        ):  # 60% of available
            logger.info(
                f"Moderate memory usage expected - "
                f"Estimated: {memory_estimate['total_estimated_mb']:.1f}MB, "
                f"Available: {available_memory:.1f}MB, "
                f"Usage: {memory_usage_percent:.1f}%"
            )
        else:
            logger.info(
                f"Low memory usage expected - "
                f"Estimated: {memory_estimate['total_estimated_mb']:.1f}MB, "
                f"Available: {available_memory:.1f}MB, "
                f"Usage: {memory_usage_percent:.1f}%"
            )


if __name__ == "__main__":
    import os

    test_memory_warning_system()
