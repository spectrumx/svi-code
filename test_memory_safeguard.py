#!/usr/bin/env python3
"""
Test script for memory safeguarding functionality.

This script simulates memory usage to test the memory monitoring system.
Run with: python test_memory_safeguard.py
"""

import logging
import threading
import time

import psutil

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global flag to track if memory monitoring is active
_memory_monitor_active = False
_memory_monitor_thread: threading.Thread | None = None


def get_memory_usage() -> dict[str, float]:
    """Get current memory usage statistics.

    Returns:
        dict: Memory usage statistics in MB
    """
    memory_info = psutil.virtual_memory()
    return {
        "rss_mb": memory_info.used / 1024 / 1024,  # Resident Set Size
        "vms_mb": memory_info.total / 1024 / 1024,  # Virtual Memory Size
        "percent": memory_info.percent,
    }


def memory_monitor_worker(
    job_id: int, memory_threshold: float = 95.0, check_interval: float = 1.0
):
    """Background thread to monitor memory usage during task execution.

    Args:
        job_id: The job ID being monitored
        memory_threshold: Memory usage percentage threshold (default 95%)
        check_interval: How often to check memory usage in seconds (default 1s)
    """
    global _memory_monitor_active

    logger.info(
        f"Starting memory monitor for job {job_id} (threshold: {memory_threshold}%, interval: {check_interval}s)"
    )

    while _memory_monitor_active:
        try:
            memory_stats = get_memory_usage()
            memory_percent = memory_stats["percent"]

            logger.info(
                f"Job {job_id}: Memory usage - {memory_percent:.1f}% (RSS: {memory_stats['rss_mb']:.1f}MB)"
            )

            if memory_percent > memory_threshold:
                logger.error(
                    f"Job {job_id}: CRITICAL MEMORY USAGE - {memory_percent:.1f}% exceeds threshold {memory_threshold}%"
                )

                # Force exit the process to prevent system crash
                logger.critical(
                    f"Job {job_id}: Forcing process termination due to memory usage"
                )
                return  # Exit the thread instead of killing the process for testing

            elif memory_percent > 85.0:
                logger.warning(
                    f"Job {job_id}: High memory usage detected - {memory_percent:.1f}%"
                )

            time.sleep(check_interval)

        except Exception as e:
            logger.error(f"Memory monitor error for job {job_id}: {e}")
            time.sleep(check_interval)


def start_memory_monitor(job_id: int, memory_threshold: float = 95.0) -> None:
    """Start memory monitoring for a job.

    Args:
        job_id: The job ID to monitor
        memory_threshold: Memory usage percentage threshold
    """
    global _memory_monitor_active, _memory_monitor_thread

    _memory_monitor_active = True
    _memory_monitor_thread = threading.Thread(
        target=memory_monitor_worker, args=(job_id, memory_threshold), daemon=True
    )
    _memory_monitor_thread.start()
    logger.info(f"Memory monitor started for job {job_id}")


def stop_memory_monitor() -> None:
    """Stop memory monitoring."""
    global _memory_monitor_active, _memory_monitor_thread

    _memory_monitor_active = False
    if _memory_monitor_thread and _memory_monitor_thread.is_alive():
        _memory_monitor_thread.join(timeout=2.0)
        logger.info("Memory monitor stopped")


def simulate_memory_usage(target_percent: float, duration: int = 10):
    """Simulate memory usage by allocating memory.

    Args:
        target_percent: Target memory usage percentage
        duration: How long to maintain the usage in seconds
    """
    logger.info(f"Simulating memory usage to {target_percent}% for {duration} seconds")

    # Get current memory info
    memory_info = psutil.virtual_memory()
    current_percent = memory_info.percent
    available_mb = memory_info.available / 1024 / 1024

    if current_percent >= target_percent:
        logger.warning(
            f"Current memory usage ({current_percent:.1f}%) already exceeds target ({target_percent}%)"
        )
        return

    # Calculate how much memory to allocate
    target_mb = (memory_info.total * target_percent / 100) - (
        memory_info.total * current_percent / 100
    )
    target_mb = max(0, target_mb / 1024 / 1024)  # Convert to MB

    logger.info(f"Allocating {target_mb:.1f}MB to reach {target_percent}% usage")

    # Allocate memory in chunks to avoid immediate OOM
    chunk_size_mb = min(100, target_mb)  # 100MB chunks
    allocated_chunks = []

    try:
        while len(allocated_chunks) * chunk_size_mb < target_mb:
            # Allocate a chunk of memory
            chunk = bytearray(int(chunk_size_mb * 1024 * 1024))
            allocated_chunks.append(chunk)

            # Check current memory usage
            current_percent = psutil.virtual_memory().percent
            logger.info(
                f"Allocated {len(allocated_chunks) * chunk_size_mb:.1f}MB, current usage: {current_percent:.1f}%"
            )

            if current_percent >= target_percent:
                logger.info(f"Reached target memory usage: {current_percent:.1f}%")
                break

            time.sleep(0.1)  # Small delay to allow monitoring to catch up

        # Hold the memory for the specified duration
        logger.info(f"Holding memory usage for {duration} seconds")
        time.sleep(duration)

    finally:
        # Clean up allocated memory
        logger.info("Cleaning up allocated memory")
        allocated_chunks.clear()
        time.sleep(1)  # Allow memory to be freed
        current_percent = psutil.virtual_memory().percent
        logger.info(f"Memory usage after cleanup: {current_percent:.1f}%")


def test_memory_monitoring():
    """Test the memory monitoring functionality."""
    logger.info("=== Testing Memory Monitoring System ===")

    # Test 1: Normal memory usage
    logger.info("\n--- Test 1: Normal memory usage ---")
    start_memory_monitor(1, memory_threshold=95.0)
    time.sleep(3)
    stop_memory_monitor()

    # Test 2: High memory usage (warning level)
    logger.info("\n--- Test 2: High memory usage (warning level) ---")
    start_memory_monitor(2, memory_threshold=95.0)
    simulate_memory_usage(87.0, duration=5)  # Should trigger warnings
    stop_memory_monitor()

    # Test 3: Critical memory usage (threshold level)
    logger.info("\n--- Test 3: Critical memory usage (threshold level) ---")
    start_memory_monitor(3, memory_threshold=95.0)
    simulate_memory_usage(96.0, duration=3)  # Should trigger critical error
    stop_memory_monitor()

    # Test 4: Very high memory usage
    logger.info("\n--- Test 4: Very high memory usage ---")
    start_memory_monitor(4, memory_threshold=95.0)
    simulate_memory_usage(98.0, duration=2)  # Should trigger critical error
    stop_memory_monitor()

    logger.info("\n=== Memory Monitoring Tests Complete ===")


if __name__ == "__main__":
    try:
        test_memory_monitoring()
    except KeyboardInterrupt:
        logger.info("Test interrupted by user")
        stop_memory_monitor()
    except Exception as e:
        logger.error(f"Test failed with error: {e}")
        stop_memory_monitor()
