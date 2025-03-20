from datetime import datetime
from datetime import timedelta

from django.utils import timezone


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
