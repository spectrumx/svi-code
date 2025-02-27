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
from spectrumx.errors import FileError
from spectrumx.models.captures import CaptureType

from spectrumx_visualization_platform.spx_vis.api.serializers import CaptureSerializer
from spectrumx_visualization_platform.spx_vis.api.serializers import FileSerializer
from spectrumx_visualization_platform.spx_vis.capture_utils.sigmf import SigMFUtility
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import File


@api_view(["GET"])
def capture_list(request: Request) -> Response:
    """Get the list of captures for the current user.

    Args:
        request: The HTTP request object

    Returns:
        Response: JSON response containing serialized captures data
    """
    file_list = []

    # also get the sds client for this user
    sds_client = request.user.sds_client()

    # get the list of files from the sds client
    try:
        captures = sds_client.captures.listing(
            capture_type=CaptureType.RadioHound,
        )
    except FileError:
        file_list = []

    # for sds_file in files:
    #     file_list.append({
    #         'id': sds_file.uuid,
    #         'name': sds_file.name,
    #         'media_type': sds_file.media_type,
    #         'timestamp': sds_file.created_at,
    #         'created_at': sds_file.created_at,
    #         'source': 'sds',
    #         'files': [],
    #         'owner': request.user.id,
    #         'type': 'rh',
    #     })

    captures = Capture.objects.filter(owner=request.user)
    captures_data = CaptureSerializer(captures, many=True).data

    for capture in captures_data:
        capture_dict = {
            "id": str(capture["id"]),
            "name": capture["name"],
            "media_type": capture["files"][0]["media_type"],
            "timestamp": capture["files"][0]["created_at"],
            "created_at": capture["files"][0]["created_at"],
            "source": "svi_user",
            "files": capture["files"],
            "owner": request.user.id,
            "type": capture["type"],
        }
        for capture_file in capture_dict["files"]:
            capture_file["id"] = str(capture_file["id"])
            capture_file["timestamp"] = capture_file["created_at"]
            capture_file["source"] = "svi_user"
            capture_file["owner"] = request.user.id
        file_list.append(capture_dict)

    return Response(file_list)


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
