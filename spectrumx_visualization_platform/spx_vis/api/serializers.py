from rest_framework import serializers

# from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import SigMFFilePair

# class UserSerializer(serializers.ModelSerializer[User]):
#     class Meta:
#         model = User
#         fields = ["username", "name", "url"]

#         extra_kwargs = {
#             "url": {"view_name": "api:user-detail", "lookup_field": "username"},
#         }


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
