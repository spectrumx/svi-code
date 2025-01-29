from django.http import FileResponse
from rest_framework import filters
from rest_framework import permissions
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from jobs.submission import request_job_submission
from spectrumx_visualization_platform.spx_vis.api.serializers import CaptureSerializer
from spectrumx_visualization_platform.spx_vis.api.serializers import FileSerializer
from spectrumx_visualization_platform.spx_vis.api.serializers import (
    SigMFFilePairSerializer,
)
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import SigMFFilePair


class CaptureViewSet(viewsets.ModelViewSet):
    queryset = Capture.objects.all()
    serializer_class = CaptureSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        serializer = self.get_serializer(queryset, many=True)

        print("Capture list:")
        for item in serializer.data:
            print(item)

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
        width = request.data.get("width", 10)  # width passed from front end 44
        height = request.data.get("height", 10)  # height passed from front end 44
        print("views width and height:", {width}, {height})  # debug line added 44
        dimensions = {"width": width, "height": height}  # debug line added  44
        print("views dimensions", dimensions)  # debug line added
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


class FileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing File objects.

    Provides CRUD operations for File objects with filtering and search capabilities.
    """

    queryset = File.objects.all()
    serializer_class = FileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "media_type"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["-created_at"]

    def get_queryset(self):
        """Get the queryset of files for the current user.

        Returns:
            QuerySet: Filtered queryset containing only the user's files.
        """
        return File.objects.filter(owner=self.request.user)

    @action(detail=True, methods=["get"])
    def content(self, request, pk=None):
        """Get the file content.

        Args:
            request: The HTTP request
            pk: The primary key of the file

        Returns:
            FileResponse: The file content with appropriate content type
        """
        file_obj = self.get_object()
        response = FileResponse(file_obj.file)
        response["Content-Type"] = file_obj.media_type
        response["Content-Disposition"] = f'attachment; filename="{file_obj.name}"'
        return response

    def perform_create(self, serializer: FileSerializer) -> None:
        """Create a new file object.

        Args:
            serializer: The FileSerializer instance with validated data.
        """
        serializer.save(owner=self.request.user)
