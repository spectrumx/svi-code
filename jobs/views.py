"""
Views for handling job-related operations in the Django REST API.

This module provides endpoints for job submission, status updates, metadata retrieval,
and data management. All endpoints requiring authentication use Token Authentication.
"""

from datetime import datetime
from typing import Literal
from typing import TypedDict

from django.http import FileResponse
from django.http import JsonResponse
from kombu import Connection
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view
from rest_framework.decorators import authentication_classes
from rest_framework.decorators import permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Job
from .models import JobData
from .models import JobLocalFile
from .models import JobRemoteFile
from .models import JobStatusUpdate
from .models import JobSubmissionConnection
from .serializers import JobStatusUpdateSerializer
from .submission import request_job_submission


@api_view(["POST"])
def submit_job(request):
    """
    Submit a new job for processing.

    Args:
        request: HTTP request object containing user information

    Returns:
        Response: JSON response indicating submission status
    """
    print("query parameters")
    request_job_submission(
        request.data.get("type"),
        request.user,
        request.data.get("local_files"),
        request.data.get("config"),
    )
    return Response({"status": "success"})


def test_connection(request, connection_id):
    """
    Test broker connection for a specific job submission.

    Args:
        request: HTTP request object
        id: JobSubmissionConnection ID to test

    Returns:
        JsonResponse: Connection test result ('success' or 'failed')
    """
    jsc = JobSubmissionConnection.objects.get(id=connection_id)
    with Connection(jsc.broker_connection) as connection:
        connection.connect()
        result = "success" if connection.connected else "failed"

    return JsonResponse(
        {
            "status": result,
        },
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def create_job_status_update(request):
    """
    Create a new status update for a job.

    Args:
        request: HTTP request containing job status update data

    Returns:
        Response: Serialized job status update data if successful, errors otherwise
    """
    serializer = JobStatusUpdateSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


class LocalFile(TypedDict):
    name: str
    id: int


class JobMetadata(TypedDict):
    type: str
    status: Literal["submitted", "running", "completed", "failed"]
    created_at: datetime
    updated_at: datetime
    local_files: list[LocalFile]
    remote_files: list[str]


class JobMetadataResponse(TypedDict):
    status: Literal["success", "error"]
    data: JobMetadata | None
    message: str | None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def get_job_metadata(request: Request, job_id: int) -> JobMetadataResponse:
    """
    Retrieve metadata for a specific job.

    Args:
        request: HTTP request object
        id: Job ID to retrieve metadata for

    Returns:
        JsonResponse: Job metadata including type, status, timestamps, and
        associated files

    Raises:
        404: If job doesn't exist or user doesn't have permission
    """
    try:
        job = Job.objects.get(id=job_id)
        # Get latest status update
        status_update = (
            JobStatusUpdate.objects.filter(job=job).order_by("-created_at").first()
        )

        # make sure the owner of this job is the person requesting it
        if job.owner != request.user:
            raise_does_not_exist(Job)

        # Get associated files
        local_files = [
            {"name": file.file.name, "id": file.id}
            for file in JobLocalFile.objects.filter(job=job)
        ]
        remote_files = [
            remote_file.file for remote_file in JobRemoteFile.objects.filter(job=job)
        ]

        return JsonResponse(
            {
                "status": "success",
                "data": {
                    "type": job.type,
                    "status": job.status,
                    "created_at": job.created_at,
                    "updated_at": job.updated_at,
                    "local_files": local_files,
                    "remote_files": remote_files,
                    "results_id": status_update.info.get("results_id", None)
                    if status_update
                    else None,
                },
            },
        )

    except Job.DoesNotExist:
        return JsonResponse(
            {
                "status": "error",
                "message": "Job not found",
            },
            status=404,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def get_job_file(request, file_id):
    """
    Retrieve data or files associated with a specific job.

    Args:
        request: HTTP request object with file_type query parameter
        id: Job ID to retrieve data for

    Returns:
        FileResponse: If job has associated file
        Response: Job data if available

    Raises:
        404: If job data doesn't exist or user doesn't have permission
    """
    file_type = request.GET["file_type"]
    job_file = None
    if file_type == "remote":
        job_file = JobRemoteFile
    if file_type == "local":
        job_file = JobLocalFile
    try:
        job_file = job_file.objects.get(id=file_id)

        # make sure the user is the owner of this Job request
        if job_file.job.owner != request.user:
            raise_does_not_exist(job_file)

        response_data = {}

        if job_file.file:
            return FileResponse(
                job_file.file,
                as_attachment=True,
                filename=job_file.file.name.split("/")[-1],
            )

        if job_file.data:
            response_data["data"] = job_file.file

        return Response(
            {
                "status": "success",
                "data": response_data,
            },
        )

    except job_file.DoesNotExist:
        return Response(
            {
                "status": "error",
                "message": "Job data not found",
            },
            status=404,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def get_job_data(request: Request, job_data_id: int) -> FileResponse | Response:
    """
    Retrieve both file and JSON data for a specific job data entry.

    Args:
        request: HTTP request object
        job_data_id: ID of the JobData entry to retrieve

    Returns:
        Union[FileResponse, Response]: Either a FileResponse for file downloads or
        a Response containing both file metadata and JSON data

    Raises:
        404: If job data doesn't exist or user doesn't have permission
    """
    try:
        job_data = JobData.objects.get(id=job_data_id)

        if job_data.job.owner != request.user:
            raise_does_not_exist(JobData)

        # Check if client specifically requests file download
        if request.GET.get("download") == "true" and job_data.file:
            return FileResponse(
                job_data.file,
                as_attachment=True,
                filename=job_data.file.name.split("/")[-1],
            )

        # Prepare response with both file metadata and JSON data
        response_data = {
            "status": "success",
            "data": {
                "json_data": job_data.data if job_data.data else None,
                "file_metadata": None,
            },
        }

        # Add file metadata if a file exists
        if job_data.file:
            response_data["data"]["file_metadata"] = {
                "filename": job_data.file.name,
                "size": job_data.file.size if hasattr(job_data.file, "size") else None,
                "url": request.build_absolute_uri(f"{request.path}?download=true"),
                "content_type": getattr(job_data.file, "content_type", None),
            }

        return Response(response_data)

    except JobData.DoesNotExist:
        return Response(
            {
                "status": "error",
                "message": "Job data not found",
            },
            status=404,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def save_job_data(request, job_id):
    """
    Save data or files associated with a specific job.

    Args:
        request: HTTP request containing data or files to save
        job_id: Job ID to save data for

    Returns:
        Response: Success status and saved data summary

    Raises:
        404: If job doesn't exist or user doesn't have permission
    """
    # look up the job based on the Job ID
    try:
        job_obj = Job.objects.get(id=job_id)
    except Job.DoesNotExist:
        return Response(
            {
                "status": "error",
                "message": "Job data not found",
            },
            status=404,
        )

    # make sure we have authority to make modifications to this job
    if job_obj.owner != request.user:
        return Response(
            {
                "status": "error",
                "message": "Job data not found",
            },
            status=404,
        )

    return_data = {}

    # Handle JSON data if present
    if request.data.get("json_data"):
        data = request.data.get("json_data")
        job_data = JobData.objects.create(job=job_obj, data=data)
        # add new JobData id to return data
        return_data["json_data_id"] = job_data.id
    # Handle files if present
    files = request.FILES
    if files:
        # Store file paths/references in data
        file_paths = {}
        return_data["file_ids"] = {}

        for file_key, file_obj in files.items():
            # Save file and store path
            file_paths[file_key] = f"media/{file_obj.name}"

            job_data = JobData.objects.create(job=job_obj, file=file_obj)
            # add new JobData id to return data
            return_data["file_ids"][file_key] = job_data.id

    return Response(
        {
            "status": "success",
            "message": "Data saved successfully",
            "data": return_data,
        },
        status=201,
    )


def raise_does_not_exist(model):
    raise model.DoesNotExist
