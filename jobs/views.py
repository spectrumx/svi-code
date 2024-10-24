from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .submission import request_job_submission
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from .serializers import JobStatusUpdateSerializer
from .models import JobSubmissionConnection
from kombu import Connection

@api_view(['POST'])
def submit_job(request):
    request_job_submission('waterfall', request.user, ['media/data.csv'])
    return Response({'status': 'success'})

def test_connection(request, id):
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
    serializer = JobStatusUpdateSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)
