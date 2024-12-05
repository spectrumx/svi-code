from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from spectrumx import Client as SpectrumClient


@api_view(["GET"])
def get_sds_files(request):
    if request.user.is_authenticated:
        client = SpectrumClient(
            host=settings.SPECTRUMX_HOST,
            env_config={"SDS_SECRET_TOKEN": request.user.api_token},
        )
        client.dry_run = False
        client.authenticate()

        # datasets = client.datasets()
        datasets = {"error": "Not implemented"}
        return Response(datasets)
    return Response({"error": "User not authenticated"}, status=401)
