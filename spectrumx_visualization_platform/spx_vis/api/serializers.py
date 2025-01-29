from django.urls import reverse
from rest_framework import serializers

from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import SigMFFilePair


# serializer class for Capture
class CaptureSerializer(serializers.ModelSerializer[Capture]):
    class Meta:
        model = Capture
        fields = [
            "id",
            "owner",
            "name",
            "created_at",
            "timestamp",
            "type",
            "source",
        ]


class SigMFFilePairSerializer(serializers.ModelSerializer[SigMFFilePair]):
    data_file = serializers.FileField(write_only=True)
    meta_file = serializers.FileField(write_only=True)
    data_file_name = serializers.CharField(source="data_file.name", read_only=True)
    meta_file_name = serializers.CharField(source="meta_file.name", read_only=True)

    class Meta:
        model = SigMFFilePair
        fields = ["id", "data_file", "meta_file", "data_file_name", "meta_file_name"]

    def create(self, validated_data: dict) -> SigMFFilePair:
        # Create the two underlying file objects.
        data_file = File.objects.create(
            owner=self.context["request"].user,
            file=validated_data["data_file"],
            media_type="application/octet-stream",
            name=validated_data["data_file"].name,
        )
        meta_file = File.objects.create(
            owner=self.context["request"].user,
            file=validated_data["meta_file"],
            media_type="application/json",
            name=validated_data["meta_file"].name,
        )

        return SigMFFilePair.objects.create(data_file=data_file, meta_file=meta_file)


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
