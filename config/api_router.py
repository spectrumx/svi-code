from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from spectrumx_visualization_platform.spx_vis.api.views import SigMFFilePairViewSet
from spectrumx_visualization_platform.users.api.views import UserViewSet

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register("users", UserViewSet)
router.register("sigmf-file-pairs", SigMFFilePairViewSet)


app_name = "api"
urlpatterns = router.urls
