"""
Django management command to clean up stale jobs.

This command identifies and marks jobs as failed if they have been running
for too long without any status updates, indicating they may have been
abandoned due to worker death or other issues.
"""

import logging
from datetime import timedelta
from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone
from rest_framework.authtoken.models import Token

from jobs.models import Job
from jobs.models import JobStatusUpdate

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """Clean up stale jobs that have been running too long."""

    help = "Clean up stale jobs that have been running too long"

    def add_arguments(self, parser: Any) -> None:
        """Add command line arguments."""
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without actually doing it",
        )
        parser.add_argument(
            "--timeout-hours",
            type=int,
            default=1,
            help="Number of hours after which a job is considered stale (default: 1)",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        """Execute the command."""
        dry_run = options["dry_run"]
        timeout_hours = options["timeout_hours"]

        # Calculate the cutoff time
        cutoff_time = timezone.now() - timedelta(hours=timeout_hours)

        # Find jobs that have been running for too long
        stale_jobs = Job.objects.filter(
            status__in=["running", "submitted"], created_at__lt=cutoff_time
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Found {stale_jobs.count()} stale jobs older than {timeout_hours} hour(s)"
            )
        )

        if dry_run:
            self.stdout.write("DRY RUN - No changes will be made")

        for job in stale_jobs:
            self.stdout.write(
                f"Job {job.id} (status: {job.status}, created: {job.created_at})"
            )

            if not dry_run:
                try:
                    # Get or create a token for the job owner
                    token, _ = Token.objects.get_or_create(user=job.owner)

                    # Mark job as failed
                    job.status = "failed"
                    job.save()

                    # Create status update
                    JobStatusUpdate.objects.create(
                        job=job,
                        status="failed",
                        info={
                            "reason": "Job marked as stale by cleanup command",
                            "timeout_hours": timeout_hours,
                            "cutoff_time": cutoff_time.isoformat(),
                        },
                    )

                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ Marked job {job.id} as failed")
                    )

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"  ✗ Failed to update job {job.id}: {e}")
                    )
                    logger.error(f"Failed to update stale job {job.id}: {e}")

        if not dry_run:
            self.stdout.write(self.style.SUCCESS("Stale job cleanup completed"))
        else:
            self.stdout.write(self.style.WARNING("Dry run completed - no changes made"))
