from spectrumx_visualization_platform.spx_vis.api.serializers import CaptureSerializer
from spectrumx_visualization_platform.spx_vis.api.utils import calculate_end_time
from spectrumx_visualization_platform.spx_vis.capture_utils.radiohound import (
    RadioHoundUtility,
)
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import File


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
    # TODO: Fix this function, as the Capture model doesn't have some of these fields
    # it's trying to access
    timestamp = capture.get("timestamp")
    scan_time = capture.get("scan_time")

    if capture["type"] == "rh":
        first_file = File.objects.get(uuid=capture["files"][0]["uuid"]).file
        min_freq, max_freq = RadioHoundUtility.get_frequency_range(first_file)
    else:
        min_freq = capture.get("metadata", {}).get("fmin", None)
        max_freq = capture.get("metadata", {}).get("fmax", None)

    return {
        "uuid": capture["uuid"],
        "name": capture["name"],
        "media_type": capture.get("metadata", {}).get("data_type", "unknown"),
        "timestamp": timestamp,
        "created_at": capture["created_at"],
        "source": capture["source"],
        "files": capture["files"],
        "owner": capture["owner"],
        "type": capture["type"],
        "min_freq": min_freq,
        "max_freq": max_freq,
        "scan_time": scan_time,
        "end_time": calculate_end_time(timestamp, scan_time),
    }
