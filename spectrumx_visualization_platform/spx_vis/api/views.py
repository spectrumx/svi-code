from rest_framework import permissions
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from jobs.submission import request_job_submission
from spectrumx_visualization_platform.spx_vis.api.serializers import (
    SigMFFilePairSerializer,
)
from spectrumx_visualization_platform.spx_vis.models import SigMFFilePair


class SigMFFilePairViewSet(viewsets.ModelViewSet):
    queryset = SigMFFilePair.objects.all()
    serializer_class = SigMFFilePairSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=["post"])
    def create_spectrogram(self, request, pk=None):
        print("Creating spectrogram")
        print(request.data)

        file_pair: SigMFFilePair = self.get_object()

        # Get FFT size from request parameters, default to 1024 if not provided
        # Not currently used, though
        fft_size = request.data.get("fft_size", 1024)
        print(f"FFT size: {fft_size}")

        # Get the data and metadata file paths
        local_files = [file_pair.data_file.file.name, file_pair.meta_file.file.name]

        # Submit the job using the submission function
        job = request_job_submission(
            visualization_type="spectrogram",
            owner=request.user,
            local_files=local_files,
        )
        print(f"Job (views.py): {job}")

        return Response(
            {
                "job_id": job.id,
                "status": "submitted",
            },
            status=status.HTTP_201_CREATED,
        )
