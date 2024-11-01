from rest_framework import permissions
from rest_framework import viewsets

from spectrumx_visualization_platform.spx_vis.api.serializers import (
    SigMFFilePairSerializer,
)
from spectrumx_visualization_platform.spx_vis.models import SigMFFilePair


class SigMFFilePairViewSet(viewsets.ModelViewSet):
    queryset = SigMFFilePair.objects.all()
    serializer_class = SigMFFilePairSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
