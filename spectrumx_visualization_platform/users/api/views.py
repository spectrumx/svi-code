from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.mixins import ListModelMixin
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.mixins import UpdateModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.tokens import RefreshToken

from spectrumx_visualization_platform.users.models import User

from .serializers import UserSerializer


class UserViewSet(RetrieveModelMixin, ListModelMixin, UpdateModelMixin, GenericViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()
    lookup_field = "username"

    def get_queryset(self, *args, **kwargs):
        assert isinstance(self.request.user.id, int)
        return self.queryset.filter(id=self.request.user.id)

    @action(detail=False)
    def me(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(status=status.HTTP_200_OK, data=serializer.data)


@api_view(["GET"])
def get_session_info(request):
    if request.user.is_authenticated:
        refresh_token = RefreshToken.for_user(request.user)
        csrf_token = get_token(request)

        return Response(
            {
                "access_token": str(refresh_token.access_token),
                "refresh_token": str(refresh_token),
                "csrf_token": csrf_token,
                "user": {
                    "id": request.user.id,
                    "username": request.user.username,
                },
            },
        )
    return Response({"error": "User not authenticated"}, status=401)


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def api_token(request):
    if request.method == "GET":
        return Response(
            {"api_token": request.user.api_token},
            status=status.HTTP_200_OK
        )
    if not request.data.get("api_token"):
        return Response(
            {"error": "API token is required"}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = request.user
    user.api_token = request.data["api_token"]
    user.save()
    
    return Response(
        {"message": "API token saved successfully"},
        status=status.HTTP_200_OK
    )

