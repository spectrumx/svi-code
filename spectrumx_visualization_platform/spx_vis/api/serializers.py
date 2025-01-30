from django.urls import reverse
from rest_framework import serializers

from spectrumx_visualization_platform.spx_vis.models import Capture
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
    files = FileSerializer(many=True, read_only=True)

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
        ]
