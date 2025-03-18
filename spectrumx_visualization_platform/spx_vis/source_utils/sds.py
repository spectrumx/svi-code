from typing import TYPE_CHECKING

import requests
from django.conf import settings
from rest_framework.request import Request

from spectrumx_visualization_platform.spx_vis.api.utils import calculate_end_time

if TYPE_CHECKING:
    from spectrumx_visualization_platform.users.models import User


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
    print("sds_capture", sds_capture)
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
