"""
Tests for the memory manager functionality.

This module tests the memory manager's job registration, monitoring,
and termination capabilities.
"""

from unittest.mock import MagicMock

import pytest

from jobs.memory_manager import memory_manager


@pytest.fixture(autouse=True)
def _reset_memory_manager():
    """Reset the memory manager's state before each test."""
    # Unregister all jobs and stop monitor
    # ruff: noqa: SLF001
    memory_manager._active_jobs.clear()
    memory_manager._memory_monitor_active = False
    memory_manager._memory_monitor_thread = None
    yield
    # ruff: noqa: SLF001
    memory_manager._active_jobs.clear()
    memory_manager._memory_monitor_active = False
    memory_manager._memory_monitor_thread = None


def test_register_and_unregister_job() -> None:
    """Test registering and unregistering a job updates active jobs correctly."""
    job_id = 123
    estimated_memory_mb = 100
    task_id = "task-abc"

    memory_manager.register_job(
        job_id, estimated_memory_mb=estimated_memory_mb, task_id=task_id
    )

    assert memory_manager.get_active_jobs_count() == 1
    info = memory_manager.get_active_jobs_info()
    assert job_id in info
    assert info[job_id]["estimated_memory_mb"] == estimated_memory_mb
    assert info[job_id]["task_id"] == task_id

    memory_manager.unregister_job(job_id)
    assert memory_manager.get_active_jobs_count() == 0


def test_update_job_memory_estimate_and_task_id() -> None:
    """Test updating job memory estimate and task ID."""
    job_id = 456
    task_id = "task-xyz"
    estimated_memory_mb = 50
    new_estimated_memory_mb = 200

    memory_manager.register_job(job_id, estimated_memory_mb=estimated_memory_mb)
    memory_manager.update_job_memory_estimate(job_id, new_estimated_memory_mb)
    memory_manager.update_job_task_id(job_id, task_id)
    info = memory_manager.get_active_jobs_info()[job_id]

    assert info["estimated_memory_mb"] == new_estimated_memory_mb
    assert info["task_id"] == task_id


def test_terminate_job_manual(monkeypatch) -> None:
    """Test manual job termination calls Celery revoke and unregisters the job."""
    job_id = 789
    task_id = "celery-task-1"
    memory_manager.register_job(job_id, estimated_memory_mb=10, task_id=task_id)

    # Patch _terminate_celery_task to simulate success
    monkeypatch.setattr(
        memory_manager,
        "_terminate_celery_task",
        lambda tid, jid: tid == task_id and jid == job_id,
    )
    result = memory_manager.terminate_job(job_id, reason="test")
    assert result is True
    assert memory_manager.get_active_jobs_count() == 0


def test_terminate_job_no_task() -> None:
    """Test terminate_job when no task_id is present (should still unregister)."""
    job_id = 101
    memory_manager.register_job(job_id, estimated_memory_mb=5, task_id=None)
    result = memory_manager.terminate_job(job_id, reason="no-task")
    assert result is True
    assert memory_manager.get_active_jobs_count() == 0


def test_memory_monitor_triggers_termination(monkeypatch) -> None:
    """Test that the memory monitor triggers job termination when threshold is exceeded."""
    job_id = 202
    task_id = "celery-task-2"
    memory_manager.register_job(job_id, estimated_memory_mb=999, task_id=task_id)

    # Patch psutil.virtual_memory to simulate high memory usage
    fake_mem = MagicMock()
    fake_mem.percent = 99.0
    fake_mem.used = 1024 * 1024 * 1024  # 1GB
    fake_mem.total = 2 * 1024 * 1024 * 1024  # 2GB
    monkeypatch.setattr("psutil.virtual_memory", lambda: fake_mem)
    monkeypatch.setattr(
        memory_manager, "get_process_memory_usage", lambda: {9999: 1000}
    )
    monkeypatch.setattr(memory_manager, "_terminate_celery_task", lambda tid, jid: True)  # noqa: ARG005

    # Mock Job model
    mock_job = MagicMock()
    mock_job.owner = MagicMock()
    monkeypatch.setattr("jobs.memory_manager.Job", MagicMock())
    monkeypatch.setattr(
        "jobs.memory_manager.Job.objects.get",
        lambda **kwargs: mock_job,  # noqa: ARG005
    )

    # Mock Token model with proper get_or_create return value
    mock_token = MagicMock()
    mock_token.key = "test-token-key"
    monkeypatch.setattr("jobs.memory_manager.Token", MagicMock())
    monkeypatch.setattr(
        "jobs.memory_manager.Token.objects.get_or_create",
        lambda user, **kwargs: (mock_token, True),  # noqa: ARG005
    )

    monkeypatch.setattr(
        "jobs.memory_manager.update_job_status",
        lambda *a, **kw: True,  # noqa: ARG005
    )

    # Run the monitor worker once (not as a thread)
    memory_manager._memory_monitor_active = True
    memory_manager._memory_monitor_worker(memory_threshold=95.0, check_interval=0.01)
    # After termination, job should be unregistered
    assert memory_manager.get_active_jobs_count() == 0
