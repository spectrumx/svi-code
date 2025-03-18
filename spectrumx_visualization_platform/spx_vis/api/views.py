import logging

import requests
from django.conf import settings
from django.http import FileResponse
from rest_framework import filters
from rest_framework import permissions
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.decorators import api_view
from rest_framework.parsers import FormParser
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response

from spectrumx_visualization_platform.spx_vis.api.serializers import CaptureSerializer
from spectrumx_visualization_platform.spx_vis.api.serializers import FileSerializer
from spectrumx_visualization_platform.spx_vis.api.serializers import (
    VisualizationDetailSerializer,
)
from spectrumx_visualization_platform.spx_vis.api.serializers import (
    VisualizationListSerializer,
)
from spectrumx_visualization_platform.spx_vis.api.utils import datetime_check
from spectrumx_visualization_platform.spx_vis.api.utils import filter_capture
from spectrumx_visualization_platform.spx_vis.capture_utils.sigmf import SigMFUtility
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import Visualization
from spectrumx_visualization_platform.spx_vis.source_utils.local import (
    get_local_captures,
)
from spectrumx_visualization_platform.spx_vis.source_utils.sds import get_sds_captures


@api_view(["GET"])
def capture_list(request: Request) -> Response:
    """Get the list of captures for the current user."""
    # Get captures from the two sources
    sds_captures = get_sds_captures(request)
    local_captures = get_local_captures(request)

    # Combine captures
    combined_capture_list = sds_captures + local_captures

    # Get filter parameters
    min_frequency = request.query_params.get("min_frequency")
    max_frequency = request.query_params.get("max_frequency")
    start_time = datetime_check(request.query_params.get("start_time"))
    end_time = datetime_check(request.query_params.get("end_time"))
    source_filter = request.query_params.get("source")

    if min_frequency or max_frequency or start_time or end_time or source_filter:
        min_freq = float(min_frequency) if min_frequency else None
        max_freq = float(max_frequency) if max_frequency else None

        combined_capture_list = list(
            filter(
                lambda capture: filter_capture(
                    capture,
                    {
                        "min_freq": min_freq,
                        "max_freq": max_freq,
                        "start_time": start_time,
                        "end_time": end_time,
                        "source_filter": source_filter,
                    },
                ),
                combined_capture_list,
            )
        )

    return Response(combined_capture_list)


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

    def create(self, request, *args, **kwargs):
        """Create a new capture or captures.

        For RadioHound captures, creates multiple captures (one per file).
        For other types, creates a single capture with multiple files.

        Returns:
            Response: Created capture(s) data with appropriate status code
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        # Handle RadioHound multi-capture case
        if isinstance(result, list):
            # Serialize the list of captures
            serializer = self.get_serializer(result, many=True)
            headers = self.get_success_headers(serializer.data)
            return Response(
                serializer.data, status=status.HTTP_201_CREATED, headers=headers
            )

        # Handle single capture case (other types)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

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
                    "message": "Spectrogram generation is only supported for SigMF captures",
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
                {"job_id": job.id, "status": "submitted"},
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response(
                {"status": "error", "message": str(e)},
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

        Raises:
            Response: 400 if source is invalid or file not found
        """
        source = request.query_params.get("source", "svi")

        if source == "sds":
            try:
                logging.info("Fetching user token")
                token = request.user.fetch_sds_token()
                logging.info(f"Fetching SDS file {pk}")
                response = requests.get(
                    f"https://{settings.SDS_CLIENT_URL}/api/latest/assets/files/{pk}/download",
                    headers={"Authorization": f"Api-Key: {token}"},
                    timeout=10,
                )
                logging.info(f"Returning SDS file {pk}")
                return FileResponse(response)
            except Exception as e:
                return Response(
                    {"error": f"Failed to fetch SDS file: {e}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif source.startswith("svi"):
            file_obj = self.get_object()
            response = FileResponse(file_obj.file)
            response["Content-Type"] = file_obj.media_type
            response["Content-Disposition"] = f'attachment; filename="{file_obj.name}"'
            return response
        else:
            return Response(
                {"error": "Invalid source parameter. Must be 'svi*' or 'sds'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def perform_create(self, serializer: FileSerializer) -> None:
        """Create a new file object.

        Args:
            serializer: The FileSerializer instance with validated data.
        """
        serializer.save(owner=self.request.user)


class VisualizationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Visualization objects.

    Provides CRUD operations for Visualization objects with filtering and search capabilities.
    Users can only access their own visualizations.
    """

    queryset = Visualization.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["type", "capture_type", "capture_source"]
    ordering_fields = ["created_at", "updated_at", "type"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        """Get the appropriate serializer class based on the action.

        Returns:
            Serializer class to use for the current action.
        """
        if self.action == "list":
            return VisualizationListSerializer
        return VisualizationDetailSerializer

    def get_queryset(self):
        """Get the queryset of visualizations for the current user.

        Returns:
            QuerySet: Filtered queryset containing only the user's visualizations.
        """
        return Visualization.objects.filter(owner=self.request.user)

    def perform_create(self, serializer: VisualizationDetailSerializer) -> None:
        """Create a new visualization object.

        Args:
            serializer: The VisualizationDetailSerializer instance with validated data.
        """
        serializer.save(owner=self.request.user)
