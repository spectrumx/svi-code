from rest_framework import viewsets

from spectrumx_visualization_platform.spx_vis.api.serializers import (
    SigMFFilePairSerializer,
)
from spectrumx_visualization_platform.spx_vis.models import SigMFFilePair

# class UserViewSet(viewsets.ModelViewSet):
#     """
#     API endpoint that allows users to be viewed or edited.
#     """
#     queryset = User.objects.all().order_by('-date_joined')
#     serializer_class = UserSerializer
#     permission_classes = [permissions.IsAuthenticated]


class SigMFFilePairViewSet(viewsets.ModelViewSet):
    queryset = SigMFFilePair.objects.all()
    serializer_class = SigMFFilePairSerializer
    # permission_classes = [permissions.IsAuthenticated]
    # def get_queryset(self, *args, **kwargs):
    #     assert isinstance(self.request.user.id, int)
    #     return self.queryset.filter(id=self.request.user.id)
    # @action(detail=False)
    # def me(self, request):
    #     serializer = UserSerializer(request.user, context={"request": request})
    #     return Response(status=status.HTTP_200_OK, data=serializer.data)
