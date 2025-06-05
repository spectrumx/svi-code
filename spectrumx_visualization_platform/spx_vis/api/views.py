import io
import json
import logging
import os
import shutil
import zipfile
from datetime import UTC
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

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
from spectrumx_visualization_platform.spx_vis.capture_utils.digital_rf import (
    DigitalRFUtility,
)
from spectrumx_visualization_platform.spx_vis.capture_utils.radiohound import (
    RadioHoundUtility,
)
from spectrumx_visualization_platform.spx_vis.capture_utils.sigmf import SigMFUtility
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import CaptureType
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import Visualization
from spectrumx_visualization_platform.spx_vis.models import VisualizationType
from spectrumx_visualization_platform.spx_vis.source_utils.sds import get_sds_captures

if TYPE_CHECKING:
    from spectrumx_visualization_platform.users.models import User


@api_view(["GET"])
def capture_list(request: Request) -> Response:
    """Get the list of captures for the current user."""
    # Get captures from the two sources
    source_filter = request.query_params.get("source", "")
    if not source_filter or "sds" in source_filter:
        sds_captures = get_sds_captures(request)
    else:
        sds_captures = []
    # if not source_filter or "svi" in source_filter:
    #     local_captures = get_local_captures(request)
    # else:
    #     local_captures = []

    # Combine captures
    # combined_capture_list = sds_captures + local_captures
    combined_capture_list = sds_captures

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
    lookup_field = "uuid"
    lookup_url_kwarg = "uuid"

    def get_queryset(self):
        """Get the queryset of captures for the current user.

        Returns:
            QuerySet: Filtered queryset containing only the user's captures.
        """
        return Capture.objects.filter(owner=self.request.user, source="sds")

    def create(self, request, *args, **kwargs):
        """Create a new capture.

        Returns:
            Response: Created capture data with appropriate status code
        """
        return Response(
            {
                "status": "error",
                "message": "SVI-hosted captures are currently not supported",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
        # serializer = self.get_serializer(data=request.data)
        # serializer.is_valid(raise_exception=True)
        # serializer.save()

        # headers = self.get_success_headers(serializer.data)
        # return Response(
        #     serializer.data, status=status.HTTP_201_CREATED, headers=headers
        # )


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
    lookup_field = "uuid"
    lookup_url_kwarg = "uuid"

    def get_queryset(self):
        """Get the queryset of files for the current user.

        Returns:
            QuerySet: Filtered queryset containing only the user's files.
        """
        return File.objects.filter(owner=self.request.user)

    @action(detail=True, methods=["get"])
    def content(self, request, uuid=None):
        """Get the file content.

        Args:
            request: The HTTP request
            uuid: The UUID of the file

        Returns:
            FileResponse: The file content with appropriate content type

        Raises:
            Response: 400 if source is invalid or file not found
        """
        source = request.query_params.get("source", "svi")

        if source == "sds":
            try:
                token = request.user.sds_token
                logging.info(f"Fetching SDS file {uuid}")
                response = requests.get(
                    f"https://{settings.SDS_CLIENT_URL}/api/latest/assets/files/{uuid}/download",
                    headers={"Authorization": f"Api-Key: {token}"},
                    timeout=10,
                )
                logging.info(f"Returning SDS file {uuid}")
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
    lookup_field = "uuid"
    lookup_url_kwarg = "uuid"

    def get_serializer_class(self):
        """Get the appropriate serializer class based on the action and query parameters.

        Returns:
            Serializer class to use for the current action.
        """
        if (
            self.action == "list"
            and self.request.query_params.get("detailed", "").lower() != "true"
        ):
            return VisualizationListSerializer
        return VisualizationDetailSerializer

    def get_queryset(self):
        """Get the queryset of visualizations for the current user.

        When listing visualizations, only returns saved visualizations.
        When retrieving a single visualization, returns it regardless of saved status.

        Returns:
            QuerySet: Filtered queryset containing only the user's visualizations.
        """
        if self.action == "list":
            # Delete expired unsaved visualizations
            Visualization.objects.filter(
                owner=self.request.user,
                is_saved=False,
                expiration_date__lte=datetime.now(UTC),
            ).delete()

        # SDS captures are our current priority
        queryset = Visualization.objects.filter(
            owner=self.request.user, capture_source="sds"
        )

        # For list action, only return saved visualizations
        if self.action == "list":
            queryset = queryset.filter(is_saved=True)

        return queryset

    def perform_create(self, serializer: VisualizationDetailSerializer) -> None:
        """Create a new visualization object.

        Args:
            serializer: The VisualizationDetailSerializer instance with validated data.
        """
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def create_spectrogram(self, request: Request, uuid=None) -> Response:
        """Create a spectrogram visualization job.

        Args:
            request: HTTP request containing width, height parameters
            uuid: UUID of the Visualization

        Returns:
            Response with job_id and status if successful

        Raises:
            400: If visualization is not of a supported type or required files are missing
        """
        visualization: Visualization = self.get_object()
        user: User = request.user

        if visualization.type != VisualizationType.Spectrogram:
            return Response(
                {
                    "status": "error",
                    "message": "Spectrogram generation is only supported for spectrogram visualizations",
                },
            )

        if visualization.capture_type == CaptureType.SigMF:
            capture_utility = SigMFUtility
        elif visualization.capture_type == CaptureType.DigitalRF:
            capture_utility = DigitalRFUtility
        else:
            return Response(
                {"status": "error", "message": "Unsupported capture type"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        width = request.data.get("width", 10)
        height = request.data.get("height", 10)
        config = request.data.get("config", {})

        try:
            # Get SDS captures
            sds_client = user.sds_client()
            sds_captures = sds_client.captures.listing(
                capture_type=visualization.capture_type
            )
            capture = next(
                (
                    c
                    for c in sds_captures
                    if str(c.uuid) == visualization.capture_ids[0]
                ),
                None,
            )
            if not capture:
                return Response(
                    {
                        "status": "error",
                        "message": f"Capture ID {visualization.capture_ids[0]} of type {visualization.capture_type} not found in SDS",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            file_uuids = [file.uuid for file in capture.files]

            # Download to media root
            user_path = Path(
                settings.MEDIA_ROOT,
                "sds",
                str(user.uuid),
            )
            local_path = Path(
                user_path,
                str(datetime.now(UTC).timestamp()),
            )
            file_results = sds_client.download(
                from_sds_path=capture.top_level_dir,
                to_local_path=local_path,
                skip_contents=False,
                overwrite=True,
                verbose=True,
            )
            downloaded_files = [result() for result in file_results if result]
            download_errors = [
                result.error_info for result in file_results if not result
            ]

            if download_errors:
                return Response(
                    {
                        "status": "error",
                        "message": f"Failed to download SDS files: {download_errors}",
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            matching_files = []
            for f in downloaded_files:
                if f.uuid in file_uuids:
                    matching_files.append(f)
                else:
                    f.local_path.unlink()

            file_paths = [str(f.local_path) for f in matching_files]
            logging.info(
                f"Files matching capture (expected): {len(file_paths)} ({len(file_uuids)})"
            )
            logging.info(
                f"Files removed: {len(downloaded_files) - len(matching_files)}"
            )
            common_path = os.path.commonpath(file_paths)

            # Move commonpath directory to local_path and delete the remaining empty directories
            shutil.move(common_path, local_path)
            sds_root = str(capture.files[0].directory).strip("/").split("/")[0]
            sds_root_path = local_path / sds_root
            shutil.rmtree(sds_root_path)
            new_file_paths = [
                str(path) for path in Path(local_path).glob("**/*") if path.is_file()
            ]

            try:
                # Pass the downloaded file paths to the utility
                job = capture_utility.submit_spectrogram_job(
                    user, new_file_paths, width, height, config
                )
                return Response(
                    {"job_id": job.id, "status": "submitted"},
                    status=status.HTTP_201_CREATED,
                )
            finally:
                # Clean up the temporary files
                shutil.rmtree(user_path)
        except Exception as e:
            return Response(
                {"status": "error", "message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _process_sds_file(
        self,
        file: dict,
        capture_id: str,
        token: str,
        seen_filenames: set[str],
        zip_file: zipfile.ZipFile,
    ) -> None:
        """Process a single SDS file and add it to the ZIP archive.

        Args:
            file: Dictionary containing file information from SDS
            capture_id: ID of the capture this file belongs to
            token: SDS API token
            seen_filenames: Set of filenames already processed (to check duplicates)
            zip_file: ZIP archive to add the file to

        Raises:
            ValueError: If duplicate filename is found or file download fails
        """
        file_uuid = file["uuid"]
        logging.info(f"Downloading file with ID {file_uuid}")

        response = requests.get(
            f"https://{settings.SDS_CLIENT_URL}/api/latest/assets/files/{file_uuid}/download",
            headers={"Authorization": f"Api-Key: {token}"},
            timeout=10,
            stream=True,
        )
        response.raise_for_status()
        logging.info(f"File with ID {file_uuid} downloaded")

        # Get filename from Content-Disposition header or use file ID
        content_disposition = response.headers.get("Content-Disposition", "")
        filename = next(
            (
                part.split("=")[1].strip('"')
                for part in content_disposition.split(";")
                if part.strip().startswith("filename=")
            ),
            file["name"],
        )

        # Check for duplicate filename
        if filename in seen_filenames:
            raise ValueError(
                f"Duplicate filename found for capture with ID {capture_id}. "
                f"File name: {filename}"
            )
        seen_filenames.add(filename)

        # Add file content directly to ZIP in capture-specific directory
        zip_path = f"{capture_id}/{filename}"
        zip_file.writestr(zip_path, response.content)

    def _handle_sds_captures(
        self,
        visualization: Visualization,
        request: Request,
        zip_file: zipfile.ZipFile,
    ) -> None:
        """Handle downloading and processing of all SDS captures.

        Args:
            visualization: Visualization model instance
            request: HTTP request object
            zip_file: ZIP archive to add files to

        Raises:
            ValueError: If any capture processing fails
        """
        logging.info("Getting SDS captures")
        sds_captures = get_sds_captures(request)
        logging.info(f"Found {len(sds_captures)} SDS captures")
        token = request.user.sds_token

        for capture_id in visualization.capture_ids:
            capture = next(
                (c for c in sds_captures if str(c["uuid"]) == str(capture_id)), None
            )

            if capture is None:
                raise ValueError(f"Capture ID {capture_id} not found in SDS")

            files = capture.get("files", [])
            if not files:
                raise ValueError(f"No files found for capture ID {capture_id}")

            seen_filenames: set[str] = set()

            for i, file in enumerate(files):
                logging.info(f"Downloading file {i + 1} of {len(files)}")
                try:
                    self._process_sds_file(
                        file, capture_id, token, seen_filenames, zip_file
                    )
                except requests.RequestException as e:
                    raise ValueError(
                        f"Failed to download file ID {file['uuid']} from capture ID {capture_id}: {e}"
                    )

    def _handle_local_captures(
        self,
        visualization: Visualization,
        request: Request,
        zip_file: zipfile.ZipFile,
    ) -> None:
        """Handle processing of all local captures.

        Args:
            visualization: Visualization model instance
            request: HTTP request object
            zip_file: ZIP archive to add files to

        Raises:
            ValueError: If any capture processing fails
        """
        for capture_id in visualization.capture_ids:
            try:
                # If capture_id can be parsed as an int, we need to get the capture by ID
                # because the viz capture_ids haven't been replaced with UUIDs yet
                try:
                    parsed_capture_id = int(capture_id)
                    capture = Capture.objects.get(
                        id=parsed_capture_id, owner=request.user
                    )
                except ValueError:
                    capture = Capture.objects.get(uuid=capture_id, owner=request.user)
                seen_filenames: set[str] = set()

                for file_obj in capture.files.all():
                    if file_obj.name in seen_filenames:
                        raise ValueError(
                            f"Duplicate filename found for capture ID {capture_id}. "
                            f"File name: {file_obj.name}"
                        )
                    seen_filenames.add(file_obj.name)

                    # Read file content and add to ZIP in capture-specific directory
                    zip_path = f"{capture_id}/{file_obj.name}"
                    with file_obj.file.open("rb") as f:
                        zip_file.writestr(zip_path, f.read())
            except Capture.DoesNotExist:
                error_message = f"Capture ID {capture_id} not found"
                logging.exception(error_message)
                raise ValueError(error_message)

    @action(detail=True, methods=["get"])
    def download_files(self, request: Request, uuid=None) -> Response:
        """Download all files associated with the visualization as a ZIP file.

        This endpoint retrieves all files from both local and SDS sources associated
        with the visualization's captures and packages them into a ZIP file.

        Files are organized in the ZIP by capture ID, with each capture's files
        in its own directory.

        Args:
            request: The HTTP request
            uuid: The UUID of the visualization

        Returns:
            FileResponse: A ZIP file containing all associated files

        Raises:
            Response: 400 if there's an error fetching files
        """
        visualization: Visualization = self.get_object()
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        zip_filename = f"vis_{visualization.uuid}_{timestamp}.zip"

        # Create a BytesIO object to store the ZIP file
        zip_buffer = io.BytesIO()

        try:
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                if visualization.capture_source == "sds":
                    self._handle_sds_captures(visualization, request, zip_file)
                else:
                    self._handle_local_captures(visualization, request, zip_file)

                logging.info("All files added to ZIP")

            # Reset buffer position to start
            zip_buffer.seek(0)

            # Return the ZIP file
            response = FileResponse(zip_buffer, content_type="application/zip")
            response["Content-Disposition"] = f'attachment; filename="{zip_filename}"'
            return response

        except Exception as e:
            logging.exception("Error downloading files")
            return Response(
                {"error": f"Failed to download files: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    def save(self, request: Request, uuid=None) -> Response:
        """Save an existing unsaved visualization.

        Args:
            request: The HTTP request
            uuid: The UUID of the visualization

        Returns:
            Response: The saved visualization
        """
        visualization: Visualization = self.get_object()
        visualization.is_saved = True
        visualization.expiration_date = None
        visualization.save()
        serializer = self.get_serializer(visualization)

        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def get_waterfall_data(self, request: Request, uuid=None) -> Response:
        """Get waterfall data for a visualization.

        This endpoint retrieves files from the visualization's SDS captures and converts them
        to the WaterfallFile format expected by the frontend. Currently supports RadioHound
        captures from SDS sources.

        Args:
            request: The HTTP request
            uuid: The UUID of the visualization

        Returns:
            Response: A list of WaterfallFile objects

        Raises:
            Response: 400 if the visualization type is not supported
            Response: 400 if there's an error processing the files
        """
        visualization: Visualization = self.get_object()

        # Currently only support RadioHound captures
        if visualization.capture_type != CaptureType.RadioHound:
            return Response(
                {
                    "status": "error",
                    "message": "Only RadioHound captures are currently supported for waterfall visualization",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only support SDS captures
        if visualization.capture_source != "sds":
            return Response(
                {
                    "status": "error",
                    "message": "Only SDS captures are currently supported",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            waterfall_files = []

            # Create a BytesIO object to store the ZIP file
            zip_buffer = io.BytesIO()

            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                self._handle_sds_captures(visualization, request, zip_file)

            # Reset buffer position to start
            zip_buffer.seek(0)

            # Process the ZIP file
            with zipfile.ZipFile(zip_buffer, "r") as zip_file:
                for capture_id in visualization.capture_ids:
                    capture_dir = f"{capture_id}/"
                    for file_info in zip_file.infolist():
                        if file_info.filename.startswith(
                            capture_dir
                        ) and file_info.filename.endswith(".json"):
                            with zip_file.open(file_info) as f:
                                try:
                                    rh_data = json.load(f)
                                    waterfall_file = (
                                        RadioHoundUtility.to_waterfall_file(rh_data)
                                    )
                                    waterfall_files.append(waterfall_file)
                                except json.JSONDecodeError as e:
                                    logging.error(
                                        f"Failed to parse JSON from file {file_info.filename}: {e}"
                                    )
                                    continue
                                except ValueError as e:
                                    logging.error(
                                        f"Failed to convert file {file_info.filename} to waterfall format: {e}"
                                    )
                                    continue

            return Response(waterfall_files)

        except Exception as e:
            logging.exception("Error processing waterfall data")
            return Response(
                {"error": f"Failed to process waterfall data: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
