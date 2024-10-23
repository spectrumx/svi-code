from django.contrib import admin

# Register your models here.
from .models import Job, JobLocalFile, JobRemoteFile, JobSubmissionConnection

admin.site.register(Job)
admin.site.register(JobLocalFile)
admin.site.register(JobRemoteFile)
admin.site.register(JobSubmissionConnection)