import logging
from datetime import UTC
from datetime import datetime
from datetime import timedelta

from django.core.files.uploadedfile import UploadedFile
from django.urls import reverse
from rest_framework import serializers

from spectrumx_visualization_platform.spx_vis.capture_utils.digital_rf import (
    DigitalRFUtility,
)
from spectrumx_visualization_platform.spx_vis.capture_utils.radiohound import (
    RadioHoundUtility,
)
from spectrumx_visualization_platform.spx_vis.capture_utils.sigmf import SigMFUtility
from spectrumx_visualization_platform.spx_vis.models import CAPTURE_TYPE_CHOICES
from spectrumx_visualization_platform.spx_vis.models import VISUALIZATION_TYPE_CHOICES
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import CaptureSource
from spectrumx_visualization_platform.spx_vis.models import CaptureType
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import Visualization
from spectrumx_visualization_platform.spx_vis.models import VisualizationType
from spectrumx_visualization_platform.spx_vis.source_utils.sds import get_sds_captures
from spectrumx_visualization_platform.users.models import User

logger = logging.getLogger(__name__)


class FileSerializer(serializers.ModelSerializer[File]):
    """Serializer for File model metadata.

    Provides serialization of File objects with owner information and file handling.
    """

    uuid = serializers.UUIDField(read_only=True)
    owner = serializers.ReadOnlyField(source="owner.uuid")
    file = serializers.FileField(write_only=True)
    content_url = serializers.SerializerMethodField()

    class Meta:
        model = File
        fields = [
            "uuid",
            "owner",
            "file",
            "content_url",
            "created_at",
            "expiration_date",
            "media_type",
            "name",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at", "local_path"]

    def get_content_url(self, obj: File) -> str:
        """Get the URL for downloading the file content.

        Args:
            obj: The File instance being serialized.

        Returns:
            str: The URL to download the file content.
        """
        request = self.context.get("request")
        if request is None:
            return ""
        return request.build_absolute_uri(
            reverse("api:file-content", kwargs={"uuid": obj.uuid}),
        )

    def create(self, validated_data: dict) -> File:
        """Create a new File instance.

        Args:
            validated_data: The validated data for creating the file.

        Returns:
            File: The created File instance.
        """
        # Set name from uploaded file if not provided
        if "name" not in validated_data:
            validated_data["name"] = validated_data["file"].name

        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class CaptureSerializer(serializers.ModelSerializer[Capture]):
    """Serializer for Capture model with automatic field handling.

    Handles creation of associated File objects and automatic field population.
    """

    uuid = serializers.UUIDField(read_only=True)
    name = serializers.CharField(required=False, allow_null=True)
    files = FileSerializer(many=True, read_only=True)
    owner = serializers.ReadOnlyField(source="owner.uuid")
    # Separate field for files to be uploaded on Capture creation
    uploaded_files = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=True,
    )

    class Meta:
        model = Capture
        fields = [
            "uuid",
            "owner",
            "name",
            "files",
            "created_at",
            "timestamp",
            "type",
            "source",
            "uploaded_files",  # Write-only field for file uploads
        ]
        read_only_fields = ["uuid", "owner", "created_at", "timestamp", "source"]

    def create(self, validated_data: dict) -> Capture:
        """Create a Capture with associated File objects.

        Args:
            validated_data: Validated data including uploaded files

        Returns:
            A single Capture instance
        """
        uploaded_files: list[UploadedFile] = validated_data.pop("uploaded_files")
        capture_type = validated_data["type"]

        if capture_type == CaptureType.RadioHound:
            capture_utility = RadioHoundUtility
        elif capture_type == CaptureType.SigMF:
            capture_utility = SigMFUtility
        elif capture_type == CaptureType.DigitalRF:
            capture_utility = DigitalRFUtility
        else:
            error_message = f"Unsupported capture type: {capture_type}"
            logger.error(error_message)
            raise ValueError(error_message)

        # Set defaults for required fields
        validated_data["owner"] = self.context["request"].user
        validated_data["source"] = (
            CaptureSource.SVI_User
        )  # Default source for user uploads

        # Extract timestamp from files based on capture type
        validated_data["timestamp"] = capture_utility.extract_timestamp(uploaded_files)

        validated_data["name"] = capture_utility.get_capture_name(
            uploaded_files, validated_data.get("name")
        )

        # Create the capture instance
        capture = super().create(validated_data)

        # Create File objects for each uploaded file
        for uploaded_file in uploaded_files:
            if not isinstance(uploaded_file, UploadedFile):
                error_message = "Uploaded file is not an instance of UploadedFile"
                logger.error(error_message)
                raise TypeError(error_message)

            media_type = capture_utility.get_media_type(uploaded_file)

            File.objects.create(
                owner=validated_data["owner"],
                file=uploaded_file,
                media_type=media_type,
                name=uploaded_file.name,
                capture=capture,
            )

        return capture


class VisualizationListSerializer(serializers.ModelSerializer[Visualization]):
    """Serializer for listing Visualization objects.

    Provides a lightweight serialization of Visualization objects without detailed capture information.
    """

    uuid = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    owner = serializers.ReadOnlyField(source="owner.uuid")
    capture_ids = serializers.JSONField(
        help_text="List of capture IDs used in this visualization"
    )

    class Meta:
        model = Visualization
        fields = [
            "uuid",
            "name",
            "owner",
            "type",
            "capture_ids",
            "capture_type",
            "capture_source",
            "settings",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "name", "created_at", "updated_at"]


class VisualizationDetailSerializer(serializers.ModelSerializer[Visualization]):
    """Serializer for detailed Visualization view.

    Provides full serialization of Visualization objects including detailed capture and file information.
    """

    uuid = serializers.UUIDField(read_only=True)
    name = serializers.CharField(required=False, allow_null=True)
    owner = serializers.ReadOnlyField(source="owner.uuid")
    capture_ids = serializers.JSONField(
        help_text="List of capture IDs used in this visualization",
        write_only=True,
    )
    captures = serializers.SerializerMethodField(read_only=True)
    is_saved = serializers.BooleanField(read_only=True)
    expiration_date = serializers.DateTimeField(read_only=True)
    total_slices = serializers.SerializerMethodField(read_only=True)

    # Define supported capture types for each visualization type
    SUPPORTED_CAPTURE_TYPES = {
        VisualizationType.Spectrogram: [
            CaptureType.SigMF,
            CaptureType.DigitalRF,
        ],
        VisualizationType.Waterfall: [CaptureType.RadioHound, CaptureType.DigitalRF],
    }

    class Meta:
        model = Visualization
        fields = [
            "uuid",
            "name",
            "owner",
            "type",
            "capture_ids",
            "capture_type",
            "capture_source",
            "settings",
            "created_at",
            "updated_at",
            "captures",
            "is_saved",
            "expiration_date",
            "total_slices",
        ]
        read_only_fields = [
            "uuid",
            "created_at",
            "updated_at",
            "captures",
            "is_saved",
            "expiration_date",
            "total_slices",
        ]

    def _handle_sds_errors(self, sds_errors: list[str]) -> None:
        """Handle SDS capture errors by raising a ValidationError.

        Args:
            sds_errors: List of error messages from SDS

        Raises:
            serializers.ValidationError: If there are any SDS errors
        """
        if sds_errors:
            raise serializers.ValidationError(
                f"Error getting SDS captures: {sds_errors}"
            )

    def get_captures(self, obj: Visualization) -> list[dict]:
        """Get the full capture information including files for each capture.

        Args:
            obj: The Visualization instance being serialized.

        Returns:
            list[dict]: List of capture data including files.
        """
        request = self.context.get("request")
        if not request:
            return []

        captures = []

        if obj.capture_source == CaptureSource.SDS:
            try:
                sds_captures, sds_errors = get_sds_captures(request.user)
                self._handle_sds_errors(sds_errors)
                captures = [
                    capture
                    for capture in sds_captures
                    if str(capture["uuid"]) in obj.capture_ids
                ]
            except Exception:
                logger.exception("Error fetching SDS captures")
                raise
        else:
            for capture_id in obj.capture_ids:
                try:
                    # Get local capture
                    capture = Capture.objects.get(uuid=capture_id, owner=request.user)
                    captures.append(
                        CaptureSerializer(capture, context={"request": request}).data
                    )
                except (Capture.DoesNotExist, Exception):
                    logger.exception(f"Error fetching capture {capture_id}")
                    continue

        return captures

    def get_total_slices(self, obj: Visualization) -> int | None:
        """Get the total number of slices for DigitalRF captures.

        Args:
            obj: The Visualization instance being serialized.

        Returns:
            int | None: Total number of slices for DigitalRF captures, None for other types.
        """
        # Only calculate total slices for DigitalRF waterfall visualizations
        if (
            obj.capture_type != CaptureType.DigitalRF
            or obj.type != VisualizationType.Waterfall
        ):
            return None

        request = self.context.get("request")
        if not request:
            return None

        try:
            if obj.capture_source == CaptureSource.SDS:
                # For SDS captures, we need to get the capture data and calculate total slices
                sds_captures, sds_errors = get_sds_captures(request.user)
                if sds_errors:
                    logger.warning(
                        f"SDS errors when calculating total slices: {sds_errors}"
                    )
                    return None

                # Find the specific capture
                capture = next(
                    (c for c in sds_captures if str(c["uuid"]) in obj.capture_ids), None
                )
                if not capture:
                    logger.warning("Capture not found for total slices calculation")
                    return None

                # Download the DigitalRF data to calculate total slices
                import os
                import shutil
                import tempfile
                from pathlib import Path

                from spectrumx_visualization_platform.spx_vis.capture_utils.digital_rf import (
                    DigitalRFUtility,
                )

                with tempfile.TemporaryDirectory() as temp_dir:
                    # Use the SDS client to download files
                    sds_client = request.user.sds_client()

                    # Get the capture from SDS client
                    sds_captures = sds_client.captures.listing(
                        capture_type=obj.capture_type
                    )
                    sds_capture = next(
                        (c for c in sds_captures if str(c.uuid) == obj.capture_ids[0]),
                        None,
                    )

                    if not sds_capture:
                        logger.warning("Capture not found in SDS client")
                        return None

                    # Create a directory for this capture
                    local_path = Path(temp_dir) / obj.capture_ids[0]
                    local_path.mkdir(parents=True)

                    # Download files using the SDS client
                    from spectrumx_visualization_platform.jobs.tasks import (
                        safe_sds_client_download,
                    )

                    file_results = safe_sds_client_download(
                        sds_client, sds_capture.top_level_dir, local_path
                    )

                    downloaded_files = [result() for result in file_results if result]
                    download_errors = [
                        result.error_info for result in file_results if not result
                    ]

                    if download_errors:
                        logger.warning(
                            f"Failed to download SDS files: {download_errors}"
                        )
                        return None

                    # For DigitalRF, maintain the directory structure
                    if obj.capture_type == CaptureType.DigitalRF:
                        # Get the UUIDs of the files in the capture for comparison
                        file_uuids = [file.uuid for file in sds_capture.files]

                        # Clean up unnecessary files and directories
                        matching_files = []
                        for f in downloaded_files:
                            if f.uuid in file_uuids:
                                matching_files.append(f)
                            else:
                                f.local_path.unlink()

                        if not matching_files:
                            logger.warning(
                                f"No matching files found for capture {obj.capture_ids[0]}"
                            )
                            return None

                        # Maintain directory structure like in tasks.py
                        file_paths = [str(f.local_path) for f in matching_files]
                        common_path = os.path.commonpath(file_paths)
                        shutil.move(common_path, local_path)

                        # Remove the SDS root directory if it exists
                        sds_root = (
                            str(sds_capture.files[0].directory).strip("/").split("/")[0]
                        )
                        sds_root_path = local_path / sds_root
                        if sds_root_path.exists():
                            shutil.rmtree(sds_root_path)

                        # Find the DigitalRF data directory
                        drf_data_path = None
                        for root, dirs, files in os.walk(local_path):
                            if "drf_properties.h5" in files:
                                # The DigitalRF directory is the parent of the channel directory
                                # (top-level directory containing channel directories)
                                drf_data_path = os.path.dirname(root)
                                break

                        if drf_data_path:
                            # Calculate total slices using the DigitalRF utility
                            total_slices = DigitalRFUtility.get_total_slices(
                                drf_data_path
                            )
                            return total_slices
                        else:
                            logger.warning("Could not find DigitalRF data directory")
                            return None

            else:
                # For local captures, we would need to access the actual files
                # This is more complex and would require file system access
                logger.warning(
                    "Total slices calculation not yet implemented for local DigitalRF captures"
                )
                return None

        except Exception as e:
            logger.error(f"Error calculating total slices: {e}")
            return None

    def validate_capture_ids(self, value) -> list[str]:
        """Validate that capture_ids is a non-empty list of strings.

        Args:
            value: The capture_ids value to validate

        Returns:
            The validated value

        Raises:
            serializers.ValidationError: If validation fails
        """
        if not isinstance(value, list):
            error_message = "capture_ids must be a list"
            logger.error(error_message)
            raise serializers.ValidationError(error_message)
        if not value:
            error_message = "capture_ids cannot be empty"
            logger.error(error_message)
            raise serializers.ValidationError(error_message)
        if len(value) > 1:
            error_message = "Visualizing multiple captures is not yet supported"
            logger.error(error_message)
            raise serializers.ValidationError(error_message)
        if not all(isinstance(capture_id, str) for capture_id in value):
            error_message = "All capture IDs must be strings"
            logger.error(error_message)
            raise serializers.ValidationError(error_message)

        return value

    def _check_captures(
        self,
        capture_ids: list[str],
        capture_source: str,
        capture_type: str,
        user: User,
    ):
        """Check if the given capture IDs are valid and accessible to the user.

        Queries either local database or SDS based on the capture source.
        Verifies all captures have the correct type.

        Args:
            capture_ids: List of capture IDs to look up
            capture_source: Source of the captures ("sds" or "svi_user")
            capture_type: Type of the captures
            user: The user making the request

        Raises:
            serializers.ValidationError: If captures have inconsistent types or can't be found
        """
        if capture_source == "sds":
            sds_client = user.sds_client()
            sds_captures = sds_client.captures.listing(capture_type=capture_type)
            sds_capture_uuids = [str(capture.uuid) for capture in sds_captures]

            # Verify all requested captures were found
            missing_uuids = set(capture_ids) - set(sds_capture_uuids)
            if missing_uuids:
                error_message = f"SDS captures of type {capture_type} not found: {', '.join(missing_uuids)}"
                logger.error(error_message)
                raise serializers.ValidationError(error_message)
            return

        if capture_source == "svi_user":
            # Get local captures
            local_captures = Capture.objects.filter(
                uuid__in=capture_ids, owner=user, type=capture_type
            )
            local_capture_uuids = [str(capture.uuid) for capture in local_captures]

            # Verify all requested captures were found
            missing_uuids = set(capture_ids) - set(local_capture_uuids)
            if missing_uuids:
                error_message = f"Local captures of type {capture_type} not found: {', '.join(missing_uuids)}"
                logger.error(error_message)
                raise serializers.ValidationError(error_message)
            return

        if capture_source == "svi_public":
            # Not yet implemented
            error_message = "Public SVI captures are not yet implemented"
            logger.error(error_message)
            raise serializers.ValidationError(error_message)

        error_message = f"Invalid capture source: {capture_source}"
        logger.error(error_message)
        raise serializers.ValidationError(error_message)

    def validate(self, data: dict) -> dict:
        """Validate the visualization data.

        Performs the following checks:
        - For spectrogram visualizations, only one capture ID is allowed
        - All captures exist and are accessible to the user
        - All captures are of the same type
        - The capture type is supported for the chosen visualization type

        Args:
            data: The data to validate

        Returns:
            The validated data

        Raises:
            serializers.ValidationError: If validation fails
        """
        if "capture_source" in data:
            if data["capture_source"] != CaptureSource.SDS:
                error_message = "SVI-hosted captures are not currently supported"
                logger.error(error_message)
                raise serializers.ValidationError(error_message)

        # Only validate type-related fields if type is being updated
        if "type" in data:
            # Validate that the capture type is supported for this visualization type
            supported_types = self.SUPPORTED_CAPTURE_TYPES.get(data["type"], [])
            if data["capture_type"] not in supported_types:
                supported_names = [
                    dict(CAPTURE_TYPE_CHOICES)[t] for t in supported_types
                ]
                error_message = (
                    f"{dict(VISUALIZATION_TYPE_CHOICES)[data['type']]} visualizations only support "
                    f"the following capture types: {', '.join(supported_names)}"
                )
                raise serializers.ValidationError(error_message)

        # Only validate capture-related fields if they're being updated
        if "capture_ids" in data or "capture_source" in data or "capture_type" in data:
            # Check if the given capture IDs are valid and accessible to the user
            capture_ids = data.get("capture_ids") or self.instance.capture_ids
            capture_source = data.get("capture_source") or self.instance.capture_source
            capture_type = data.get("capture_type") or self.instance.capture_type

            self._check_captures(
                capture_ids,
                capture_source,
                capture_type,
                self.context["request"].user,
            )

        return data

    def create(self, validated_data: dict) -> Visualization:
        """Create a new Visualization instance.

        Args:
            validated_data: The validated data for creating the visualization

        Returns:
            The created or existing Visualization instance
        """
        user = self.context["request"].user
        validated_data["owner"] = user

        # Sort the input capture_ids
        sorted_capture_ids = sorted(validated_data["capture_ids"])
        validated_data["capture_ids"] = sorted_capture_ids

        # Set a default name if not provided
        if "name" not in validated_data:
            validated_data["name"] = (
                f"Unnamed {dict(VISUALIZATION_TYPE_CHOICES)[validated_data['type']]}"
            )

        # If the visualization is not saved, set the expiration date to 12 hours from now
        if "is_saved" not in validated_data:
            validated_data["is_saved"] = False
        if not validated_data["is_saved"]:
            validated_data["expiration_date"] = datetime.now(UTC) + timedelta(hours=12)

        return super().create(validated_data)
