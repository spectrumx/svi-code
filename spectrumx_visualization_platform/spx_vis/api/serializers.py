from django.core.files.uploadedfile import UploadedFile
from django.urls import reverse
from rest_framework import serializers

from spectrumx_visualization_platform.spx_vis.capture_utils.radiohound import (
    RadioHoundUtility,
)
from spectrumx_visualization_platform.spx_vis.capture_utils.sigmf import SigMFUtility
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import CaptureType
from spectrumx_visualization_platform.spx_vis.models import File


class FileSerializer(serializers.ModelSerializer[File]):
    """Serializer for File model metadata.

    Provides serialization of File objects with owner information and file handling.
    """

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

    files = FileSerializer(many=True, read_only=True)
    # Separate field for files to be uploaded on Capture creation
    uploaded_files = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=True,
    )
    name = serializers.CharField(required=False, allow_null=True)

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
            raise ValueError(f"Unsupported capture type: {capture_type}")

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
            raise ValueError(f"Unsupported capture type: {capture_type}")

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
