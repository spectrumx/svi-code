"""File storage models."""

from enum import StrEnum

from django.db import models
from django.db.models.constraints import UniqueConstraint


class CaptureType(StrEnum):
    DigitalRF = "drf"
    RadioHound = "rh"
    SigMF = "sigmf"


class CaptureSource(StrEnum):
    SDS = "sds"
    SVI_Public = "svi_public"
    SVI_User = "svi_user"


class Capture(models.Model):
    """A collection of related RF files."""

    CAPTURE_TYPE_CHOICES = [
        (CaptureType.DigitalRF, "Digital RF"),
        (CaptureType.RadioHound, "RadioHound"),
        (CaptureType.SigMF, "SigMF"),
    ]
    CAPTURE_SOURCE_CHOICES = [
        (CaptureSource.SDS, "SDS"),
        (CaptureSource.SVI_Public, "SVI Public"),
        (CaptureSource.SVI_User, "SVI User"),
    ]

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
    expiration_date = models.DateTimeField(null=True)
    media_type = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    updated_at = models.DateTimeField(auto_now=True)
    local_path = models.CharField(max_length=255, blank=True)
    capture = models.ForeignKey(
        Capture,
        on_delete=models.CASCADE,
        related_name="files",
        null=True,
    )

    class Meta:
        constraints = [
            UniqueConstraint(fields=["owner", "name"], name="unique_filename_for_user"),
        ]

    def __str__(self) -> str:
        return self.name


class SigMFFilePair(models.Model):
    """A pair of files in the SigMF format.

    Attributes:
        data_file:          The data file in the pair.
        meta_file:          The metadata file in the pair.
    """

    data_file = models.ForeignKey(
        File,
        on_delete=models.CASCADE,
        related_name="data_file",
    )
    meta_file = models.ForeignKey(
        File,
        on_delete=models.CASCADE,
        related_name="meta_file",
    )

    def __str__(self) -> str:
        return self.data_file.name.split(".")[0]


# class Dataset(models.Model):
#     """A collection of files."""

#     # TODO: Implement this model.


__all__ = [
    "File",
    "SigMFFilePair",
    "Capture",
]
