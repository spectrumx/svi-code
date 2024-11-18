from django.contrib import admin

# Register your models here.
from .models import Job, JobLocalFile, JobRemoteFile, JobSubmissionConnection, JobStatusUpdate, JobData

admin.site.register(Job)
admin.site.register(JobLocalFile)
admin.site.register(JobRemoteFile)
admin.site.register(JobSubmissionConnection)
admin.site.register(JobStatusUpdate)
admin.site.register(JobData)