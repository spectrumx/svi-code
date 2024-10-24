from celery import shared_task
from .status import update_job_status


@shared_task
def submit_job(job_id: int, token: str):
    print(f"Submitting job {job_id}")
    update_job_status(job_id, 'running', token)
    



