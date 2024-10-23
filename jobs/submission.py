from .models import JobSubmissionConnection, Job, JobLocalFile
from .tasks import submit_job
from django.contrib.auth import get_user_model
User = get_user_model()
from celery import Celery

def request_job_submission(visualization_type: str, owner: User, local_files: list[str]):
    job = Job.objects.create(type=visualization_type, owner=owner)
    
    for local_file in local_files:
        JobLocalFile.objects.create(job=job, file=local_file)

    # does this job have a specific submission connection?
    if job.submission_connection:
        submit_job.apply_async(args=[job.id, job.token], broker=job.submission_connection.broker_connection)
    else:
        submit_job.delay(job.id, job.token)
