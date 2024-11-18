import requests
from django.conf import settings

def update_job_status(job_id: int, status: str, token: str):
    headers = {
        'Authorization': f'Token {token}'
    }
    requests.post(f"{settings.API_URL}/api/jobs/update-job-status/", data={'status': status, 'job': job_id}, headers=headers)
    return True

def get_job_meta(job_id: int, token: str):
    headers = {
        'Authorization': f'Token {token}'
    }
    response = requests.get(f"{settings.API_URL}/api/jobs/job-data/{job_id}", headers=headers)
    return response.json()

def get_job_file(file_id, token: str, file_type: str):
    headers = {
        'Authorization': f'Token {token}'
    }
    response = requests.get(f"{settings.API_URL}/api/jobs/job-file/{file_id}", params={'file_type': file_type}, headers=headers)
    return response.content

def post_results(job_id, token: str, json_data=None, file_data=None):
    # do we have JSON data?
    if json_data:
        headers = {
            'Authorization': f'Token {token}'
        }
        requests.post(
            f"{settings.API_URL}/api/jobs/save-job-data/{job_id}/",
            json={'json_data': json_data},
            headers=headers
        )
    if file_data:
        headers = {
            'Authorization': f'Token {token}'
        }
        files = {'file': file_data}
        requests.post(
            f"{settings.API_URL}/api/jobs/save-job-data/{job_id}/",
            files=files,
            headers=headers
        )