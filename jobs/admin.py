from django.contrib import admin

# Register your models here.
from .models import Job
from .models import JobData
from .models import JobLocalFile
from .models import JobRemoteFile
from .models import JobStatusUpdate
from .models import JobSubmissionConnection

admin.site.register(Job)
admin.site.register(JobLocalFile)
admin.site.register(JobRemoteFile)
admin.site.register(JobSubmissionConnection)
admin.site.register(JobStatusUpdate)
admin.site.register(JobData)
