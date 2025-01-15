# Register your models here.
from django.contrib import admin

from .models import File
from .models import SigMFFilePair
from .models import Capture
from .models import CaptureDatasetIntegrated


@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at", "media_type", "updated_at", "owner")
    search_fields = ("name", "owner")
    list_filter = ("created_at", "updated_at", "owner")


@admin.register(SigMFFilePair)
class SigMFFilePairAdmin(admin.ModelAdmin):
    pass
    # list_display = ("name",)
    # search_fields = ("name",)
    # list_filter = ("created_at", "updated_at", "user")

@admin.register(Capture)
class CaptureAdmin(admin.ModelAdmin):
    list_display = ("capturename","file_path","timestamp","frequency","location")

# integrated model registered
@admin.register(CaptureDatasetIntegrated)
class CaptureDatasetIntegratedAdmin(admin.ModelAdmin):
    list_display = ("id","file_name","timestamp","frequency","location","source","captureformat")


