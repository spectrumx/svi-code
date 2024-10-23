from django.db import models
from django.contrib.auth import get_user_model
User = get_user_model()
import uuid
class JobSubmissionConnection(models.Model):
    PROTOCOL_CHOICES = [
        ('amqp', 'AMQP'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    protocol = models.CharField(max_length=255, choices=PROTOCOL_CHOICES)
    host = models.CharField(max_length=255)
    port = models.IntegerField()
    username = models.CharField(max_length=255)
    password = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.protocol}://{self.username}:*****@{self.host}:{self.port}"
    
    @property
    def broker_connection(self):
        return f"{self.protocol}://{self.username}:{self.password}@{self.host}:{self.port}"


class Job(models.Model):
    STATUS_CHOICES = [  
        ('pending', 'Pending'),
        ('submitted', 'Submitted'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    type = models.CharField(max_length=255)
    status = models.CharField(max_length=255, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=255, default=uuid.uuid4)
    submission_connection = models.ForeignKey(JobSubmissionConnection, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.type} - {self.status}"
    
    def files(self):
        return JobLocalFile.objects.filter(job=self)

class JobLocalFile(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE)
    file = models.FileField(upload_to='media/')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class JobRemoteFile(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE)
    file = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

