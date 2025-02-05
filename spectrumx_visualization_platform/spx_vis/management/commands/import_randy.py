import json
import logging
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand
from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from spectrumx_visualization_platform.spx_vis.models import Capture
from spectrumx_visualization_platform.spx_vis.models import File
from spectrumx_visualization_platform.users.models import User

# Configure logging
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    Django management command to import RadioHound JSON files from a directory.

    This command scans the specified directory for JSON files and imports them
    as RadioHound data entries in the database. It handles errors gracefully
    and provides detailed feedback about the import process.
    """

    help = "Import RadioHound JSON files from a specified directory"

    def add_arguments(self, parser: Any) -> None:
        """
        Add command line arguments.

        Args:
            parser: ArgumentParser instance
        """
        parser.add_argument(
            "--directory",
            "-d",
            action="store",
            type=str,
            default="data/",
            help="Directory containing RadioHound JSON files",
        )
        parser.add_argument(
            "--recursive",
            "-r",
            action="store_true",
            help="Recursively search for JSON files in subdirectories",
        )
        parser.add_argument(
            "--owner",
            "-o",
            action="store",
            type=str,
            required=True,
            help="Username of the owner for imported files",
        )
        parser.add_argument(
            "--limit",
            "-l",
            action="store",
            type=int,
            default=None,
            help="Limit the number of files to import",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        """
        Handle the command execution.

        Args:
            *args: Variable length argument list
            **options: Arbitrary keyword arguments including 'directory' path

        Raises:
            CommandError: If the directory doesn't exist or other errors occur
        """
        directory_path = Path(options["directory"])
        is_recursive = options.get("recursive", False)

        if not directory_path.exists():
            raise CommandError(f"Directory '{directory_path}' does not exist")

        if not directory_path.is_dir():
            raise CommandError(f"'{directory_path}' is not a directory")

        try:
            self.process_directory(directory_path, is_recursive, options)
        except Exception as e:
            logger.error(f"Failed to process directory: {e!s}", exc_info=True)
            raise CommandError(f"Import failed: {e!s}")

    def process_directory(
        self, directory: Path, recursive: bool, options: dict
    ) -> None:
        """
        Process all JSON files in the given directory.

        Args:
            directory: Path object pointing to the directory to process
            recursive: Boolean indicating whether to process subdirectories
            options: Command line options dictionary
        """
        pattern = "**/*.json" if recursive else "*.json"
        files_processed = 0
        files_failed = 0

        for json_file in directory.glob(pattern):
            if options.get("limit") and files_processed >= options["limit"]:
                break
            try:
                self.import_json_file(json_file, options)
                files_processed += 1
            except Exception as e:
                files_failed += 1
                logger.error(f"Failed to import {json_file}: {e!s}", exc_info=True)
                self.stdout.write(
                    self.style.ERROR(f"Failed to import {json_file}: {e!s}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nImport completed: {files_processed} files processed, "
                f"{files_failed} files failed"
            )
        )

    def import_json_file(self, file_path: Path, options: dict) -> None:
        """
        Import a single RadioHound JSON file into the database.

        Args:
            file_path: Path object pointing to the JSON file
            options: Command line options dictionary
        """
        try:
            # get the owner from the command line arguments
            owner = options.get("owner")

            # get the user from the database
            try:
                user = User.objects.get(username=owner)
            except User.DoesNotExist:
                raise CommandError(f"User '{owner}' does not exist")

            # Use transaction to ensure database consistency
            with transaction.atomic():
                # create a capture object
                capture = Capture.objects.create(
                    name=file_path.name,
                    type="rh",
                    source="svi_user",
                    owner=user,
                    timestamp=timezone.now(),
                )

                # create a file object using Django's File wrapper
                from django.core.files import File as DjangoFile

                with open(file_path, "rb") as f:
                    File.objects.create(
                        capture=capture,
                        name=file_path.name,
                        media_type="application/json",
                        file=DjangoFile(f),
                        owner=user,
                    )

        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {e!s}")
        except Exception as e:
            raise ValueError(f"Error processing file: {e!s}")
