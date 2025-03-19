import io
import logging
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict
from typing import List

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
from spectrumx_visualization_platform.users.models import User
from spectrumx.models.captures import Capture as SDSCapture


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

    @action(detail=True, methods=["get"])
    def download_files(self, request: Request, pk=None) -> Response:
        """Download all files associated with the visualization as a ZIP file.

        This endpoint retrieves all files from both local and SDS sources associated
        with the visualization's captures and packages them into a ZIP file.

        For SDS captures, it downloads entire directories using the SDS client.
        For local captures, it reads files directly from the database.

        Args:
            request: The HTTP request
            pk: The primary key of the visualization

        Returns:
            FileResponse: A ZIP file containing all associated files

        Raises:
            Response: 400 if there's an error fetching files, duplicate filenames found,
                     or if any files are missing from the captures
        """
        visualization = self.get_object()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"visualization_{visualization.id}_{timestamp}.zip"

        # Track filenames to detect duplicates and file IDs to verify completeness
        seen_filenames: set[str] = set()
        expected_file_ids: dict[
            str, set[str]
        ] = {}  # capture_id -> set of expected file IDs
        file_id_to_name: dict[str, str] = {}  # file_id -> filename mapping

        # Create a BytesIO object to store the ZIP file
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            if visualization.capture_source == "sds":
                try:
                    # Get SDS client
                    user: User = request.user
                    sds = user.sds_client()

                    # Create a temporary directory for downloads
                    temp_dir = Path("/tmp") / f"sds_downloads_{timestamp}"
                    temp_dir.mkdir(parents=True, exist_ok=True)

                    # Group captures by their SDS directory
                    sds_directories: dict[str, list[str]] = {}
                    sds_captures = get_sds_captures(request)

                    for capture_id in visualization.capture_ids:
                        try:
                            # Get capture details from SDS to find its directory
                            capture = next(
                                (c for c in sds_captures if c["uuid"] == capture_id),
                                None,
                            )

                            if capture is None:
                                logging.error(
                                    f"Failed to get SDS capture {capture_id}: capture not found"
                                )
                                continue

                            sds_dir = capture["top_level_dir"]
                            if sds_dir not in sds_directories:
                                sds_directories[sds_dir] = []
                            sds_directories[sds_dir].append(capture_id)

                            # Record expected file IDs for this capture
                            expected_file_ids[capture_id] = set(
                                capture.get("files", [])
                            )
                        except Exception as e:
                            logging.error(
                                f"Failed to get SDS capture {capture_id}: {e}"
                            )
                            continue

                    # Download each directory and add files to ZIP
                    for sds_dir, capture_ids in sds_directories.items():
                        try:
                            # Create a subdirectory for this SDS directory
                            local_dir = temp_dir / sds_dir
                            local_dir.mkdir(parents=True, exist_ok=True)

                            # Download the directory from SDS
                            sds.download(
                                from_sds_path=sds_dir,
                                to_local_path=local_dir,
                                overwrite=False,
                                verbose=True,
                            )

                            # Add all files from this directory to the ZIP
                            for file_path in local_dir.rglob("*"):
                                if file_path.is_file():
                                    filename = file_path.name
                                    if filename in seen_filenames:
                                        return Response(
                                            {
                                                "error": f"Duplicate filename found: {filename}"
                                            },
                                            status=status.HTTP_400_BAD_REQUEST,
                                        )
                                    seen_filenames.add(filename)
                                    zip_file.write(file_path, filename)

                                    # Record the file ID to name mapping
                                    # TODO: This logic is wrong. The stem is not the file ID.
                                    file_id = (
                                        file_path.stem
                                    )  # Assuming file ID is the stem
                                    file_id_to_name[file_id] = filename

                        except Exception as e:
                            logging.error(
                                f"Failed to download SDS directory {sds_dir}: {e}"
                            )
                            continue

                    # Clean up temporary directory
                    import shutil

                    shutil.rmtree(temp_dir)

                except Exception as e:
                    return Response(
                        {"error": f"Failed to fetch SDS files: {str(e)}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                # Get local files
                for capture_id in visualization.capture_ids:
                    try:
                        capture = Capture.objects.get(id=capture_id, owner=request.user)
                        # Record expected file IDs for this capture
                        expected_file_ids[capture_id] = {
                            str(f.id) for f in capture.files.all()
                        }

                        for file_obj in capture.files.all():
                            # Check for duplicate filename
                            if file_obj.name in seen_filenames:
                                return Response(
                                    {
                                        "error": f"Duplicate filename found: {file_obj.name}"
                                    },
                                    status=status.HTTP_400_BAD_REQUEST,
                                )
                            seen_filenames.add(file_obj.name)

                            # Record the file ID to name mapping
                            file_id_to_name[str(file_obj.id)] = file_obj.name

                            # Read file content and add to ZIP using original filename
                            with file_obj.file.open("rb") as f:
                                zip_file.writestr(file_obj.name, f.read())
                    except (Capture.DoesNotExist, Exception) as e:
                        return Response(
                            {"error": f"Failed to fetch local files: {str(e)}"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

            # Verify we have all expected files by ID
            missing_files: dict[str, set[str]] = {}
            for capture_id, expected_ids in expected_file_ids.items():
                missing_ids = expected_ids - set(file_id_to_name.keys())
                if missing_ids:
                    missing_files[capture_id] = missing_ids

            if missing_files:
                error_msg = "Missing files from captures:\n"
                for capture_id, file_ids in missing_files.items():
                    error_msg += f"Capture {capture_id}: {', '.join(file_ids)}\n"
                return Response(
                    {"error": error_msg},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Reset buffer position to start
        zip_buffer.seek(0)

        # Return the ZIP file
        response = FileResponse(zip_buffer, content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{zip_filename}"'
        return response
