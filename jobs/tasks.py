from celery import shared_task
import requests
from django.conf import settings
@shared_task
def submit_job(job_id: int, token: str):
    print(f"Submitting job {job_id}")
    requests.post(f"{settings.API_URL}/api/jobs/update-job-status/{job_id}/", data={'status': 'running', 'token': token})


