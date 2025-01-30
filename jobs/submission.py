from typing import TYPE_CHECKING

from kombu import Connection
from rest_framework.authtoken.models import Token

from .models import Job
from .models import JobLocalFile
from .models import JobStatusUpdate
from .tasks import error_handler
from .tasks import submit_job

if TYPE_CHECKING:
    from django.contrib.auth.models import User


def request_job_submission(
    visualization_type: str,
    owner: "User",
    local_files: list[str],
    config: dict | None = None,
) -> "Job":
    # check if there is already a token for this user
    token = Token.objects.get_or_create(user=owner)[0]

    print(f"Config: {config}")
    job = Job.objects.create(
        type=visualization_type,
        owner=owner,
        config=config,
    )

    print("job in req subm", job)
    for local_file in local_files:
        JobLocalFile.objects.create(job=job, file=local_file)

    # does this job have a specific submission connection?
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

    JobStatusUpdate.objects.create(
        job=job,
        status="submitted",
    )

    return job
