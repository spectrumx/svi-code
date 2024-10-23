from django.urls import path
from rest_framework.urlpatterns import format_suffix_patterns
from . import views
from django.views.decorators.csrf import csrf_exempt


urlpatterns = [
    # ... existing url patterns ...
    path('submit-job/', views.submit_job, name='submit_job'),

    # update status of job
    path('update-job-status/<int:job_id>/', csrf_exempt(views.update_job_status), name='update_job_status'),
]

urlpatterns = format_suffix_patterns(urlpatterns)

