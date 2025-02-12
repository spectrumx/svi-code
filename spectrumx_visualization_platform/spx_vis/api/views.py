from django.http import FileResponse
from rest_framework import filters
from rest_framework import permissions
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from spectrumx_visualization_platform.spx_vis.api.serializers import CaptureSerializer
from spectrumx_visualization_platform.spx_vis.api.serializers import FileSerializer
from spectrumx_visualization_platform.spx_vis.capture_utils.sigmf import SigMFUtility
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import File


class CaptureViewSet(viewsets.ModelViewSet):
    queryset = Capture.objects.all()
    serializer_class = CaptureSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        """Get the queryset of captures for the current user.

        Returns:
            QuerySet: Filtered queryset containing only the user's captures.
        """
        return Capture.objects.filter(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def create_spectrogram(self, request, pk=None):
        """
        Create a spectrogram visualization job for a SigMF capture.

        Args:
            request: HTTP request containing width, height parameters
            pk: Primary key of the Capture

        Returns:
            Response with job_id and status if successful

        Raises:
            400: If capture is not SigMF type or required files are missing
        """
        capture: Capture = self.get_object()

        if capture.type != "sigmf":
            return Response(
                {
                    "status": "error",
                    "message": "Spectrogram generation is currently only supported for\
                        SigMF captures",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        width = request.data.get("width", 10)
        height = request.data.get("height", 10)

        try:
            job = SigMFUtility.submit_spectrogram_job(
                request.user, capture.files, width, height
            )

            return Response(
                {
                    "job_id": job.id,
                    "status": "submitted",
                },
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response(
                {
                    "status": "error",
                    "message": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
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
