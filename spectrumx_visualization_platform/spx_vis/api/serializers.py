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
from spectrumx_visualization_platform.spx_vis.models import CaptureType
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import Visualization
from spectrumx_visualization_platform.spx_vis.models import VisualizationType
from spectrumx_visualization_platform.spx_vis.source_utils.sds import get_sds_captures
from spectrumx_visualization_platform.users.models import User


class FileSerializer(serializers.ModelSerializer[File]):
    """Serializer for File model metadata.

    Provides serialization of File objects with owner information and file handling.
    """

    id = serializers.CharField(read_only=True)
    owner = serializers.ReadOnlyField(source="owner.username")
    file = serializers.FileField(write_only=True)
    content_url = serializers.SerializerMethodField()

    class Meta:
        model = File
        fields = [
            "id",
            "owner",
            "file",
            "content_url",
            "created_at",
            "expiration_date",
            "media_type",
            "name",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "local_path"]

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
            reverse("api:file-content", kwargs={"pk": obj.pk}),
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
    For RadioHound captures, each uploaded file creates a separate capture.
    """

    id = serializers.CharField(read_only=True)
    name = serializers.CharField(required=False, allow_null=True)
    files = FileSerializer(many=True, read_only=True)
    # Separate field for files to be uploaded on Capture creation
    uploaded_files = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=True,
    )

    class Meta:
        model = Capture
        fields = [
            "id",
            "owner",
            "name",
            "files",
            "created_at",
            "timestamp",
            "type",
            "source",
            "uploaded_files",  # Write-only field for file uploads
        ]
        read_only_fields = ["owner", "created_at", "timestamp", "source"]

    def create(self, validated_data: dict) -> Capture | list[Capture]:
        """Create one or more Captures with associated File objects.

        For RadioHound captures, each uploaded file creates a separate capture.
        For other capture types, creates a single capture with multiple files.

        Args:
            validated_data: Validated data including uploaded files

        Returns:
            Either a single Capture instance or a list of Capture instances for
            RadioHound
        """
        uploaded_files: list[UploadedFile] = validated_data.pop("uploaded_files")
        capture_type = validated_data["type"]

        if capture_type == CaptureType.RadioHound:
            capture_utility = RadioHoundUtility
        elif capture_type == CaptureType.SigMF:
            capture_utility = SigMFUtility
        else:
            error_message = f"Unsupported capture type: {capture_type}"
            raise ValueError(error_message)

        # Set defaults for required fields
        validated_data["owner"] = self.context["request"].user
        validated_data["source"] = "svi_user"  # Default source for user uploads

        if capture_type == CaptureType.RadioHound:
            # Create separate capture for each RadioHound file
            capture_names = capture_utility.get_capture_names(
                uploaded_files, validated_data.get("name")
            )
            captures = []

            for i, uploaded_file in enumerate(uploaded_files):
                if not isinstance(uploaded_file, UploadedFile):
                    continue

                # Create new validated data for each capture
                file_validated_data = validated_data.copy()

                # Extract timestamp for this specific file
                file_validated_data["timestamp"] = RadioHoundUtility.extract_timestamp(
                    [uploaded_file]
                )

                file_validated_data["name"] = capture_names[i]

                # Create capture instance
                capture = super().create(file_validated_data)

                # Create associated File object
                File.objects.create(
                    owner=file_validated_data["owner"],
                    file=uploaded_file,
                    media_type=RadioHoundUtility.get_media_type(uploaded_file),
                    name=uploaded_file.name,
                    capture=capture,
                )

                captures.append(capture)

            return captures

        # For other capture types, proceed with existing logic
        if capture_type == CaptureType.SigMF:
            capture_utility = SigMFUtility
        else:
            error_message = f"Unsupported capture type: {capture_type}"
            raise ValueError(error_message)

        # Extract timestamp from files based on capture type
        validated_data["timestamp"] = capture_utility.extract_timestamp(uploaded_files)

        validated_data["name"] = capture_utility.get_capture_names(
            uploaded_files, validated_data.get("name")
        )[0]

        # Create the capture instance
        capture = super().create(validated_data)

        # Create File objects for each uploaded file
        for uploaded_file in uploaded_files:
            if not isinstance(uploaded_file, UploadedFile):
                continue
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

    owner = serializers.ReadOnlyField(source="owner.username")
    capture_ids = serializers.JSONField(
        help_text="List of capture IDs used in this visualization"
    )

    class Meta:
        model = Visualization
        fields = [
            "id",
            "owner",
            "type",
            "capture_ids",
            "capture_type",
            "capture_source",
            "settings",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class VisualizationDetailSerializer(serializers.ModelSerializer[Visualization]):
    """Serializer for detailed Visualization view.

    Provides full serialization of Visualization objects including detailed capture and file information.
    """

    owner = serializers.ReadOnlyField(source="owner.username")
    capture_ids = serializers.JSONField(
        help_text="List of capture IDs used in this visualization",
        write_only=True,
    )
    captures = serializers.SerializerMethodField(read_only=True)

    # Define supported capture types for each visualization type
    SUPPORTED_CAPTURE_TYPES = {
        VisualizationType.Spectrogram: [CaptureType.SigMF],
        VisualizationType.Waterfall: [CaptureType.RadioHound],
    }

    class Meta:
        model = Visualization
        fields = [
            "id",
            "owner",
            "type",
            "capture_ids",
            "capture_type",
            "capture_source",
            "settings",
            "created_at",
            "updated_at",
            "captures",
        ]
        read_only_fields = ["created_at", "updated_at", "captures"]

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

        if obj.capture_source == "sds":
            try:
                sds_captures = get_sds_captures(request)
                captures = [
                    capture
                    for capture in sds_captures
                    if str(capture["id"]) in obj.capture_ids
                ]
            except Exception as e:
                print(f"Error fetching SDS captures: {e}")
                raise
        else:
            for capture_id in obj.capture_ids:
                try:
                    # Get local capture
                    capture = Capture.objects.get(id=capture_id, owner=request.user)
                    captures.append(
                        CaptureSerializer(capture, context={"request": request}).data
                    )
                except (Capture.DoesNotExist, Exception) as e:
                    print(f"Error fetching capture {capture_id}: {e}")
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
            raise serializers.ValidationError(error_message)

        if not value:
            error_message = "capture_ids cannot be empty"
            raise serializers.ValidationError(error_message)

        if not all(isinstance(capture_id, str) for capture_id in value):
            error_message = "All capture IDs must be strings"
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

            # Get SDS captures
            sds_captures = sds_client.captures.listing(capture_type=capture_type)
            sds_capture_ids = [str(capture.uuid) for capture in sds_captures]

            # Verify all requested captures were found
            missing_ids = set(capture_ids) - set(sds_capture_ids)
            if missing_ids:
                error_message = f"SDS captures of type {capture_type} not found: {', '.join(missing_ids)}"
                raise serializers.ValidationError(error_message)

        elif capture_source == "svi_user":
            # Get local captures
            local_captures = Capture.objects.filter(
                id__in=capture_ids, owner=user, type=capture_type
            ).values_list("id", flat=True)

            # Verify all requested captures were found
            missing_ids = set(capture_ids) - set(local_captures)
            if missing_ids:
                error_message = f"Local captures of type {capture_type} not found: {', '.join(missing_ids)}"
                raise serializers.ValidationError(error_message)

        elif capture_source == "svi_public":
            # Not yet implemented
            error_message = "Public SVI captures are not yet implemented"
            raise serializers.ValidationError(error_message)

        else:
            error_message = f"Invalid capture source: {capture_source}"
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
        # Validate number of captures for spectrogram
        if (
            data["type"] == VisualizationType.Spectrogram
            and len(data["capture_ids"]) != 1
        ):
            error_message = "Spectrogram visualizations must have exactly one capture"
            raise serializers.ValidationError(error_message)

        # Check if the given capture IDs are valid and accessible to the user
        self._check_captures(
            data["capture_ids"],
            data["capture_source"],
            data["capture_type"],
            self.context["request"].user,
        )

        # Validate that the capture type is supported for this visualization type
        supported_types = self.SUPPORTED_CAPTURE_TYPES.get(data["type"], [])
        if data["capture_type"] not in supported_types:
            supported_names = [dict(CAPTURE_TYPE_CHOICES)[t] for t in supported_types]
            error_message = (
                f"{dict(VISUALIZATION_TYPE_CHOICES)[data['type']]} visualizations only support "
                f"the following capture types: {', '.join(supported_names)}"
            )
            raise serializers.ValidationError(error_message)

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

        # Check for existing visualization with same configuration
        existing_visualization = Visualization.objects.filter(
            owner=user,
            type=validated_data["type"],
            capture_ids=sorted_capture_ids,
            capture_type=validated_data["capture_type"],
            capture_source=validated_data["capture_source"],
            settings=validated_data.get("settings", {}),
        ).first()

        if existing_visualization:
            print(
                f"Returning existing visualization with same config: {existing_visualization.id}"
            )
            return existing_visualization

        return super().create(validated_data)
