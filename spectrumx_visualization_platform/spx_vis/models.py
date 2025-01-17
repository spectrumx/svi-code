"""File storage models."""

from django.core.validators import FileExtensionValidator
from django.db import models
from django.db.models.constraints import UniqueConstraint


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
    """
    
    owner = models.ForeignKey("users.User", on_delete=models.CASCADE)
    file = models.FileField()
    created_at = models.DateTimeField(auto_now_add=True)
    expiration_date = models.DateTimeField(null=True)
    media_type = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    updated_at = models.DateTimeField(auto_now=True)
    local_path = models.CharField(max_length=255, blank=True)

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
        validators=[FileExtensionValidator(allowed_extensions=["sigmf-data"])],
    )
    meta_file = models.ForeignKey(
        File,
        on_delete=models.CASCADE,
        related_name="meta_file",
        validators=[FileExtensionValidator(allowed_extensions=["sigmf-meta"])],
    )

    def __str__(self) -> str:
        return self.data_file.name.split(".")[0]


# class Dataset(models.Model):
#     """A collection of files."""

#     # TODO: Implement this model.

class Capture(models.Model):

#     """A collection of related RF files."""
    captureOwner = models.ForeignKey("users.User", on_delete=models.CASCADE)
    capturename= models.CharField(max_length=255)
    file_path = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    frequency = models.FloatField()
    location = models.CharField(max_length=255, blank=True, null=True)
    
    class Meta:
        constraints = [
            UniqueConstraint(fields=["captureOwner", "capturename"], name="unique_capturefilename_for_user"),
        ]

    def __str__(self) -> str:
        return self.capturename


    

#     """A collection of related RF files."""
# integrated view: combined the SigMFFilePair  and newly created capture
class CaptureDatasetIntegrated(models.Model):

    sigmf_filepair = models.ForeignKey(SigMFFilePair, on_delete=models.CASCADE, related_name = "integrated_sigmf")
    #capture = models.ForeignKey(Capture, on_delete=models.CASCADE, related_name="integrated_captures")
    file_name = models.CharField(max_length=255) 
    timestamp = models.DateTimeField(auto_now_add=True)
    frequency = models.FloatField()
    location = models.CharField(max_length=255, blank=True, null=True)
    captureformat =  models.CharField(max_length=255, null=True)
    source = models.CharField(max_length=255, null=True)


    def __str__(self) -> str:
        return self.file_name




__all__ = [
    "File",
    "SigMFFilePair",
    "Capture",
    "CaptureDatasetIntegrated",
]
