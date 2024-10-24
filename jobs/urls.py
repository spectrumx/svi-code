from django.urls import path
from rest_framework.urlpatterns import format_suffix_patterns
from . import views
from django.views.decorators.csrf import csrf_exempt


urlpatterns = [
    # ... existing url patterns ...
    path('submit-job/', views.submit_job, name='submit_job'),

    # update status of job
    path('update-job-status/', views.create_job_status_update, name='update_job_status'),
    path('test-connection/<int:id>/', views.test_connection, name='test-connection'),
]

urlpatterns = format_suffix_patterns(urlpatterns)

