from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from spectrumx_visualization_platform.spx_vis.api.views import CaptureViewSet
from spectrumx_visualization_platform.spx_vis.api.views import FileViewSet
from spectrumx_visualization_platform.spx_vis.api.views import IntegratedViewSet
from spectrumx_visualization_platform.spx_vis.api.views import SigMFFilePairViewSet
from spectrumx_visualization_platform.users.api.views import UserViewSet

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register("users", UserViewSet)
router.register("sigmf-file-pairs", SigMFFilePairViewSet)
router.register("files", FileViewSet)
router.register("captures", CaptureViewSet)
router.register(
    "integratedview",
    IntegratedViewSet,
)  # route added for the integrated table

app_name = "api"
urlpatterns = router.urls
