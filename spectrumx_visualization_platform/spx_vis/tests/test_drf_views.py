from datetime import UTC
from datetime import datetime
from datetime import timedelta
from pathlib import Path
from unittest.mock import MagicMock
from unittest.mock import patch

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
    def sigmf_files(self) -> tuple[SimpleUploadedFile, SimpleUploadedFile]:
        """Load SigMF files from fixtures."""
        sigmf_dir = Path(__file__).parent / "fixtures" / "sigmf"
        data_path = sigmf_dir / "sample.sigmf-data"
        meta_path = sigmf_dir / "sample.sigmf-meta"

        with open(data_path, "rb") as f1, open(meta_path, "rb") as f2:
            return (
                SimpleUploadedFile(
                    "sample.sigmf-data",
                    f1.read(),
                    content_type="application/octet-stream",
                ),
                SimpleUploadedFile(
                    "sample.sigmf-meta", f2.read(), content_type="application/json"
                ),
            )

    @pytest.fixture()
    def capture(
        self,
        user: User,
        sigmf_files: tuple[SimpleUploadedFile, SimpleUploadedFile],
    ) -> Capture:
        """Create a capture with SigMF files."""
        capture = Capture.objects.create(owner=user, name="Test Capture", type="sigmf")

        data_file, meta_file = sigmf_files

        # Create data file
        File.objects.create(
            owner=user,
            name="sample.sigmf-data",
            media_type="application/octet-stream",
            file=data_file,
            capture=capture,
        )

        # Create metadata file
        File.objects.create(
            owner=user,
            name="sample.sigmf-meta",
            media_type="application/json",
            file=meta_file,
            capture=capture,
        )

        return capture

    @pytest.mark.skip(reason="Local captures are currently deprioritized")
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
    def radiohound_files(self) -> list[SimpleUploadedFile]:
        """Load all Radiohound files from fixtures directory."""
        radiohound_dir = Path(__file__).parent / "fixtures" / "radiohound"
        files = []

        for file_path in radiohound_dir.glob("*.rh.json"):
            with open(file_path, "rb") as f:
                files.append(
                    SimpleUploadedFile(
                        file_path.name, f.read(), content_type="application/json"
                    )
                )

        return files

    @pytest.fixture()
    def sigmf_files(self) -> tuple[SimpleUploadedFile, SimpleUploadedFile]:
        """Load SigMF files from fixtures."""
        sigmf_dir = Path(__file__).parent / "fixtures" / "sigmf"
        data_path = sigmf_dir / "sample.sigmf-data"
        meta_path = sigmf_dir / "sample.sigmf-meta"

        with open(data_path, "rb") as f1, open(meta_path, "rb") as f2:
            return (
                SimpleUploadedFile(
                    "sample.sigmf-data",
                    f1.read(),
                    content_type="application/octet-stream",
                ),
                SimpleUploadedFile(
                    "sample.sigmf-meta", f2.read(), content_type="application/json"
                ),
            )

    @pytest.fixture()
    def capture(
        self,
        user: User,
        radiohound_files: list[SimpleUploadedFile],
    ) -> Capture:
        """Create a capture with Radiohound files."""
        capture = Capture.objects.create(
            owner=user,
            name="Test Radiohound Capture",
            type="rh",
            source="svi_user",
        )

        # Create a File object for each Radiohound file
        for uploaded_file in radiohound_files:
            File.objects.create(
                owner=user,
                name=uploaded_file.name,
                media_type="application/json",
                file=uploaded_file,
                capture=capture,
            )

        return capture

    @pytest.fixture()
    def sigmf_capture(
        self,
        user: User,
        sigmf_files: tuple[SimpleUploadedFile, SimpleUploadedFile],
    ) -> Capture:
        """Create a capture with SigMF files."""
        capture = Capture.objects.create(
            owner=user, name="Test SigMF Capture", type="sigmf"
        )

        data_file, meta_file = sigmf_files

        # Create data file
        File.objects.create(
            owner=user,
            name="sample.sigmf-data",
            media_type="application/octet-stream",
            file=data_file,
            capture=capture,
        )

        # Create metadata file
        File.objects.create(
            owner=user,
            name="sample.sigmf-meta",
            media_type="application/json",
            file=meta_file,
            capture=capture,
        )

        return capture

    @pytest.fixture()
    def unsaved_visualization(self, user: User, capture: Capture) -> Visualization:
        return Visualization.objects.create(
            owner=user,
            name="Test Visualization",
            type="waterfall",
            capture_type="rh",
            capture_source="sds",
            capture_ids=[str(capture.uuid)],
            is_saved=False,
            expiration_date=datetime.now(UTC) + timedelta(hours=1),
        )

    @pytest.fixture()
    def saved_visualization(self, user: User, capture: Capture) -> Visualization:
        return Visualization.objects.create(
            owner=user,
            name="Test Saved Visualization",
            type="waterfall",
            capture_type="rh",
            capture_source="sds",
            capture_ids=[str(capture.uuid)],
            is_saved=True,
            expiration_date=None,
        )

    @pytest.fixture()
    def spectrogram_visualization(
        self,
        user: User,
        sigmf_capture: Capture,
    ) -> Visualization:
        """Create a visualization with a SigMF capture for spectrogram testing."""
        return Visualization.objects.create(
            owner=user,
            name="Test Spectrogram Visualization",
            type="spectrogram",
            capture_ids=[str(sigmf_capture.uuid)],
            capture_type="sigmf",
            capture_source="sds",
            is_saved=True,
        )

    def test_get_queryset(
        self, user: User, saved_visualization: Visualization, api_rf: APIRequestFactory
    ):
        """Test that get_queryset returns only visualizations owned by the user."""
        view = VisualizationViewSet()
        request = api_rf.get("/fake-url/")
        request.user = user
        view.request = request
        view.action = "list"

        queryset = view.get_queryset()

        assert saved_visualization in queryset
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

    # Failing
    @pytest.mark.skip(reason="Mocking get_sds_captures isn't working")
    def test_save_visualization(
        self,
        user: User,
        unsaved_visualization: Visualization,
        api_rf: APIRequestFactory,
    ):
        with patch(
            "spectrumx_visualization_platform.spx_vis.api.views.get_sds_captures"
        ) as mock_get_sds_captures:
            mock_get_sds_captures.return_value = (
                [
                    {
                        "uuid": unsaved_visualization.capture_ids[0],
                        "capture_type": "rh",
                        "capture_source": "sds",
                    }
                ],
                [],
            )

            """Test that an unsaved visualization can be saved via the save endpoint."""
            view = VisualizationViewSet()
            request = api_rf.post(f"/fake-url/{unsaved_visualization.uuid}/save/")
            force_authenticate(request, user=user)
            drf_request = Request(request)
            drf_request.parsers = [JSONParser()]
            view.request = drf_request
            view.kwargs = {"uuid": str(unsaved_visualization.uuid)}
            view.action = "post"
            view.format_kwarg = None

            response = view.save(drf_request, uuid=str(unsaved_visualization.uuid))

            # Verify response
            assert response.status_code == status.HTTP_200_OK
            assert response.data["is_saved"] is True
            assert response.data["expiration_date"] is None

            # Verify database state
            unsaved_visualization.refresh_from_db()
            assert unsaved_visualization.is_saved is True
            assert unsaved_visualization.expiration_date is None

    @pytest.mark.skip(reason="Need to mock Digital RF capture instead")
    def test_create_spectrogram_success(
        self,
        user: User,
        spectrogram_visualization: Visualization,
        api_rf: APIRequestFactory,
    ):
        """Test successful spectrogram creation request."""
        with (
            patch("redis.Redis") as mock_redis,
            patch(
                "spectrumx_visualization_platform.spx_vis.capture_utils.sigmf.request_job_submission"
            ) as mock_job_submission,
            patch(
                "spectrumx_visualization_platform.spx_vis.api.views.get_sds_captures"
            ) as mock_get_sds_captures,
        ):
            # Configure mock Redis instance
            mock_redis_instance = mock_redis.return_value
            mock_redis_instance.ping.return_value = True

            # Configure mock job submission
            mock_job = MagicMock()
            mock_job.id = "test-job-id"
            mock_job_submission.return_value = mock_job

            # Configure mock SDS captures
            mock_get_sds_captures.return_value = [
                {
                    "uuid": spectrogram_visualization.capture_ids[0],
                    "files": [
                        {
                            "uuid": "test-file-uuid",
                            "name": "test.sigmf-data",
                        }
                    ],
                }
            ]

            view = VisualizationViewSet()
            request = api_rf.post(
                f"/fake-url/{spectrogram_visualization.uuid}/create_spectrogram/",
                {"width": 10, "height": 10},
                format="json",
            )
            force_authenticate(request, user=user)
            drf_request = Request(request)
            drf_request.parsers = [JSONParser()]
            view.request = drf_request
            view.kwargs = {"uuid": str(spectrogram_visualization.uuid)}
            view.action = "post"

            response = view.create_spectrogram(
                drf_request, uuid=str(spectrogram_visualization.uuid)
            )

            assert response.status_code == status.HTTP_201_CREATED
            assert "job_id" in response.data
            assert response.data["status"] == "submitted"
            assert response.data["job_id"] == "test-job-id"

            # Verify job submission was called with correct arguments
            mock_job_submission.assert_called_once()
            call_args = mock_job_submission.call_args[1]
            assert call_args["visualization_type"] == "spectrogram"
            assert call_args["owner"] == user
            assert call_args["config"] == {"width": 10, "height": 10}

    def test_create_spectrogram_invalid_type(
        self,
        user: User,
        spectrogram_visualization: Visualization,
        api_rf: APIRequestFactory,
    ):
        """Test spectrogram creation with invalid capture type."""
        spectrogram_visualization.capture_type = "invalid"
        spectrogram_visualization.save()

        view = VisualizationViewSet()
        request = api_rf.post(
            f"/fake-url/{spectrogram_visualization.uuid}/create_spectrogram/",
            {"width": 10, "height": 10},
            format="json",
        )
        force_authenticate(request, user=user)
        drf_request = Request(request)
        drf_request.parsers = [JSONParser()]
        view.request = drf_request
        view.kwargs = {"uuid": str(spectrogram_visualization.uuid)}
        view.action = "post"

        response = view.create_spectrogram(
            drf_request, uuid=str(spectrogram_visualization.uuid)
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["status"] == "error"


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

    @pytest.mark.skip(reason="Not currently testing anything meaningful")
    def test_capture_list(self, user: User, api_rf: APIRequestFactory):
        """Test the capture_list view function."""
        request = api_rf.get("/fake-url/")
        request.user = user

        response = capture_list(request)

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, dict)
        assert "captures" in response.data
        assert isinstance(response.data["captures"], list)
        assert len(response.data["captures"]) == 0
        assert "error" not in response.data
