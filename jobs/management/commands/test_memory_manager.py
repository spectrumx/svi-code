import time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from rest_framework.authtoken.models import Token

from jobs.memory_manager import memory_manager
from jobs.tasks import submit_job

User = get_user_model()


class Command(BaseCommand):
    help = "Test the memory manager's ability to terminate jobs"

    def add_arguments(self, parser):
        parser.add_argument(
            "--action",
            choices=["register", "terminate", "monitor", "test-termination"],
            default="test-termination",
            help="Action to perform",
        )
        parser.add_argument("--job-id", type=int, help="Job ID to operate on")
        parser.add_argument("--task-id", type=str, help="Task ID to operate on")

    def handle(self, *args, **options):
        action = options["action"]

        if action == "register":
            self._test_register_job(options)
        elif action == "terminate":
            self._test_terminate_job(options)
        elif action == "monitor":
            self._test_monitor(options)
        elif action == "test-termination":
            self._test_job_termination(options)

    def _test_register_job(self, options):
        """Test registering a job with the memory manager."""
        job_id = options.get("job_id", 999)
        task_id = options.get("task_id", "test-task-id")

        self.stdout.write(f"Registering job {job_id} with task_id {task_id}")
        memory_manager.register_job(job_id, estimated_memory_mb=1000, task_id=task_id)

        active_jobs = memory_manager.get_active_jobs_info()
        self.stdout.write(f"Active jobs: {active_jobs}")

    def _test_terminate_job(self, options):
        """Test terminating a specific job."""
        job_id = options.get("job_id")
        if not job_id:
            self.stdout.write(
                self.style.ERROR("--job-id is required for terminate action")
            )
            return

        self.stdout.write(f"Terminating job {job_id}")
        success = memory_manager.terminate_job(job_id, reason="test_termination")

        if success:
            self.stdout.write(
                self.style.SUCCESS(f"Job {job_id} terminated successfully")
            )
        else:
            self.stdout.write(self.style.ERROR(f"Failed to terminate job {job_id}"))

    def _test_monitor(self, options):
        """Test the memory monitor."""
        self.stdout.write("Starting memory monitor for 30 seconds...")
        memory_manager.start_global_memory_monitor(
            memory_threshold=50.0
        )  # Low threshold for testing

        try:
            time.sleep(30)
        except KeyboardInterrupt:
            self.stdout.write("Interrupted by user")
        finally:
            memory_manager.stop_global_memory_monitor()
            self.stdout.write("Memory monitor stopped")

    def _test_job_termination(self, options):
        """Test creating and terminating a real job."""
        # Create a test user if needed
        user, created = User.objects.get_or_create(
            username="test_memory_manager", defaults={"email": "test@example.com"}
        )

        if created:
            self.stdout.write(f"Created test user: {user.username}")

        # Create a token
        token, _ = Token.objects.get_or_create(user=user)

        # Create a test job
        from jobs.models import Job

        job = Job.objects.create(
            type="spectrogram", owner=user, config={"test": True}, status="submitted"
        )

        self.stdout.write(f"Created test job {job.id}")

        # Submit the job to get a real task ID
        try:
            # This will create a real Celery task
            result = submit_job.delay(job.id, token.key, {"test": True})
            task_id = result.id

            self.stdout.write(f"Submitted job {job.id} with task_id {task_id}")

            # Register with memory manager
            memory_manager.register_job(
                job.id, estimated_memory_mb=1000, task_id=task_id
            )

            # Wait a moment for the task to start
            time.sleep(2)

            # Check if job is registered
            active_jobs = memory_manager.get_active_jobs_info()
            self.stdout.write(f"Active jobs after registration: {active_jobs}")

            # Test termination
            self.stdout.write(f"Testing termination of job {job.id}...")
            success = memory_manager.terminate_job(job.id, reason="test_termination")

            if success:
                self.stdout.write(
                    self.style.SUCCESS(f"Job {job.id} terminated successfully")
                )
            else:
                self.stdout.write(self.style.ERROR(f"Failed to terminate job {job.id}"))

            # Check active jobs after termination
            active_jobs = memory_manager.get_active_jobs_info()
            self.stdout.write(f"Active jobs after termination: {active_jobs}")

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error during test: {e}"))
        finally:
            # Clean up
            try:
                job.delete()
                if created:
                    user.delete()
            except Exception as e:
                self.stdout.write(f"Warning: Could not clean up test data: {e}")
