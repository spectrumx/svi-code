import mimetypes
from datetime import datetime

from django.core.files.uploadedfile import UploadedFile
from django.urls import reverse
from rest_framework import serializers

from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import CaptureType
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.utils.timestamp_extractors import (
    extract_radiohound_timestamp,
)
from spectrumx_visualization_platform.spx_vis.utils.timestamp_extractors import (
    extract_sigmf_timestamp,
)


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
    """

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

    def _extract_timestamp(
        self, files: list[UploadedFile], capture_type: str
    ) -> datetime | None:
        """Extract timestamp from uploaded files based on capture type.

        Args:
            files: List of uploaded files
            capture_type: Type of capture (sigmf, drf, rh)

        Returns:
            datetime: Extracted timestamp or None if not found
        """
        if capture_type == CaptureType.SigMF:
            meta_file = next((f for f in files if f.name.endswith(".sigmf-meta")), None)
            if meta_file:
                return extract_sigmf_timestamp(meta_file)

        elif capture_type == CaptureType.RadioHound:
            rh_file = next((f for f in files if f.name.endswith(".json")), None)
            if rh_file:
                return extract_radiohound_timestamp(rh_file)

        return None

    def create(self, validated_data: dict) -> Capture:
        """Create a new Capture with associated File objects.

        Args:
            validated_data: Validated data including uploaded files

        Returns:
            The created Capture instance
        """
        uploaded_files = validated_data.pop("uploaded_files")

        # Set defaults for required fields
        validated_data["owner"] = self.context["request"].user

        # Extract timestamp from files based on capture type
        timestamp = self._extract_timestamp(uploaded_files, validated_data["type"])
        validated_data["timestamp"] = timestamp or None

        validated_data["source"] = "svi_user"  # Default source for user uploads

        # Create the capture instance
        capture = super().create(validated_data)

        # Create File objects for each uploaded file
        for uploaded_file in uploaded_files:
            if not isinstance(uploaded_file, UploadedFile):
                continue

            # Determine media type based on capture type
            if capture.type == CaptureType.DigitalRF:
                media_type = "application/octet-stream"
            elif capture.type == CaptureType.RadioHound:
                media_type = "application/json"
            elif capture.type == CaptureType.SigMF:
                # Check file extension for SigMF
                if uploaded_file.name.endswith(".sigmf-meta"):
                    media_type = "application/json"
                elif uploaded_file.name.endswith(".sigmf-data"):
                    media_type = "application/octet-stream"
                else:
                    media_type = "application/octet-stream"
            else:
                # Try to guess media type based on file extension
                media_type, _ = mimetypes.guess_type(uploaded_file.name)
                if media_type is None:
                    media_type = "application/octet-stream"

            File.objects.create(
                owner=validated_data["owner"],
                file=uploaded_file,
                media_type=media_type,
                name=uploaded_file.name,
                capture=capture,
            )

        return capture
