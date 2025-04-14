from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.parsers import FormParser
from rest_framework.parsers import JSONParser
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory
from rest_framework.test import force_authenticate

from spectrumx_visualization_platform.spx_vis.api.views import CaptureViewSet
from spectrumx_visualization_platform.spx_vis.api.views import FileViewSet
from spectrumx_visualization_platform.spx_vis.api.views import VisualizationViewSet
from spectrumx_visualization_platform.spx_vis.api.views import capture_list
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import Visualization
from spectrumx_visualization_platform.users.models import User


@pytest.mark.django_db()
class TestCaptureViewSet:
    @pytest.fixture()
    def api_rf(self) -> APIRequestFactory:
        return APIRequestFactory()

    @pytest.fixture()
    def user(self) -> User:
        password = "testpass123"
        return User.objects.create_user(
            username="testuser", email="test@example.com", password=password
        )

    @pytest.fixture()
    def sigmf_data_file(self) -> SimpleUploadedFile:
        """Load SigMF data file from fixtures."""
        fixture_path = Path(__file__).parent / "fixtures" / "sample.sigmf-data"
        with open(fixture_path, "rb") as f:
            return SimpleUploadedFile(
                "sample.sigmf-data", f.read(), content_type="application/octet-stream"
            )

    @pytest.fixture()
    def sigmf_meta_file(self) -> SimpleUploadedFile:
        """Load SigMF metadata file from fixtures."""
        fixture_path = Path(__file__).parent / "fixtures" / "sample.sigmf-meta"
        with open(fixture_path, "rb") as f:
            return SimpleUploadedFile(
                "sample.sigmf-meta", f.read(), content_type="application/json"
            )

    @pytest.fixture()
    def capture(
        self,
        user: User,
        sigmf_data_file: SimpleUploadedFile,
        sigmf_meta_file: SimpleUploadedFile,
    ) -> Capture:
        """Create a capture with SigMF files."""
        capture = Capture.objects.create(owner=user, name="Test Capture", type="sigmf")

        # Create data file
        File.objects.create(
            owner=user,
            name="sample.sigmf-data",
            media_type="application/octet-stream",
            file=sigmf_data_file,
            capture=capture,
        )

        # Create metadata file
        File.objects.create(
            owner=user,
            name="sample.sigmf-meta",
            media_type="application/json",
            file=sigmf_meta_file,
            capture=capture,
        )

        return capture

    def test_get_queryset(
        self, user: User, capture: Capture, api_rf: APIRequestFactory
    ):
        """Test that get_queryset returns only captures owned by the user."""
        view = CaptureViewSet()
        request = api_rf.get("/fake-url/")
        request.user = user
        view.request = request

        queryset = view.get_queryset()

        assert capture in queryset
        assert queryset.count() == 1

    def test_create_spectrogram_success(
        self, user: User, capture: Capture, api_rf: APIRequestFactory
    ):
        """Test successful spectrogram creation request."""
        view = CaptureViewSet()
        request = api_rf.post(
            f"/fake-url/{capture.uuid}/create_spectrogram/",
            {"width": 10, "height": 10},
            format="json",
        )
        force_authenticate(request, user=user)
        drf_request = Request(request)
        drf_request.parsers = [JSONParser()]
        view.request = drf_request
        view.kwargs = {"uuid": str(capture.uuid)}

        response = view.create_spectrogram(drf_request, uuid=str(capture.uuid))

        assert response.status_code == status.HTTP_201_CREATED
        assert "job_id" in response.data
        assert response.data["status"] == "submitted"

    def test_create_spectrogram_invalid_type(
        self, user: User, capture: Capture, api_rf: APIRequestFactory
    ):
        """Test spectrogram creation with invalid capture type."""
        capture.type = "invalid"
        capture.save()

        view = CaptureViewSet()
        request = api_rf.post(
            f"/fake-url/{capture.uuid}/create_spectrogram/",
            {"width": 10, "height": 10},
            format="json",
        )
        force_authenticate(request, user=user)
        drf_request = Request(request)
        drf_request.parsers = [JSONParser()]
        view.request = drf_request
        view.kwargs = {"uuid": str(capture.uuid)}

        response = view.create_spectrogram(drf_request, uuid=str(capture.uuid))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["status"] == "error"


@pytest.mark.django_db()
class TestFileViewSet:
    @pytest.fixture()
    def api_rf(self) -> APIRequestFactory:
        return APIRequestFactory()

    @pytest.fixture()
    def user(self) -> User:
        password = "testpass123"
        return User.objects.create_user(
            username="testuser", email="test@example.com", password=password
        )

    @pytest.fixture()
    def file(self, user: User) -> File:
        return File.objects.create(
            owner=user, name="test_file.txt", media_type="text/plain"
        )

    def test_get_queryset(self, user: User, file: File, api_rf: APIRequestFactory):
        """Test that get_queryset returns only files owned by the user."""
        view = FileViewSet()
        request = api_rf.get("/fake-url/")
        request.user = user
        view.request = request

        queryset = view.get_queryset()

        assert file in queryset
        assert queryset.count() == 1

    def test_perform_create(self, user: User, api_rf: APIRequestFactory):
        """Test that file creation assigns the correct owner."""
        view = FileViewSet()

        # Create a test file
        test_file = SimpleUploadedFile(
            "test.txt", b"test content", content_type="text/plain"
        )

        request = api_rf.post(
            "/fake-url/",
            {
                "name": "new_file.txt",
                "media_type": "text/plain",
                "file": test_file,
            },
            format="multipart",
        )
        force_authenticate(request, user=user)
        drf_request = Request(request)
        drf_request.parsers = [MultiPartParser(), FormParser()]
        view.request = drf_request
        view.format_kwarg = None  # Initialize format_kwarg
        view.action = "create"  # Set the action

        serializer = view.get_serializer(data=drf_request.data)
        serializer.is_valid(raise_exception=True)
        view.perform_create(serializer)

        assert serializer.instance.owner == user


@pytest.mark.django_db()
class TestVisualizationViewSet:
    @pytest.fixture()
    def api_rf(self) -> APIRequestFactory:
        return APIRequestFactory()

    @pytest.fixture()
    def user(self) -> User:
        password = "testpass123"
        return User.objects.create_user(
            username="testuser", email="test@example.com", password=password
        )

    @pytest.fixture()
    def visualization(self, user: User) -> Visualization:
        return Visualization.objects.create(
            owner=user,
            type="spectrogram",
            capture_type="sigmf",
            capture_source="local",
            capture_ids=["123e4567-e89b-12d3-a456-426614174000"],
        )

    def test_get_queryset(
        self, user: User, visualization: Visualization, api_rf: APIRequestFactory
    ):
        """Test that get_queryset returns only visualizations owned by the user."""
        view = VisualizationViewSet()
        request = api_rf.get("/fake-url/")
        request.user = user
        view.request = request

        queryset = view.get_queryset()

        assert visualization in queryset
        assert queryset.count() == 1

    def test_get_serializer_class(self, user: User, api_rf: APIRequestFactory):
        """Test that the correct serializer class is returned based on action and query params."""
        view = VisualizationViewSet()
        view.action = "list"

        # Test with detailed=false
        request = api_rf.get("/fake-url/")
        request.user = user
        drf_request = Request(request)
        view.request = drf_request
        serializer_class = view.get_serializer_class()
        assert serializer_class.__name__ == "VisualizationListSerializer"

        # Test with detailed=true
        request = api_rf.get("/fake-url/", {"detailed": "true"})
        request.user = user
        drf_request = Request(request)
        view.request = drf_request
        serializer_class = view.get_serializer_class()
        assert serializer_class.__name__ == "VisualizationDetailSerializer"


@pytest.mark.django_db()
class TestCaptureList:
    @pytest.fixture()
    def api_rf(self) -> APIRequestFactory:
        return APIRequestFactory()

    @pytest.fixture()
    def user(self) -> User:
        password = "testpass123"
        return User.objects.create_user(
            username="testuser", email="test@example.com", password=password
        )

    def test_capture_list(self, user: User, api_rf: APIRequestFactory):
        """Test the capture_list view function."""
        request = api_rf.get("/fake-url/")
        request.user = user

        response = capture_list(request)

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
