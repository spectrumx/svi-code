import json
import logging

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

logger = logging.getLogger(__name__)


def create_retry_session(
    total_retries: int = 3,
    backoff_factor: float = 0.3,
    status_forcelist: list[int] | None = None,
    allowed_methods: set[str] | None = None,
) -> requests.Session:
    """
    Create a requests session with retry capabilities.

    Args:
        total_retries: Maximum number of retries
        backoff_factor: Backoff factor for retry delays
        status_forcelist: HTTP status codes to retry on
        allowed_methods: HTTP methods to retry on

    Returns:
        requests.Session: Configured session with retry capabilities
    """
    if status_forcelist is None:
        status_forcelist = [500, 502, 503, 504]
    if allowed_methods is None:
        allowed_methods = {"GET", "POST"}

    session = requests.Session()
    retry_strategy = Retry(
        total=total_retries,
        backoff_factor=backoff_factor,
        status_forcelist=status_forcelist,
        allowed_methods=allowed_methods,
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    return session


# Create a default session with retry capabilities
_default_retry_session = create_retry_session()


def update_job_status(job_id: int, status: str, token: str, info=None, retry=True):
    """
    Update the status of a job in the API.

    Args:
        job_id (int): The ID of the job to update
        status (str): The new status to set
        token (str): Authentication token for API access
        info (dict, optional): Additional information to include with the status update
        retry (bool, optional): Whether to retry the request if it fails
    Returns:
        bool: True if update was successful, False otherwise
    """
    headers = {
        "Authorization": f"Token {token}",
    }
    data = {
        "status": status,
        "job": job_id,
    }
    if info:
        data["info"] = json.dumps(info)

    logger.info(f"Updating job {job_id} status to '{status}'")
    logger.debug(f"API_URL: {settings.API_URL}")

    try:
        if retry:
            response = _default_retry_session.post(
                f"{settings.API_URL}/api/jobs/update-job-status/",
                data=data,
                headers=headers,
                timeout=60,
            )
        else:
            response = requests.post(
                f"{settings.API_URL}/api/jobs/update-job-status/",
                data=data,
                headers=headers,
                timeout=60,
            )

        if response.status_code == requests.codes.created:
            logger.info(f"Successfully updated job {job_id} status to '{status}'")
            return True
        else:
            logger.error(
                f"Failed to update job {job_id} status to '{status}'. "
                f"Status code: {response.status_code}, Response: {response.text}"
            )

            # If the job doesn't exist, log this specifically
            if response.status_code == 400 and "object does not exist" in response.text:
                logger.error(
                    f"Job {job_id} does not exist in the database - this may indicate a transaction isolation issue"
                )

            return False
    except requests.exceptions.RequestException as e:
        logger.error(
            f"Request exception while updating job {job_id} status to '{status}': {e}"
        )
        return False
    except Exception as e:
        logger.error(
            f"Unexpected error while updating job {job_id} status to '{status}': {e}"
        )
        return False


def get_job_meta(job_id: int, token: str):
    """
    Retrieve metadata for a specific job from the API.

    Args:
        job_id (int): The ID of the job to retrieve metadata for
        token (str): Authentication token for API access

    Returns:
        dict: Job metadata if successful, None if request fails
    """
    headers = {
        "Authorization": f"Token {token}",
    }

    logger.info(f"Fetching metadata for job {job_id}")

    try:
        response = _default_retry_session.get(
            f"{settings.API_URL}/api/jobs/job-metadata/{job_id}/",
            headers=headers,
            timeout=60,
        )

        if response.status_code == requests.codes.ok:
            logger.info(f"Successfully fetched metadata for job {job_id}")
            return response.json()
        else:
            logger.error(
                f"Failed to get job metadata for job {job_id}. "
                f"Status code: {response.status_code}, Response: {response.text}"
            )
            return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Request exception while fetching job {job_id} metadata: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error while fetching job {job_id} metadata: {e}")
        return None


def get_job_file(file_id, token: str, file_type: str):
    """
    Download a specific file associated with a job.

    Args:
        file_id: The ID of the file to retrieve
        token (str): Authentication token for API access
        file_type (str): Type of file to retrieve

    Returns:
        bytes: File content if successful, None if request fails
    """
    headers = {
        "Authorization": f"Token {token}",
    }
    response = _default_retry_session.get(
        f"{settings.API_URL}/api/jobs/job-file/{file_id}/",
        params={"file_type": file_type},
        headers=headers,
        timeout=60,
    )

    if response.status_code != requests.codes.ok:
        return None
    return response.content


def post_results(job_id, token: str, json_data=None, file_data=None, file_name=None):
    """
    Upload job results to the API, supporting both JSON data and file uploads.

    Args:
        job_id: The ID of the job to post results for
        token (str): Authentication token for API access
        json_data (dict, optional): JSON data to upload
        file_data (bytes, optional): File content to upload
        file_name (str, optional): Name for the uploaded file, defaults to job_id

    Returns:
        bool: True if all uploads were successful, False if any upload failed
    """
    if not json_data and not file_data:
        return False

    headers = {
        "Authorization": f"Token {token}",
    }
    fail = False

    # do we have JSON data?
    if json_data:
        response = _default_retry_session.post(
            f"{settings.API_URL}/api/jobs/save-job-data/{job_id}/",
            json={"json_data": json_data},
            headers=headers,
            timeout=60,
        )
        if response.status_code != requests.codes.created:
            fail = True
    if file_data:
        if not file_name:
            file_name = job_id
        files = {file_name: file_data}
        response = _default_retry_session.post(
            f"{settings.API_URL}/api/jobs/save-job-data/{job_id}/",
            files=files,
            headers=headers,
            timeout=60,
        )
        if response.status_code != requests.codes.created:
            fail = True

    if fail:
        return False
    return response.json()["data"]
