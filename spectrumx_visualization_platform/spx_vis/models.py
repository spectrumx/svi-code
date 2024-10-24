"""File storage models."""

from django.core.validators import FileExtensionValidator
from django.db import models


class SigMFFilePair(models.Model):
    """A pair of files in the SigMF format.

    Attributes:
        data_file:          The data file in the pair.
        meta_file:          The metadata file in the pair.
    """

    data_file = models.FileField(
        validators=[FileExtensionValidator(allowed_extensions=["sigmf-data"])],
    )
    meta_file = models.FileField(
        validators=[FileExtensionValidator(allowed_extensions=["sigmf-meta"])],
    )

    def __str__(self) -> str:
        return self.data_file.name.split(".")[0]


# class Dataset(models.Model):
#     """A collection of files."""

#     # TODO: Implement this model.


# class Capture(models.Model):
#     """A collection of related RF files."""

#     # TODO: Implement this model.


__all__ = [
    "SigMFFilePair",
]
