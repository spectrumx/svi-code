from django.http import FileResponse
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from spectrumx.errors import FileError
from spectrumx.models.captures import CaptureType
from spectrumx_visualization_platform.spx_vis.api.serializers import CaptureSerializer, FileSerializer
from spectrumx_visualization_platform.spx_vis.capture_utils.sigmf import SigMFUtility
from spectrumx_visualization_platform.spx_vis.models import Capture, File

from datetime import datetime, timedelta

@api_view(["GET"])
def capture_list(request: Request) -> Response:
    """Get the list of captures for the current user."""
    file_list = []
    sds_file_list = []
    sds_file_count = 0

    print("i was here")

    sds_client = request.user.sds_client()
    if sds_client:
        print("Successfully connected to SDS client")
    else:
        print("Connection error")

    # Get the list of files from the SDS client
    try:
        sds_captures = sds_client.captures.listing(capture_type=CaptureType.RadioHound)
        sds_file_count = len(sds_captures)
        print(f"Number of captures from SDS client: {sds_file_count}")
    except FileError:
        sds_captures = []
        print("No captures found in SDS Client.")

    # Process SDS captures
    for sds_capture in sds_captures:
        timestamp = sds_capture.get("timestamp", "")
        scan_time = sds_capture.get("metadata", {}).get("scan_time", 0.08121538162231445)  # Default value for test
        end_time = calculate_end_time(timestamp, scan_time)  # Compute end time

        print(f"SDS Capture Debug: timestamp={timestamp}, scan_time={scan_time}, computed end_time={end_time}")

        sds_file_list.append({
            "id": sds_capture.get("_id", sds_capture.get("id", "unknown")),
            "name": sds_capture["name"],
            "media_type": sds_capture.get("metadata", {}).get("data_type", "unknown"),
            "timestamp": timestamp,
            "created_at": capture.get("timestamp", ""),
            "source": "SDS",
            "files": sds_capture["files"],
            "owner": request.user.id,
            "type": sds_capture.get("metadata", {}).get("data_type", "rh"),
            "min_freq": sds_capture.get("metadata", {}).get("fmin", ""),
            "max_freq": sds_capture.get("metadata", {}).get("fmax", ""),
            "scan_time": scan_time,
            "end_time": end_time,
        })

    # Process local captures
    captures = Capture.objects.filter(owner=request.user)
    captures_data = CaptureSerializer(captures, many=True).data
    print(f"Captures count: {len(captures)}")

    for capture in captures_data:
        timestamp = capture.get("timestamp", "")
        scan_time = capture.get("scan_time", 0.08121538162231445)  # Default value
        end_time = calculate_end_time(timestamp, scan_time)

        print(f"Local Capture Debug: timestamp={timestamp}, scan_time={scan_time}, computed end_time={end_time}")

        capture_dict = {
            "id": capture.get("_id", capture.get("id", "unknown")),
            "name": capture["name"],
            "media_type": capture.get("metadata", {}).get("data_type", "unknown"),
            "timestamp": timestamp,
            "created_at": timestamp,
            "source": "svi_user",
            "files": capture["files"],
            "owner": request.user.id,
            "type": capture.get("metadata", {}).get("data_type", "rh"),
            "min_freq": capture.get("metadata", {}).get("fmin", ""),
            "max_freq": capture.get("metadata", {}).get("fmax", ""),
            "scan_time": scan_time,
            "end_time": end_time,
        }
        file_list.append(capture_dict)

    # Combine lists
    combined_file_list = sds_file_list + file_list

    # filtering parameters
    min_frequency = request.query_params.get("min_frequency")
    max_frequency = request.query_params.get("max_frequency")
    start_time = datetime_check(request.query_params.get("start_time"))
    end_time = datetime_check(request.query_params.get("end_time"))
    source_filter = request.query_params.get("source")

    print(f"source val:", source_filter)

    print(f"min_freq={min_frequency}, max_freq={max_frequency}, start_time={start_time}, end_time={end_time}")

    if min_frequency or max_frequency or start_time or end_time or source_filter:
        min_freq = float(min_frequency) if min_frequency else None
        max_freq = float(max_frequency) if max_frequency else None

        def filter_capture(capture):
            capture_min_freq = float_check(capture.get("min_freq"))
            capture_max_freq = float_check(capture.get("max_freq"))
            capture_start_time = datetime_check(capture.get("timestamp"))
            capture_end_time = datetime_check(capture.get("end_time"))

            if min_freq is not None and capture_max_freq < min_freq:
                return False
            if max_freq is not None and capture_min_freq > max_freq:
                return False
            if start_time and (capture_end_time is None or capture_end_time < start_time):
                return False
            if end_time and (capture_start_time is None or capture_start_time > end_time):
                return False

            if source_filter and capture.get("source") != source_filter:
                return False

            return True

        combined_file_list = list(filter(filter_capture, combined_file_list))

    return Response({"captures": combined_file_list, "sds_count": sds_file_count})


def calculate_end_time(start_time, scan_time):
    print(f"scan time in end time func",scan_time)
    start_time = datetime_check(start_time)
    print(f"start_time in func calculate end time", start_time)
    print(f"delta",timedelta(seconds=scan_time) )
    if start_time and isinstance(scan_time, (int, float)):
        print(f"delta",timedelta(seconds=scan_time) )
        end_time = start_time + timedelta(seconds=scan_time)
        print(f"Computed end_time: {end_time}")
        return end_time.strftime("%Y-%m-%d %H:%M:%S.%f")  # Convert to string for JSON
    print("Invalid timestamp or scan_time, returning None")
    return None


def datetime_check(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M")
    except ValueError:
        try:
            return datetime.strptime(value, "%Y-%m-%d %H:%M:%S.%f")
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
    print("i am here")

    def get_queryset(self):
        return Capture.objects.filter(owner=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        if isinstance(result, list):
            serializer = self.get_serializer(result, many=True)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"])
    def create_spectrogram(self, request, pk=None):
        capture: Capture = self.get_object()

        if capture.type != "sigmf":
            return Response({"status": "error", "message": "Spectrogram generation is only supported for SigMF captures"},
                            status=status.HTTP_400_BAD_REQUEST)

        width = request.data.get("width", 10)
        height = request.data.get("height", 10)

        try:
            job = SigMFUtility.submit_spectrogram_job(request.user, capture.files, width, height)
            return Response({"job_id": job.id, "status": "submitted"}, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class FileViewSet(viewsets.ModelViewSet):
    queryset = File.objects.all()
    serializer_class = FileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "media_type"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return File.objects.filter(owner=self.request.user)
