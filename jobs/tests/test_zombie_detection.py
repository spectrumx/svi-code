"""
Test suite for zombie job detection functionality.

This module tests zombie job detection by creating jobs that appear to be running
but aren't actually on any worker.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractUser

from jobs.models import Job
from jobs.models import JobStatusUpdate
from jobs.tasks import check_job_running_on_worker
from jobs.tasks import check_zombie_jobs
from jobs.tasks import detect_zombie_job

User = get_user_model()


@pytest.fixture()
def test_user() -> AbstractUser:
    """Create a test user for job testing."""
    user, _ = User.objects.get_or_create(
        username="test_user",
        defaults={
            "email": "test@example.com",
            "name": "Test User",
        },
    )
    return user


@pytest.fixture()
def running_job(test_user: AbstractUser) -> Job:
    """Create a job that appears to be running."""
    return Job.objects.create(
        owner=test_user,
        type="spectrogram",
        status="running",
        config={"test": True},
    )


@pytest.fixture()
def completed_job(test_user: AbstractUser) -> Job:
    """Create a completed job for testing."""
    return Job.objects.create(
        owner=test_user,
        type="spectrogram",
        status="completed",
        config={"test": True},
    )


@pytest.mark.django_db(transaction=True)
def test_check_job_running_on_worker(running_job: Job) -> None:
    """Test that a job not actually running on worker returns False."""
    is_running = check_job_running_on_worker(running_job.id)
    assert not is_running, f"Job {running_job.id} should not be running on worker"


@pytest.mark.django_db(transaction=True)
def test_detect_zombie_job(running_job: Job) -> None:
    """Test that a running job not on worker is detected as zombie."""
    is_zombie = detect_zombie_job(running_job)
    assert is_zombie, f"Job {running_job.id} should be detected as zombie"


@pytest.mark.django_db(transaction=True)
def test_detect_zombie_job_completed_job(completed_job: Job) -> None:
    """Test that a completed job is not detected as zombie."""
    is_zombie = detect_zombie_job(completed_job)
    assert (
        not is_zombie
    ), f"Completed job {completed_job.id} should not be detected as zombie"


@pytest.mark.django_db(transaction=True)
def test_check_zombie_jobs_periodic_task(running_job: Job) -> None:
    """Test the periodic zombie detection task."""
    # Run the periodic task
    result = check_zombie_jobs()

    # Refresh the job to get updated status
    running_job.refresh_from_db()

    # Verify the task completed successfully
    assert result is not None, "Periodic task should return a result"

    # Check if job status was updated (should be marked as failed or similar)
    # Note: The exact status depends on the implementation of check_zombie_jobs
    assert running_job.status != "running", "Zombie job status should be updated"


@pytest.mark.django_db(transaction=True)
def test_zombie_job_status_updates(running_job: Job) -> None:
    """Test that zombie detection creates appropriate status updates."""
    # Run zombie detection
    detect_zombie_job(running_job)

    # Check if status updates were created
    status_updates = JobStatusUpdate.objects.filter(job=running_job)

    # Should have at least one status update
    assert status_updates.exists(), "Should create status updates for zombie job"

    # Verify the status update content
    latest_update = status_updates.latest("created_at")
    assert latest_update is not None, "Should have a latest status update"


@pytest.mark.django_db(transaction=True)
def test_multiple_zombie_jobs(test_user: AbstractUser) -> None:
    """Test detection of multiple zombie jobs."""
    # Create multiple running jobs
    jobs = []
    for i in range(3):
        job = Job.objects.create(
            owner=test_user,
            type="spectrogram",
            status="running",
            config={"test": True, "index": i},
        )
        jobs.append(job)

    # Check that all are detected as zombies
    for job in jobs:
        is_zombie = detect_zombie_job(job)
        assert is_zombie, f"Job {job.id} should be detected as zombie"

    # Run periodic task
    result = check_zombie_jobs()
    assert result is not None, "Periodic task should complete successfully"

    # Verify all jobs were processed
    for job in jobs:
        job.refresh_from_db()
        assert job.status != "running", f"Job {job.id} status should be updated"
