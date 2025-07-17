from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.mixins import ListModelMixin
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.mixins import UpdateModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from spectrumx import (
    Client as SpectrumClient,  # Adjust import based on actual SDK package name
)

from config import settings
from spectrumx_visualization_platform.users.models import User

from .serializers import UserSerializer


class UserViewSet(RetrieveModelMixin, ListModelMixin, UpdateModelMixin, GenericViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()
    lookup_field = "username"

    def get_queryset(self, *args, **kwargs):  # noqa: ARG002
        assert isinstance(self.request.user.id, int)
        return self.queryset.filter(id=self.request.user.id)

    @action(detail=False)
    def me(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(status=status.HTTP_200_OK, data=serializer.data)


@api_view(["GET"])
def get_session_info(request):
    """
    Get session information for the authenticated user.

    Note: CSRF tokens are automatically handled by Django's middleware via HTTP-only cookies.
    Auth tokens are only created when explicitly requested.
    """
    if request.user.is_authenticated:
        # Get existing auth token if it exists, don't create new ones unnecessarily
        auth_token = Token.objects.filter(user=request.user).first()

        return Response(
            {
                "auth_token": str(auth_token) if auth_token else None,
                "user": {
                    "id": request.user.id,
                    "username": request.user.username,
                },
            },
        )
    return Response({"error": "User not authenticated"}, status=401)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_auth_token(request):
    """
    Create a new authentication token for the user.
    This endpoint should be called when the user needs a token for API access.
    """
    if request.user.is_authenticated:
        auth_token = Token.objects.get_or_create(user=request.user)[0]
        return Response(
            {
                "auth_token": str(auth_token),
                "message": "Authentication token created successfully",
            },
            status=status.HTTP_201_CREATED,
        )
    return Response({"error": "User not authenticated"}, status=401)


@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
def api_token(request):
    if request.method == "GET":
        return Response(
            {"api_token": request.user.api_token},
            status=status.HTTP_200_OK,
        )
    if not request.data.get("api_token"):
        return Response(
            {"error": "API token is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    user.api_token = request.data["api_token"]
    user.save()

    return Response(
        {"message": "API token saved successfully"},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def test_sdk_connection(request):
    if not request.user.api_token:
        return Response(
            {"error": "No API token found. Please set your API token first."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        # Initialize SDK client with user's API token
        client = SpectrumClient(
            host=settings.SPECTRUMX_HOST,
            env_config={"SDS_SECRET_TOKEN": request.user.api_token},
        )

        client.dry_run = False

        # Attempt to make a test connection
        client.authenticate()

        return Response(
            {"message": "SDK connection successful"},
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {"error": f"Failed to connect to SDK: {e!s}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
