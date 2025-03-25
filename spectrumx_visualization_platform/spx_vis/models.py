"""File storage models."""

from enum import StrEnum

from django.db import models
from django.db.models.constraints import UniqueConstraint
from django.core.exceptions import ValidationError


class CaptureType(StrEnum):
    DigitalRF = "drf"
    RadioHound = "rh"
    SigMF = "sigmf"


CAPTURE_TYPE_CHOICES = [
    (CaptureType.DigitalRF, "Digital RF"),
    (CaptureType.RadioHound, "RadioHound"),
    (CaptureType.SigMF, "SigMF"),
]


class CaptureSource(StrEnum):
    SDS = "sds"
    SVI_Public = "svi_public"
    SVI_User = "svi_user"


CAPTURE_SOURCE_CHOICES = [
    (CaptureSource.SDS, "SDS"),
    (CaptureSource.SVI_Public, "SVI Public"),
    (CaptureSource.SVI_User, "SVI User"),
]


class Capture(models.Model):
    """A collection of related RF files."""

    owner = models.ForeignKey("users.User", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    timestamp = models.DateTimeField(null=True)
    type = models.CharField(max_length=255, choices=CAPTURE_TYPE_CHOICES)
    source = models.CharField(max_length=255, choices=CAPTURE_SOURCE_CHOICES)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["owner", "name"],
                name="unique_capturename_for_user",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class File(models.Model):
    """A generic file in the SVI.

    Attributes:
        owner:              The user who uploaded the file.
        file:               The file object itself.
        created_at:         The timestamp when the file was created.
        expiration_date:    The date when the file will be marked for deletion from SDS.
        media_type:         The MIME type of the file.
        name:               The user-defined name for this file.
        updated_at:         The timestamp when the file was last updated.
        local_path:         The path to the file on the local filesystem.
        capture:            The capture that this file belongs to, if any.
    """

    owner = models.ForeignKey("users.User", on_delete=models.CASCADE)
    file = models.FileField()
    created_at = models.DateTimeField(auto_now_add=True)
    expiration_date = models.DateTimeField(null=True, blank=True)
    media_type = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    updated_at = models.DateTimeField(auto_now=True)
    local_path = models.CharField(max_length=255, blank=True)
    capture = models.ForeignKey(
        Capture,
        on_delete=models.CASCADE,
        related_name="files",
        null=True,
        blank=True,
    )

    class Meta:
        constraints = [
            UniqueConstraint(fields=["owner", "name"], name="unique_filename_for_user"),
        ]

    def __str__(self) -> str:
        return self.name


class VisualizationType(StrEnum):
    """Types of visualizations supported by the platform."""

    Spectrogram = "spectrogram"
    Waterfall = "waterfall"


VISUALIZATION_TYPE_CHOICES = [
    (VisualizationType.Spectrogram, "Spectrogram"),
    (VisualizationType.Waterfall, "Waterfall"),
]


class Visualization(models.Model):
    """A visualization created by a user from one or more captures.

    This model represents a visualization configuration created through the visualization wizard.
    It can reference captures from various sources (local DB, SDS, etc.) and supports different
    visualization types with type-specific settings.

    Attributes:
        owner: The user who created the visualization
        type: The type of visualization (spectrogram, waterfall)
        capture_ids: List of capture IDs used in this visualization
        file_ids: List of file IDs used by this visualization's captures
        capture_type: The type of captures used (DigitalRF, RadioHound, SigMF)
        capture_source: The source of the captures (SDS, SVI Public, SVI User)
        settings: JSON field for type-specific visualization settings
        created_at: Timestamp when the visualization was created
        updated_at: Timestamp when the visualization was last updated
    """

    owner = models.ForeignKey("users.User", on_delete=models.CASCADE)
    type = models.CharField(max_length=255, choices=VISUALIZATION_TYPE_CHOICES)
    capture_ids = models.JSONField(
        help_text="List of capture IDs used in this visualization"
    )
    file_ids = models.JSONField(
        help_text="List of file IDs used by this visualization's captures"
    )
    capture_type = models.CharField(max_length=255, choices=CAPTURE_TYPE_CHOICES)
    capture_source = models.CharField(max_length=255, choices=CAPTURE_SOURCE_CHOICES)
    settings = models.JSONField(
        default=dict, help_text="Type-specific visualization settings"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.type} visualization by {self.owner} ({len(self.capture_ids)} captures)"


__all__ = [
    "File",
    "Capture",
    "Visualization",
    "CaptureType",
    "CaptureSource",
    "VisualizationType",
]
