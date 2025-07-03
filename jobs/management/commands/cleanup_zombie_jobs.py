from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from jobs.models import Job
from jobs.models import JobStatusUpdate
from jobs.views import detect_zombie_job


class Command(BaseCommand):
    help = "Check for and clean up zombie jobs (jobs that appear running but aren't on workers)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without actually making changes",
        )
        parser.add_argument(
            "--min-age-minutes",
            type=int,
            default=5,
            help="Minimum age in minutes for a job to be considered a zombie (default: 5)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        min_age_minutes = options["min_age_minutes"]

        # Calculate cutoff time
        cutoff_time = timezone.now() - timedelta(minutes=min_age_minutes)

        # Find jobs that appear to be running and are old enough to be zombies
        potential_zombies = Job.objects.filter(
            status__in=["running", "submitted"], created_at__lt=cutoff_time
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Found {potential_zombies.count()} jobs that might be zombies "
                f"(status: running/submitted, created before {cutoff_time})"
            )
        )

        zombie_count = 0
        for job in potential_zombies:
            if detect_zombie_job(job):
                zombie_count += 1
                self.stdout.write(
                    f"  Job {job.id}: Zombie detected (status: {job.status}, "
                    f"created: {job.created_at})"
                )

                if not dry_run:
                    # Mark the job as failed
                    job.status = "failed"
                    job.save()

                    # Create a status update for the zombie detection
                    JobStatusUpdate.objects.create(
                        job=job,
                        status="failed",
                        info={
                            "reason": "Job detected as zombie by cleanup command",
                            "detected_at": timezone.now().isoformat(),
                            "previous_status": job.status,
                            "min_age_minutes": min_age_minutes,
                        },
                    )

                    self.stdout.write(
                        self.style.SUCCESS(f"    -> Marked job {job.id} as failed")
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(f"    -> Would mark job {job.id} as failed")
                    )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"\nDRY RUN: Would clean up {zombie_count} zombie jobs"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"\nCleaned up {zombie_count} zombie jobs")
            )
