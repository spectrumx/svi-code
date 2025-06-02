from datetime import UTC
from datetime import datetime
from datetime import timedelta
from pathlib import Path
from unittest.mock import Mock
from unittest.mock import patch
from uuid import UUID

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import serializers
from rest_framework.test import APIRequestFactory

from spectrumx_visualization_platform.spx_vis.api.serializers import CaptureSerializer
from spectrumx_visualization_platform.spx_vis.api.serializers import (
    VisualizationDetailSerializer,
)
from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import CaptureSource
from spectrumx_visualization_platform.spx_vis.models import CaptureType
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.spx_vis.models import Visualization
from spectrumx_visualization_platform.spx_vis.models import VisualizationType
from spectrumx_visualization_platform.users.models import User


@pytest.mark.django_db()
class TestVisualizationDetailSerializer:
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
    def api_request_factory(self, user: User) -> APIRequestFactory:
        factory = APIRequestFactory()
        request = factory.get("/fake-url")
        request.user = user
        return request

    @pytest.fixture()
    def visualization_detail_serializer(
        self, api_request_factory: APIRequestFactory
    ) -> VisualizationDetailSerializer:
        return VisualizationDetailSerializer(context={"request": api_request_factory})

    @pytest.mark.skip(reason="This method is not needed anymore.")
    def test_migrate_capture_ids_from_integers_to_uuids(
        self, user: User, capture: Capture, api_request_factory: APIRequestFactory
    ):
        # Set up a visualization with integer capture ID instead of UUID
        unsaved_visualization = Visualization.objects.create(
            owner=user,
            name="Test Visualization",
            type="waterfall",
            capture_type="rh",
            capture_source="svi_user",
            capture_ids=[str(capture.uuid)],
            is_saved=False,
            expiration_date=datetime.now(UTC) + timedelta(hours=1),
        )
        visualization = unsaved_visualization
        visualization.capture_ids = [capture.id]
        print(
            "message from test_migrate_capture_ids_from_integers_to_uuids"
        )  # Set integer ID
        print("capture.id is ", capture.id)
        print("visualization.capture_ids are ", visualization.capture_ids)
        visualization.save(update_fields=["capture_ids"])

        # Sanity check: it should be an integer ID in the DB
        assert isinstance(visualization.capture_ids[0], int)

        # Create an instance of the serializer and call the migration method
        serializer = VisualizationDetailSerializer()
        serializer._migrate_capture_ids(visualization)  # noqa: SLF001

        # Fetch updated visualization
        visualization.refresh_from_db()

        # Check that capture_ids has been converted to a UUID string
        assert visualization.capture_ids == [str(capture.uuid)]
        # Optional: also check that it is a valid UUID string
        assert isinstance(UUID(visualization.capture_ids[0]), UUID)

    def test_get_captures_returns_serialized_local_captures(
        self,
        user: User,
        capture: Capture,
        api_request_factory: APIRequestFactory,
        visualization_detail_serializer: VisualizationDetailSerializer,
    ):
        # Arrange
        request = api_request_factory
        serializer = visualization_detail_serializer

        unsaved_visualization = Visualization.objects.create(
            owner=user,
            name="Test Visualization",
            type="waterfall",
            capture_type="rh",
            capture_source="svi_user",
            capture_ids=[str(capture.uuid)],
            is_saved=False,
            expiration_date=datetime.now(UTC) + timedelta(hours=1),
        )
        visualization = unsaved_visualization

        # Act
        result = serializer.get_captures(visualization)

        # Assert
        expected_data = CaptureSerializer(capture, context={"request": request}).data

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0] == expected_data

    @patch("spectrumx_visualization_platform.spx_vis.api.serializers.get_sds_captures")
    def test_get_captures_returns_serialized_sds_captures(
        self,
        mock_get_sds_captures,
        user: User,
        radiohound_files: File,
        api_request_factory: APIRequestFactory,
        visualization_detail_serializer: VisualizationDetailSerializer,
    ):
        # Arrange
        # Fake SDS capture data returned by the mocked function
        fake_uuid_1 = "11111111-1111-1111-1111-111111111111"
        fake_uuid_2 = "22222222-2222-2222-2222-222222222222"

        mock_get_sds_captures.return_value = [
            {
                "uuid": fake_uuid_1,
                "owner": user.uuid,
                "name": "Test SDS Capture 1",
                "files": radiohound_files,
                "timestamp": 0,
                "type": "rh",
                "source": "sds",
            },
            {
                "uuid": fake_uuid_2,
                "owner": user.uuid,
                "name": "Test SDS Capture 2",
                "files": radiohound_files,
                "timestamp": 1,
                "type": "rh",
                "source": "sds",
            },
        ]

        visualization = Visualization.objects.create(
            owner=user,
            name="SDS Visualization",
            type="waterfall",
            capture_type="rh",
            capture_source=CaptureSource.SDS,
            capture_ids=[fake_uuid_2],  # only match this one
            is_saved=True,
        )

        serializer = visualization_detail_serializer

        # Act
        result = serializer.get_captures(visualization)

        # Assert
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["uuid"] == fake_uuid_2
        assert result[0]["name"] == "Test SDS Capture 2"

        request = api_request_factory

        mock_get_sds_captures.assert_called_once_with(request)

    def test_validate_capture_ids_loop(
        self, user: User, api_request_factory: APIRequestFactory
    ):
        test_cases = [
            (
                "notalist",
                True,
                "[ErrorDetail(string='capture_ids must be a list', code='invalid')]",
            ),
            (
                [],
                True,
                "[ErrorDetail(string='capture_ids cannot be empty', code='invalid')]",
            ),
            (
                ["a", "b"],
                True,
                "[ErrorDetail(string='Visualizing multiple captures is not yet supported', code='invalid')]",
            ),
            (
                [123],
                True,
                "[ErrorDetail(string='All capture IDs must be strings', code='invalid')]",
            ),
            (["abc123"], False, None),  # ✅ Valid case
        ]

        request = api_request_factory

        serializer = VisualizationDetailSerializer(context={"request": request})

        for input_value, expect_exception, expected_message in test_cases:
            if expect_exception:
                with pytest.raises(serializers.ValidationError, match=expected_message):
                    serializer.validate_capture_ids(input_value)
            else:
                assert serializer.validate_capture_ids(input_value) == input_value

    def test_validate_valid_data(
        self, user: User, visualization_detail_serializer: VisualizationDetailSerializer
    ):
        serializer = visualization_detail_serializer
        serializer.instance = Mock(
            capture_ids=[1],
            capture_source=CaptureSource.SDS,
            capture_type=CaptureType.SigMF,
        )

        data = {
            "type": VisualizationType.Spectrogram,
            "capture_type": CaptureType.SigMF,
            "capture_ids": [1],
            "capture_source": CaptureSource.SDS,
        }

        # Patch the _check_captures method to avoid triggering DB logic
        with patch.object(serializer, "_check_captures") as mock_check:
            validated = serializer.validate(data)
            mock_check.assert_called_once()
            assert validated == data

    def test_validate_unsupported_capture_type(
        self, user: User, visualization_detail_serializer: VisualizationDetailSerializer
    ):
        serializer = visualization_detail_serializer
        serializer.instance = Mock()

        data = {
            "type": VisualizationType.Spectrogram,
            "capture_type": CaptureType.RadioHound,  # Unsupported for spectrogram
        }

        with pytest.raises(serializers.ValidationError) as exc_info:
            serializer.validate(data)

        assert "Spectrogram visualizations only support" in str(exc_info.value)

    def test_validate_non_sds_source_raises_error(
        self, user: User, visualization_detail_serializer: VisualizationDetailSerializer
    ):
        serializer = visualization_detail_serializer
        serializer.instance = Mock()

        data = {"capture_source": "non_sds_value"}

        with pytest.raises(serializers.ValidationError) as exc_info:
            serializer.validate(data)

        assert "SVI-hosted captures are not currently supported" in str(exc_info.value)

    @staticmethod
    def make_capture(uuid):
        capture = Mock()
        capture.uuid = uuid
        return capture

    @patch("spectrumx_visualization_platform.spx_vis.api.serializers.User.sds_client")
    def test_check_captures_sds_all_found(
        self, user: User, visualization_detail_serializer: VisualizationDetailSerializer
    ):
        serializer = visualization_detail_serializer
        listing_mock = user.sds_client().captures.listing
        listing_mock.return_value = [self.make_capture("abc"), self.make_capture("def")]
        serializer._check_captures(["abc", "def"], "sds", CaptureType.SigMF, user)  # noqa: SLF001
        listing_mock.assert_called_once_with(capture_type=CaptureType.SigMF)

    @patch("spectrumx_visualization_platform.spx_vis.api.serializers.User.sds_client")
    def test_check_captures_sds_some_missing(
        self, user: User, visualization_detail_serializer: VisualizationDetailSerializer
    ):
        serializer = visualization_detail_serializer

        user.sds_client().captures.listing.return_value = [self.make_capture("abc")]

        with pytest.raises(serializers.ValidationError) as exc_info:
            serializer._check_captures(["abc", "xyz"], "sds", CaptureType.SigMF, user)  # noqa: SLF001

        assert "SDS captures of type" in str(exc_info.value)

    @patch(
        "spectrumx_visualization_platform.spx_vis.api.serializers.Capture.objects.filter"
    )
    def test_check_captures_svi_user_all_found(
        self,
        mock_filter,
        user: User,
        visualization_detail_serializer: VisualizationDetailSerializer,
    ):
        serializer = visualization_detail_serializer
        mock_filter.return_value = [self.make_capture("abc"), self.make_capture("def")]

        serializer._check_captures(["abc", "def"], "svi_user", CaptureType.SigMF, user)  # noqa: SLF001
        mock_filter.assert_called_once_with(
            uuid__in=["abc", "def"], owner=user, type=CaptureType.SigMF
        )

    @patch(
        "spectrumx_visualization_platform.spx_vis.api.serializers.Capture.objects.filter"
    )
    def test_check_captures_svi_user_some_missing(
        self,
        mock_filter,
        user: User,
        visualization_detail_serializer: VisualizationDetailSerializer,
    ):
        serializer = visualization_detail_serializer
        mock_filter.return_value = [self.make_capture("abc")]

        with pytest.raises(serializers.ValidationError) as exc_info:
            serializer._check_captures(  # noqa: SLF001
                ["abc", "def"], "svi_user", CaptureType.SigMF, user
            )

        assert "Local captures of type" in str(exc_info.value)

    def test_check_captures_svi_public_raises(
        self, user: User, visualization_detail_serializer: VisualizationDetailSerializer
    ):
        serializer = visualization_detail_serializer

        with pytest.raises(serializers.ValidationError) as exc_info:
            serializer._check_captures(["abc"], "svi_public", CaptureType.SigMF, user)  # noqa: SLF001

        assert "Public SVI captures are not yet implemented" in str(exc_info.value)

    def test_check_captures_invalid_source_raises(
        self, user: User, visualization_detail_serializer: VisualizationDetailSerializer
    ):
        serializer = visualization_detail_serializer

        with pytest.raises(serializers.ValidationError) as exc_info:
            serializer._check_captures(  # noqa: SLF001
                ["abc"], "invalid_source", CaptureType.SigMF, user
            )

        assert "Invalid capture source" in str(exc_info.value)
