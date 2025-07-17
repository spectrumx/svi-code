import logging
from uuid import uuid4

import requests
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.signals import user_logged_in
from django.db import models
from django.db.models import CharField
from django.dispatch import receiver
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from spectrumx import Client as SDSClient


class User(AbstractUser):
    """
    Default custom user model for SpectrumX Visualization Platform.
    If adding fields that need to be filled at user signup,
    check forms.SignupForm and forms.SocialSignupForms accordingly.
    """

    uuid = models.UUIDField(default=uuid4, unique=True)
    # First and last name do not cover name patterns around the globe
    name = CharField(_("Name of User"), blank=True, max_length=255)
    first_name = None  # type: ignore[assignment]
    last_name = None  # type: ignore[assignment]
    api_token = CharField(max_length=255, blank=True, null=True)
    sds_token = CharField(max_length=255, blank=True, null=True)

    def get_absolute_url(self) -> str:
        """Get URL for user's detail view.

        Returns:
            str: URL for user detail.

        """
        return reverse("users:detail", kwargs={"username": self.username})

    def __str__(self) -> str:
        return self.username

    def sds_client(self) -> SDSClient:
        sds = SDSClient(
            host=settings.SDS_CLIENT_URL,
            env_config={"SDS_SECRET_TOKEN": self.sds_token},
        )
        sds.dry_run = False
        sds.authenticate()
        return sds

    def fetch_sds_token(self) -> str | None:
        """
        Fetches the SDS token from the SVI server using the user's email.
        Should be called after user login.

        Returns:
            Optional[str]: The API key if successful, None if the request fails
        """
        logger = logging.getLogger(__name__)

        if settings.DEBUG:
            if not settings.SDS_USER_API_KEY:
                logger.error(
                    "SDS_USER_API_KEY is not set in your environment variables"
                )
                return None
            logger.info("Using local SVI SDK API key")
            self.sds_token = settings.SDS_USER_API_KEY
            self.save(update_fields=["sds_token"])
            return settings.SDS_USER_API_KEY

        try:
            response = requests.get(
                f"{settings.SVI_SERVER_URL}/users/get-svi-api-key/",
                params={"email": self.email},
                headers={
                    "Authorization": f"Token {settings.SVI_SERVER_API_KEY}",
                },
                timeout=60,
            )

            response.raise_for_status()
            data = response.json()

            if data.get("email") == self.email:
                self.sds_token = data.get("api_key")
                self.save(update_fields=["sds_token"])
                return self.sds_token

            logger.error(
                "Email mismatch in SVI server response for user %s",
                self.email,
            )
            return None

        except requests.RequestException as e:
            logger.error(
                "Failed to fetch API key from SVI server for user %s: %s",
                self.email,
                str(e),
            )
            return None


@receiver(user_logged_in)
def handle_user_login(sender: type, user: "User", request, **kwargs) -> None:  # noqa: ARG001
    """
    Signal receiver that handles post-login actions for users.
    Fetches the SDS token when a user logs in.

    Args:
        sender: The model class that sent the signal
        user: The user instance that just logged in
        request: The request object
        **kwargs: Additional keyword arguments passed by the signal
    """
    logger = logging.getLogger(__name__)

    try:
        token = user.fetch_sds_token()
        if not token:
            logger.warning(
                "Failed to fetch SDS token for user %s during login", user.email
            )
    except Exception as e:
        logger.error(
            "Unexpected error fetching SDS token for user %s during login: %s",
            user.email,
            str(e),
        )
