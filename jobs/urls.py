from django.urls import path
from rest_framework.urlpatterns import format_suffix_patterns

from . import views

urlpatterns = [
    # ... existing url patterns ...
    path("submit-job/", views.submit_job, name="submit_job"),
    # update status of job
    path(
        "update-job-status/",
        views.create_job_status_update,
        name="update_job_status",
    ),
    # get job info
    path("job-metadata/<int:job_id>/", views.get_job_metadata, name="get_job_meta"),
    # get job file
    path("job-file/<int:file_id>", views.get_job_file, name="get_job_file"),
    # get job data
    path("job-data/<int:job_data_id>", views.get_job_data, name="get_job_data"),
    # save job data
    path("save-job-data/<int:job_id>/", views.save_job_data, name="save_job_data"),
    # test the connection
    path(
        "test-connection/<int:connection_id>/",
        views.test_connection,
        name="test-connection",
    ),
]

urlpatterns = format_suffix_patterns(urlpatterns)
