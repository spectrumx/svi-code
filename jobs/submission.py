from django.contrib.auth import get_user_model
from kombu import Connection
from rest_framework.authtoken.models import Token

from .models import Job
from .models import JobLocalFile
from .models import JobStatusUpdate
from .tasks import submit_job

User = get_user_model()


def request_job_submission(
    visualization_type: str,
    owner: User,
    local_files: list[str],
):
    print(
        f"Requesting job submission for {visualization_type}"
        f" with owner {owner.username}",
    )

    # check if there is already a token for this user
    token, created = Token.objects.get_or_create(user=owner)

    job = Job.objects.create(type=visualization_type, owner=owner)
    print(f"Job (submission.py): {job}")

    for local_file in local_files:
        file_obj = JobLocalFile.objects.create(job=job, file=local_file)
        print(f"File created (submission.py): {file_obj}")

    # does this job have a specific submission connection?
    if job.submission_connection:
        connection = Connection(job.submission_connection.broker_connection)
        connection.connect()
        submit_job.apply_async(
            args=[job.id, token.key],
            connection=connection,
        )
    else:
        submit_job.delay(job.id, token.key)

    JobStatusUpdate.objects.create(
        job=job,
        status="submitted",
    )

    return job
