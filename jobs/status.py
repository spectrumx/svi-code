import requests
from django.conf import settings

def update_job_status(job_id: int, status: str, token: str):
    headers = {
        'Authorization': f'Token {token}'
    }
    requests.post(f"{settings.API_URL}/api/jobs/update-job-status/", data={'status': status, 'job': job_id}, headers=headers)
    return True