import requests
from django.conf import settings

def update_job_status(job_id: int, status: str, token: str, info=None):
    headers = {
        'Authorization': f'Token {token}'
    }
    data = {
        'status': status,
        'job': job_id
    }
    if info:
        data['info'] = info
    response = requests.post(f"{settings.API_URL}/api/jobs/update-job-status/", data=info, headers=headers)
    if response.status_code == 201:
        return True
    return False

def get_job_meta(job_id: int, token: str):
    headers = {
        'Authorization': f'Token {token}'
    }
    response = requests.get(f"{settings.API_URL}/api/jobs/job-data/{job_id}/", headers=headers)
    if response.status_code != 200:
        return None
    return response.json()

def get_job_file(file_id, token: str, file_type: str):
    headers = {
        'Authorization': f'Token {token}'
    }
    response = requests.get(f"{settings.API_URL}/api/jobs/job-file/{file_id}", params={'file_type': file_type}, headers=headers)
    if response.status_code != 200:
        return None
    return response.content

def post_results(job_id, token: str, json_data=None, file_data=None, file_name=None):
    fail = False
    # do we have JSON data?
    if json_data:
        headers = {
            'Authorization': f'Token {token}'
        }
        response = requests.post(
            f"{settings.API_URL}/api/jobs/save-job-data/{job_id}/",
            json={'json_data': json_data},
            headers=headers
        )
        if response.status_code != 201:
            fail = True
    if file_data:
        headers = {
            'Authorization': f'Token {token}'
        }
        if not file_name:
            file_name = job_id
        files = {file_name: file_data}
        response = requests.post(
            f"{settings.API_URL}/api/jobs/save-job-data/{job_id}/",
            files=files,
            headers=headers
        )
        if response.status_code != 201:
            fail = True
    return not fail