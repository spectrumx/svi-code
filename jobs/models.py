from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class JobSubmissionConnection(models.Model):
    PROTOCOL_CHOICES = [
        ("redis", "REDIS"),
        ("amqp", "AMQP"),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    protocol = models.CharField(max_length=255, choices=PROTOCOL_CHOICES)
    host = models.CharField(max_length=255)
    port = models.IntegerField()
    password = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.protocol}://:*****@{self.host}:{self.port}"

    @property
    def broker_connection(self):
        return f"{self.protocol}://:{self.password}@{self.host}:{self.port}"


class Job(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("submitted", "Submitted"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]
    type = models.CharField(max_length=255)
    status = models.CharField(max_length=255, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    submission_connection = models.ForeignKey(
        JobSubmissionConnection,
        on_delete=models.SET_NULL,
        null=True,
    )

    def __str__(self):
        return f"{self.type} - {self.status}"

    def files(self):
        return JobLocalFile.objects.filter(job=self)


class JobStatusUpdate(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE)
    status = models.CharField(max_length=255, choices=Job.STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    info = models.TextField(blank=True)

    def __str__(self):
        return f"{self.job.type} - {self.status}"

    def save(self, *args, **kwargs):
        self.job.status = self.status
        self.job.save()
        super().save(*args, **kwargs)


class JobLocalFile(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE)
    file = models.FileField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.file.name


class JobRemoteFile(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE)
    file = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.file


class JobData(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE)
    file = models.FileField(blank=True, null=True)
    data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        name = f"{self.job.id}: {self.job.type}"
        if self.file:
            name += f" {self.file.name}"
        if self.data:
            name += " JSON"
        return name
