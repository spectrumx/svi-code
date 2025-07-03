import os

from celery import Celery

# set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

app = Celery("spectrumx_visualization_platform")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()

# Configure periodic tasks
app.conf.beat_schedule = {
    "cleanup-stale-jobs": {
        "task": "jobs.tasks.cleanup_stale_jobs",
        "schedule": 300.0,  # Run every 5 minutes
    },
    "cleanup-zombie-jobs": {
        "task": "jobs.tasks.cleanup_zombie_jobs",
        "schedule": 120.0,  # Run every 2 minutes
    },
}
