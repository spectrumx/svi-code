from rest_framework import serializers

from .models import JobStatusUpdate


class JobStatusUpdateSerializer(serializers.ModelSerializer):
    info = serializers.JSONField(required=False)

    class Meta:
        model = JobStatusUpdate
        fields = ["job", "status", "info", "created_at"]
        read_only_fields = ["created_at"]

    def create(self, validated_data):
        job = validated_data["job"]
        status = validated_data["status"]
        info = validated_data.get("info", {})
        return JobStatusUpdate.objects.create(job=job, status=status, info=info)
