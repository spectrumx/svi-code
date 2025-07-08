#!/usr/bin/env python3
"""
Test script for zombie job detection functionality.

This script simulates zombie job detection by creating a job that appears to be running
but isn't actually on any worker.
Run with: python test_zombie_detection.py
"""

import os
import sys

import django
import pytest

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from jobs.models import Job
from jobs.models import JobStatusUpdate
from jobs.tasks import check_job_running_on_worker
from jobs.tasks import detect_zombie_job
from spectrumx_visualization_platform.users.models import User


@pytest.mark.django_db(transaction=True)
def test_zombie_detection():
    """Test the zombie job detection functionality."""
    print("=== Testing Zombie Job Detection ===")

    # Get or create a test user
    user, created = User.objects.get_or_create(
        username="test_user",
        defaults={
            "email": "test@example.com",
            "name": "Test User",
        },
    )

    if created:
        print(f"Created test user: {user.username}")
    else:
        print(f"Using existing test user: {user.username}")

    # Create a job that appears to be running
    job = Job.objects.create(
        owner=user,
        type="spectrogram",
        status="running",
        config={"test": True},
    )

    print(f"\nCreated test job {job.id} with status 'running'")

    # Test 1: Check if job is running on worker (should be False for our test job)
    print("\n--- Test 1: Check if job is running on worker ---")
    is_running = check_job_running_on_worker(job.id)
    print(f"Job {job.id} running on worker: {is_running}")

    # Test 2: Detect zombie job
    print("\n--- Test 2: Detect zombie job ---")
    is_zombie = detect_zombie_job(job)
    print(f"Job {job.id} is zombie: {is_zombie}")

    if is_zombie:
        print("✓ Zombie detection working correctly!")
    else:
        print("✗ Zombie detection failed - job should be detected as zombie")

    # Test 3: Simulate periodic zombie detection task
    print("\n--- Test 3: Simulate periodic zombie detection task ---")
    from jobs.tasks import check_zombie_jobs

    result = check_zombie_jobs()
    print(f"Periodic task result: {result}")

    # Check job status after periodic task
    job.refresh_from_db()
    print(f"Job {job.id} status after periodic task: {job.status}")

    # Check if status update was created
    status_updates = JobStatusUpdate.objects.filter(job=job)
    print(f"Status updates created: {status_updates.count()}")

    for update in status_updates:
        print(f"  - Status: {update.status}, Info: {update.info}")

    # Test 4: Test with a completed job (should not be detected as zombie)
    print("\n--- Test 4: Test with completed job ---")
    completed_job = Job.objects.create(
        owner=user,
        type="spectrogram",
        status="completed",
        config={"test": True},
    )

    is_zombie = detect_zombie_job(completed_job)
    print(f"Completed job {completed_job.id} is zombie: {is_zombie}")

    if not is_zombie:
        print("✓ Correctly ignored completed job!")
    else:
        print("✗ Incorrectly detected completed job as zombie")

    # Clean up test jobs
    print("\n--- Cleanup ---")
    job.delete()
    completed_job.delete()
    print("Test jobs cleaned up")

    print("\n=== Zombie Detection Tests Complete ===")


if __name__ == "__main__":
    try:
        test_zombie_detection()
    except Exception as e:
        print(f"Test failed with error: {e}")
        import traceback

        traceback.print_exc()
