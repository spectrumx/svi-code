import logging
import time
from typing import TYPE_CHECKING

from django.db import transaction
from kombu import Connection
from rest_framework.authtoken.models import Token

from .models import Job
from .models import JobLocalFile
from .models import JobStatusUpdate
from .tasks import error_handler
from .tasks import submit_job

if TYPE_CHECKING:
    from django.contrib.auth.models import User

logger = logging.getLogger(__name__)


def request_job_submission(
    visualization_type: str,
    owner: "User",
    local_files: list[str],
    config: dict | None = None,
) -> "Job":
    """
    Request a job submission for processing.

    Args:
        visualization_type: The type of visualization to create
        owner: The user who owns the job
        local_files: List of local file paths
        config: Optional configuration dictionary

    Returns:
        Job: The created job object
    """
    # check if there is already a token for this user
    token = Token.objects.get_or_create(user=owner)[0]

    # Use a transaction to ensure job creation is atomic
    with transaction.atomic():
        job = Job.objects.create(
            type=visualization_type,
            owner=owner,
            config=config,
        )

        for local_file in local_files:
            JobLocalFile.objects.create(job=job, file=local_file)

        # Create initial status update
        JobStatusUpdate.objects.create(
            job=job,
            status="pending",
        )

        logger.info(f"Created job {job.id} with status 'pending'")

    # Small delay to ensure job is properly committed to database
    # This helps prevent race conditions where the Celery task starts
    # before the job is fully committed to the database
    time.sleep(0.2)

    # Verify the job exists in the database before queuing the task
    try:
        job.refresh_from_db()
        logger.info(
            f"Verified job {job.id} exists in database before queuing Celery task"
        )
    except Exception as e:
        error_message = f"Failed to verify job {job.id} exists in database: {e}"
        logger.error(error_message)
        # If we can't verify the job exists, we should not queue the task
        raise Exception(error_message)

    # Update status to 'submitted' directly in database BEFORE queuing the task
    # This avoids the API call that might fail due to transaction isolation
    try:
        job.status = "submitted"
        job.save()
        JobStatusUpdate.objects.create(job=job, status="submitted")
        logger.info(f"Updated job {job.id} status to 'submitted'")
    except Exception as e:
        logger.warning(f"Failed to update job {job.id} status to 'submitted': {e}")
        # Don't fail the entire job creation if status update fails

    # Does this job have a specific submission connection?
    if job.submission_connection:
        connection = Connection(job.submission_connection.broker_connection)
        connection.connect()
        submit_job.apply_async(
            args=[job.id, token.key],
            connection=connection,
            # This doesn't seem to work currently
            link_error=error_handler.s(),
            kwargs={"config": job.config},
        )
    else:
        submit_job.delay(job.id, token.key, job.config)

    logger.info(f"Job {job.id} queued for processing with status 'submitted'")
    return job
