from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .submission import request_job_submission
from .models import Job

@api_view(['POST'])
def submit_job(request):
    request_job_submission('waterfall', request.user, ['media/data.csv'])
    return Response({'status': 'success'})

def update_job_status(request, job_id):
    job = Job.objects.get(id=job_id, token=request.POST['token'])
    job.status = request.POST['status']
    job.save()
    return JsonResponse({'status': 'success'})