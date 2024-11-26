from rest_framework import serializers

from .models import JobStatusUpdate


class JobStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobStatusUpdate
        fields = ["job", "status", "created_at"]
        read_only_fields = ["created_at"]

    def create(self, validated_data):
        job = validated_data["job"]
        status = validated_data["status"]
        return JobStatusUpdate.objects.create(job=job, status=status)
