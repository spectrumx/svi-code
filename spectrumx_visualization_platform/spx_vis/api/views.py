from rest_framework import permissions
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from jobs.submission import request_job_submission
from spectrumx_visualization_platform.spx_vis.api.serializers import (
    SigMFFilePairSerializer, CaptureSerializer, IntegratedViewSerializer
)
from spectrumx_visualization_platform.spx_vis.models import SigMFFilePair
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import CaptureDatasetIntegrated

# CaptureView added
class CaptureViewSet(viewsets.ModelViewSet):
    queryset = Capture.objects.all()
    serializer_class = CaptureSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    
    def list(self,request, *args, **kwargs):
        queryset = self.get_queryset()

        serializer = self.get_serializer(queryset, many=True)

        print("Capture list:")
        for item in serializer.data:
            print(item)

        return Response(serializer.data)

# integrated view: combined the SigMFFilePair  and newly created capture
class IntegratedViewSet(viewsets.ModelViewSet):
    queryset = CaptureDatasetIntegrated.objects.all()
    serializer_class = IntegratedViewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def list(self,request, *args, **kwargs):
        queryset = self.get_queryset()

        serializer = self.get_serializer(queryset, many=True)

        print(" list:")
        for item in serializer.data:
            print("items..",item)

        return Response(serializer.data)



class SigMFFilePairViewSet(viewsets.ModelViewSet):
    queryset = SigMFFilePair.objects.all()
    serializer_class = SigMFFilePairSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=["post"])
    def create_spectrogram(self, request, pk=None):
        file_pair: SigMFFilePair = self.get_object()

        # Get FFT size from request parameters, default to 1024 if not provided
        # fft_size = request.data.get("fft_size", 1024)

        # Get the data and metadata file paths
        # get width value
        width = request.data.get("width", 10) # width passed from front end 44
        height = request.data.get("height", 10) # height passed from front end 44
        print("views width and height:", {width}, {height}) # debug line added 44
        dimensions = {"width": width, "height": height} # debug line added  44
        print("views dimensions", dimensions) # debug line added 
        local_files = [file_pair.data_file.file.name, file_pair.meta_file.file.name]

        # Submit the job using the submission function
        job = request_job_submission(
            visualization_type="spectrogram",
            owner=request.user,
            local_files=local_files,
            dimensions=dimensions,     
        )
        

        return Response(
            {
                "job_id": job.id,
                "status": "submitted",
            },
            status=status.HTTP_201_CREATED,
        )
