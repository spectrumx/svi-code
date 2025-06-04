import logging
from datetime import UTC
from datetime import datetime

from rest_framework.request import Request

from spectrumx_visualization_platform.spx_vis.api.utils import calculate_end_time
from spectrumx_visualization_platform.spx_vis.models import CaptureType
from spectrumx_visualization_platform.users.models import User


def get_sds_captures(request: Request):
    """Get SDS captures for the current user."""
    user: User = request.user

    try:
        sds_client = user.sds_client()
        captures_response = sds_client.captures.listing()
        captures = [capture.model_dump() for capture in captures_response]
        formatted_captures = []

        for capture in captures:
            if capture["capture_type"] == CaptureType.RadioHound:
                formatted_capture = format_sds_rh_capture(capture, request.user.id)
            elif capture["capture_type"] == CaptureType.DigitalRF:
                formatted_capture = format_sds_drf_capture(capture, request.user.id)
            formatted_captures.append(formatted_capture)

    except Exception:
        logging.exception("Error fetching SDS captures")
        return []

    return formatted_captures


def format_sds_rh_capture(sds_capture: dict, user_id: int):
    """Format a single SDS capture.

    Args:
        sds_capture: Raw SDS capture data
        user_id: ID of the current user

    Returns:
        dict: Formatted capture data
    """
    capture_props = sds_capture["capture_props"]
    metadata = capture_props["metadata"]

    timestamp = capture_props["timestamp"]
    scan_time = metadata["scan_time"] or None

    files = [
        {
            "uuid": file["uuid"],
            "name": file["name"],
        }
        for file in sds_capture["files"]
    ]

    owner_uuid = User.objects.get(id=user_id).uuid

    return {
        "uuid": sds_capture["uuid"],
        "owner": owner_uuid,
        "name": sds_capture["scan_group"],
        "files": files,
        # "created_at": sds_capture["created_at"],
        "timestamp": timestamp,
        "type": sds_capture["capture_type"],
        "source": "sds",
        "min_freq": metadata["fmin"],
        "max_freq": metadata["fmax"],
        "scan_time": scan_time,
        "end_time": calculate_end_time(timestamp, scan_time),
    }


def format_sds_drf_capture(sds_capture: dict, user_id: int):
    """Format a single SDS capture.

    Args:
        sds_capture: Raw SDS capture data
        user_id: ID of the current user

    Returns:
        dict: Formatted capture data
    """
    capture_props = sds_capture["capture_props"]
    custom_attrs = capture_props["custom_attrs"]

    start_bound: int = capture_props["start_bound"]
    end_bound: int = capture_props["end_bound"]
    scan_time = end_bound - start_bound
    timestamp = datetime.fromtimestamp(start_bound, tz=UTC).isoformat()
    end_time = datetime.fromtimestamp(end_bound, tz=UTC).isoformat()

    center_freq: int = capture_props["center_freq"]
    bandwidth: int = capture_props["bandwidth"]
    fmin = center_freq - bandwidth / 2
    fmax = center_freq + bandwidth / 2

    files = [
        {
            "uuid": file["uuid"],
            "name": file["name"],
        }
        for file in sds_capture["files"]
    ]

    owner_uuid = User.objects.get(id=user_id).uuid

    return {
        "uuid": sds_capture["uuid"],
        "owner": owner_uuid,
        "name": sds_capture["channel"],
        "files": files,
        # "created_at": sds_capture["created_at"],
        "timestamp": timestamp,
        "type": sds_capture["capture_type"],
        "source": "sds",
        "min_freq": fmin,
        "max_freq": fmax,
        "scan_time": scan_time,
        "end_time": end_time,
        "subchannels": custom_attrs["num_subchannels"],
    }
