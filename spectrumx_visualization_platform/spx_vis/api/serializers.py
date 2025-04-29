import logging
from datetime import UTC
from datetime import datetime
from datetime import timedelta

from django.core.files.uploadedfile import UploadedFile
from django.urls import reverse
from rest_framework import serializers

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

    # Define supported capture types for each visualization type
    SUPPORTED_CAPTURE_TYPES = {
        VisualizationType.Spectrogram: [CaptureType.SigMF],
        VisualizationType.Waterfall: [CaptureType.RadioHound],
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
        ]
        read_only_fields = [
            "uuid",
            "created_at",
            "updated_at",
            "captures",
            "is_saved",
            "expiration_date",
        ]

    def _migrate_capture_ids(self, obj: Visualization) -> None:
        """Migrate capture IDs from integers to UUIDs if needed.

        This method checks if any capture IDs in the visualization are still using
        integer IDs and updates them to use UUIDs instead. The migration happens
        incrementally as visualizations are accessed.

        Only applies to local captures (capture_source="svi_user").

        Args:
            obj: The Visualization instance to migrate
        """
        if not obj.capture_ids or obj.capture_source != CaptureSource.SVI_User:
            return

        # Check if any IDs are still integers
        has_integer_ids = any(
            isinstance(capture_id, int) or capture_id.isdigit()
            for capture_id in obj.capture_ids
        )
        if not has_integer_ids:
            return

        # Get the UUIDs for the integer IDs
        int_ids = [
            int(capture_id)
            for capture_id in obj.capture_ids
            if isinstance(capture_id, int) or capture_id.isdigit()
        ]
        captures = Capture.objects.filter(id__in=int_ids, owner=obj.owner)
        uuid_map = {str(capture.id): str(capture.uuid) for capture in captures}

        # Update the capture_ids with UUIDs
        new_capture_ids = []
        for capture_id in obj.capture_ids:
            if isinstance(capture_id, int) or capture_id.isdigit():
                new_capture_ids.append(uuid_map.get(str(capture_id), capture_id))
            else:
                new_capture_ids.append(capture_id)

        # Update the visualization if any IDs were changed
        if new_capture_ids != obj.capture_ids:
            obj.capture_ids = new_capture_ids
            obj.save(update_fields=["capture_ids"])
            logger.info(f"Migrated capture IDs for visualization {obj.uuid}")

    def get_captures(self, obj: Visualization) -> list[dict]:
        """Get the full capture information including files for each capture.

        Args:
            obj: The Visualization instance being serialized.

        Returns:
            list[dict]: List of capture data including files.
        """
        # Migrate capture IDs if needed (only for local captures)
        if obj.capture_source == CaptureSource.SVI_User:
            self._migrate_capture_ids(obj)

        request = self.context.get("request")
        if not request:
            return []

        captures = []

        if obj.capture_source == CaptureSource.SDS:
            try:
                sds_captures = get_sds_captures(request)
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
        """Create a new Visualization instance or return an existing matching one.

        Checks if a visualization with identical configuration already exists for the user.
        If found, returns the existing visualization instead of creating a new one.

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
