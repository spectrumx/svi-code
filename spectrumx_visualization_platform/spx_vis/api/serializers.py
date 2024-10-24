from rest_framework import serializers

# from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import SigMFFilePair

# class UserSerializer(serializers.ModelSerializer[User]):
#     class Meta:
#         model = User
#         fields = ["username", "name", "url"]

#         extra_kwargs = {
#             "url": {"view_name": "api:user-detail", "lookup_field": "username"},
#         }


class SigMFFilePairSerializer(serializers.ModelSerializer[SigMFFilePair]):
    class Meta:
        model = SigMFFilePair
        fields = ["id", "data_file", "meta_file"]
