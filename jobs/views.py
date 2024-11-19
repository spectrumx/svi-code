"""
Views for handling job-related operations in the Django REST API.

This module provides endpoints for job submission, status updates, metadata retrieval,
and data management. All endpoints requiring authentication use Token Authentication.
"""

from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .submission import request_job_submission
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from .serializers import JobStatusUpdateSerializer
from .models import Job, JobLocalFile, JobRemoteFile, JobSubmissionConnection, JobData
from kombu import Connection
from django.http import FileResponse

@api_view(['POST'])
def submit_job(request):
    """
    Submit a new job for processing.
    
    Args:
        request: HTTP request object containing user information
        
    Returns:
        Response: JSON response indicating submission status
    """
    request_job_submission('waterfall', request.user, ['data.csv'])
    return Response({'status': 'success'})

def test_connection(request, id):
    """
    Test broker connection for a specific job submission.
    
    Args:
        request: HTTP request object
        id: JobSubmissionConnection ID to test
        
    Returns:
        JsonResponse: Connection test result ('success' or 'failed')
    """
    jsc = JobSubmissionConnection.objects.get(id=id)
    with Connection(jsc.broker_connection) as connection:
        connection.connect()
        result = 'success' if connection.connected else 'failed'
        
    return JsonResponse({
        'status': result
    })

@api_view(['POST'])
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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def get_job_metadata(request, id):
    """
    Retrieve metadata for a specific job.
    
    Args:
        request: HTTP request object
        id: Job ID to retrieve metadata for
        
    Returns:
        JsonResponse: Job metadata including type, status, timestamps, and associated files
    
    Raises:
        404: If job doesn't exist or user doesn't have permission
    """
    try:
        job = Job.objects.get(id=id)

        # make sure the owner of this job is the person requesting it
        if job.owner != request.user:
            raise Job.DoesNotExist
        
        # Get associated files
        local_files = [{'name': file.file.name, 'id': file.id} for file in JobLocalFile.objects.filter(job=job)]
        remote_files = [remote_file.file for remote_file in JobRemoteFile.objects.filter(job=job)]
        
        return JsonResponse({
            'status': 'success',
            'data': {
                'type': job.type,
                'status': job.status,
                'created_at': job.created_at,
                'updated_at': job.updated_at,
                'local_files': local_files,
                'remote_files': remote_files
            }
        })
        
    except Job.DoesNotExist:
        return JsonResponse({
            'status': 'error', 
            'message': 'Job not found'
        }, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def get_job_data(request, id):
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
    file_type = request.GET['file_type']
    JobData = None
    if file_type == 'remote':
        JobData = JobRemoteFile
    if file_type == 'local':
        JobData = JobLocalFile
    try:
        job_data = JobData.objects.get(job_id=id)

        # make sure the user is the owner of this Job request
        if job_data.job.owner != request.user:
            raise JobData.DoesNotExist
        
        response_data = {}
        
        if job_data.file:
            return FileResponse(job_data.file, as_attachment=True, filename=job_data.file.name.split('/')[-1])
            
        if job_data.data:
            response_data['data'] = job_data.file
            
        return Response({
            'status': 'success',
            'data': response_data
        })
        
    except JobData.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Job data not found'
        }, status=404)


@api_view(['POST'])
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
        return Response({
            'status': 'error',
            'message': 'Job data not found'
        }, status=404)

    # make sure we have authority to make modifications to this job
    if job_obj.owner != request.user:
        return Response({
            'status': 'error',
            'message': 'Job data not found'
        }, status=404)
    
    # Handle JSON data if present
    data = {}
    if request.data.get('json_data'):
        data.update(request.data.get('json_data'))
        JobData.objects.create(job=job_obj, data=data)
    # Handle files if present
    files = request.FILES
    if files:
        # Store file paths/references in data
        file_paths = {}
        for file_key, file_obj in files.items():
            # Save file and store path
            file_paths[file_key] = f'media/{file_obj.name}'
            
            JobData.objects.create(job=job_obj, file=file_obj)
    
    return Response({
        'status': 'success',
        'message': 'Data saved successfully',
        'data': data
    }, status=201)
