# Register your models here.
from django.contrib import admin

from .models import Capture
from .models import File
from .models import Visualization


@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at", "media_type", "updated_at", "owner")
    search_fields = ("name", "owner")
    list_filter = ("created_at", "updated_at", "owner")


@admin.register(Capture)
class CaptureAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "created_at", "timestamp", "type", "source")


@admin.register(Visualization)
class VisualizationAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "created_at", "updated_at", "type", "capture_ids")
    search_fields = ("id", "owner")
    list_filter = ("created_at", "updated_at", "owner")
