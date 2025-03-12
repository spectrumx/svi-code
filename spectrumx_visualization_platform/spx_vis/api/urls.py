from django.urls import path

from .views import capture_list

app_name = "spx_vis"
urlpatterns = [
    path("captures/list/", capture_list),
]
