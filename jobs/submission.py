from .models import JobSubmissionConnection, Job, JobLocalFile
from .tasks import submit_job
from rest_framework.authtoken.models import Token
from kombu import Connection

from django.contrib.auth import get_user_model
User = get_user_model()


def request_job_submission(visualization_type: str, owner: User, local_files: list[str]):
    # check if there is already a token for this user
    token, created = Token.objects.get_or_create(user=owner)

    job = Job.objects.create(type=visualization_type, owner=owner)

    # connection = JobSubmissionConnection.objects.filter(user=owner).first()
    # job.submission_connection = connection
    # job.save()
    
    for local_file in local_files:
        JobLocalFile.objects.create(job=job, file=local_file)

    # does this job have a specific submission connection?
    if job.submission_connection:
        connection = Connection(job.submission_connection.broker_connection)
        connection.connect()
        submit_job.apply_async(
            args=[job.id, token.key],
            connection=connection
        )
    else:
        submit_job.delay(job.id, token.key)
