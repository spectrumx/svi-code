from datetime import datetime
from datetime import timedelta
from typing import TYPE_CHECKING

import requests
from django.conf import settings
from django.http import FileResponse
from django.utils import timezone
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
    VisualizationSerializer,
)
from spectrumx_visualization_platform.spx_vis.capture_utils.sigmf import SigMFUtility
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import Visualization

if TYPE_CHECKING:
    from spectrumx_visualization_platform.users.models import User


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


def calculate_end_time(start_time, scan_time):
    start_time = datetime_check(start_time)
    if start_time and isinstance(scan_time, (int, float)):
        end_time = start_time + timedelta(seconds=scan_time)
        return end_time.strftime("%Y-%m-%d %H:%M:%S.%f")  # Convert to string for JSON
    return None


def datetime_check(value):
    if not value:
        return None
    try:
        dt = datetime.strptime(value + "Z", "%Y-%m-%dT%H:%M%z")
        return dt.astimezone(timezone.utc)
    except ValueError:
        try:
            dt = datetime.strptime(value + "Z", "%Y-%m-%d %H:%M:%S.%f%z")
            return dt.astimezone(timezone.utc)
        except ValueError:
            return None


def float_check(value, default=0.0):
    """Safely convert a value to float."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


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


def get_sds_captures(request: Request):
    """Get SDS captures for the current user."""
    user: User = request.user

    try:
        token = user.fetch_sds_token()
        captures_response = requests.get(
            f"https://{settings.SDS_CLIENT_URL}/api/latest/assets/captures/",
            headers={"Authorization": f"Api-Key: {token}"},
            timeout=10,
        )
        captures = captures_response.json()
        formatted_captures = []

        for capture in captures:
            if capture["files"]:
                formatted_capture = format_sds_capture(capture, request.user.id)
                formatted_captures.append(formatted_capture)

    except Exception as e:
        print(f"Error fetching SDS captures: {e}")
        return []

    return formatted_captures


def format_sds_capture(sds_capture: dict, user_id: int):
    """Format a single SDS capture.

    Args:
        sds_capture: Raw SDS capture data
        user_id: ID of the current user

    Returns:
        dict: Formatted capture data
    """
    capture_props = sds_capture["capture_props"]
    metadata = capture_props["metadata"]
    custom_fields = capture_props["custom_fields"]

    timestamp = capture_props["timestamp"]
    scan_time = metadata["scan_time"]

    files = [
        {
            "id": file["uuid"],
            "name": file["name"],
        }
        for file in sds_capture["files"]
    ]

    return {
        "id": sds_capture["uuid"],
        "owner": user_id,
        "name": sds_capture["scan_group"],
        "files": files,
        "created_at": sds_capture["created_at"],
        "timestamp": timestamp,
        "type": sds_capture["capture_type"],
        "source": "sds",
        "min_freq": custom_fields["requested"]["fmin"],
        "max_freq": custom_fields["requested"]["fmax"],
        "scan_time": scan_time,
        "end_time": calculate_end_time(timestamp, scan_time),
    }


def get_local_captures(request) -> list:
    """Get local captures for the current user.

    Args:
        request: The HTTP request object

    Returns:
        list: Formatted local captures
    """
    captures = Capture.objects.filter(owner=request.user)
    captures_data = CaptureSerializer(captures, many=True).data
    return [format_local_capture(capture) for capture in captures_data]


def format_local_capture(capture: dict) -> dict:
    """Format a single local capture and return as dict.

    Args:
        capture: Raw capture data

    Returns:
        dict: Formatted capture data
    """
    timestamp = capture.get("timestamp", "")
    scan_time = capture.get("scan_time")

    return {
        "id": capture["id"],
        "name": capture["name"],
        "media_type": capture.get("metadata", {}).get("data_type", "unknown"),
        "timestamp": timestamp,
        "created_at": timestamp,
        "source": "svi_user",
        "files": capture["files"],
        "owner": capture["owner"],
        "type": capture["type"],
        "min_freq": capture.get("metadata", {}).get("fmin", ""),
        "max_freq": capture.get("metadata", {}).get("fmax", ""),
        "scan_time": scan_time,
        "end_time": calculate_end_time(timestamp, scan_time),
    }


def filter_capture(capture: dict, filters: dict) -> bool:
    """Filter a single capture based on given criteria.

    Args:
        capture: The capture to check
        filters: Dictionary containing filter parameters:
                - min_freq: Minimum frequency filter
                - max_freq: Maximum frequency filter
                - start_time: Start time filter
                - end_time: End time filter
                - source_filter: Source type filter

    Returns:
        bool: True if capture matches all filters
    """
    capture_min_freq = float_check(capture.get("min_freq"))
    capture_max_freq = float_check(capture.get("max_freq"))
    capture_start_time = datetime_check(capture.get("timestamp"))
    capture_end_time = datetime_check(capture.get("end_time"))

    if filters.get("min_freq") and capture_max_freq < filters["min_freq"]:
        return False
    if filters.get("max_freq") and capture_min_freq > filters["max_freq"]:
        return False
    if filters.get("start_time") and (
        capture_end_time is None or capture_end_time < filters["start_time"]
    ):
        return False
    if filters.get("end_time") and (
        capture_start_time is None or capture_start_time > filters["end_time"]
    ):
        return False

    # Handle multiple sources from comma-separated string
    if filters.get("source_filter"):
        sources = filters["source_filter"].split(",")
        return capture.get("source") in sources

    return True


class VisualizationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Visualization objects.

    Provides CRUD operations for Visualization objects with filtering and search capabilities.
    Users can only access their own visualizations.
    """

    queryset = Visualization.objects.all()
    serializer_class = VisualizationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["type", "capture_type", "capture_source"]
    ordering_fields = ["created_at", "updated_at", "type"]
    ordering = ["-created_at"]

    def get_queryset(self):
        """Get the queryset of visualizations for the current user.

        Returns:
            QuerySet: Filtered queryset containing only the user's visualizations.
        """
        return Visualization.objects.filter(owner=self.request.user)

    def perform_create(self, serializer: VisualizationSerializer) -> None:
        """Create a new visualization object.

        Args:
            serializer: The VisualizationSerializer instance with validated data.
        """
        serializer.save(owner=self.request.user)
