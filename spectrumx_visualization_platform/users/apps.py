import contextlib

from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class UsersConfig(AppConfig):
    name = "spectrumx_visualization_platform.users"
    verbose_name = _("Users")

    def ready(self):
        with contextlib.suppress(ImportError):
            import spectrumx_visualization_platform.users.signals  # noqa: F401
