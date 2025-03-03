from __future__ import annotations

import typing

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings

if typing.TYPE_CHECKING:
    from allauth.socialaccount.models import SocialLogin
    from django.http import HttpRequest

    from spectrumx_visualization_platform.users.models import User


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request: HttpRequest) -> bool:
        return getattr(settings, "ACCOUNT_ALLOW_REGISTRATION", True)

    def generate_state_param(self, state: dict) -> str:
        """
        Generates a state parameter that includes the redirect URL.
        This state will be passed to Auth0 and returned after authentication.
        """
        print("AccountAdapter generate_state_param")
        # Get the next parameter from the request
        next_url = self.request.GET.get("next")
        print(f"next_url: {next_url}")
        if next_url:
            # Store the redirect URL in the state
            state["redirect_url"] = next_url

        return super().generate_state_param(state)

    def get_connect_redirect_url(
        self, request: HttpRequest, socialaccount: SocialLogin
    ) -> str:
        """
        Returns the URL to redirect to after successfully connecting a social account.
        This method is called after the user has successfully authenticated with the social provider.
        """
        print("AccountAdapter get_connect_redirect_url")
        # Get the state from the request
        state = request.GET.get("state")
        if state:
            # Get the actual state data from AllAuth's state store
            state_data = self.get_state_data(state)
            print(f"state_data: {state_data}")
            if state_data and (redirect_url := state_data.get("redirect_url")):
                print("redirect_url", redirect_url)
                return redirect_url

        # If no redirect URL in state, fall back to frontend URL
        return getattr(settings, "FRONTEND_URL", "http://localhost:3000")

    def get_login_redirect_url(self, request: HttpRequest) -> str:
        """
        Returns the URL to redirect to after login.
        This method is called after the user has successfully authenticated.
        """
        print("AccountAdapter get_login_redirect_url")
        # Get the redirect URL from the session
        redirect_url = request.session.get("login_redirect_url")
        if redirect_url:
            print("redirect_url from session:", redirect_url)
            # Clear the redirect URL from session after using it
            del request.session["login_redirect_url"]
            return redirect_url

        # If no redirect URL in session, fall back to frontend URL
        return getattr(settings, "FRONTEND_URL", "http://localhost:3000")


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(
        self,
        request: HttpRequest,
        sociallogin: SocialLogin,
    ) -> bool:
        return getattr(settings, "ACCOUNT_ALLOW_REGISTRATION", True)

    def populate_user(
        self,
        request: HttpRequest,
        sociallogin: SocialLogin,
        data: dict[str, typing.Any],
    ) -> User:
        """
        Populates user information from social provider info.

        See: https://docs.allauth.org/en/latest/socialaccount/advanced.html#creating-and-populating-user-instances
        """
        user = super().populate_user(request, sociallogin, data)
        if not user.name:
            if name := data.get("name"):
                user.name = name
            elif first_name := data.get("first_name"):
                user.name = first_name
                if last_name := data.get("last_name"):
                    user.name += f" {last_name}"
        return user

    def generate_state_param(self, state: dict) -> str:
        """
        Generates a state parameter that includes the redirect URL.
        This state will be passed to Auth0 and returned after authentication.
        """
        print("SocialAccountAdapter generate_state_param")
        # Get the next parameter from the request
        next_url = self.request.GET.get("next")
        print(f"next_url: {next_url}")
        if next_url:
            # Store the redirect URL in the state
            state["redirect_url"] = next_url

        return super().generate_state_param(state)

    def get_connect_redirect_url(
        self, request: HttpRequest, socialaccount: SocialLogin
    ) -> str:
        """
        Returns the URL to redirect to after successfully connecting a social account.
        This method is called after the user has successfully authenticated with the social provider.
        """
        print("SocialAccountAdapter get_connect_redirect_url")
        # Get the redirect URL from the session
        redirect_url = request.session.get("login_redirect_url")
        if redirect_url:
            print("redirect_url from session:", redirect_url)
            # Clear the redirect URL from session after using it
            del request.session["login_redirect_url"]
            return redirect_url

        # If no redirect URL in session, fall back to frontend URL
        return getattr(settings, "FRONTEND_URL", "http://localhost:3000")

    def get_login_redirect_url(self, request: HttpRequest) -> str:
        """
        Returns the URL to redirect to after login.
        This method is called after the user has successfully authenticated.
        """
        print("AccountAdapter get_login_redirect_url")
        # Get the state from the request
        state = request.GET.get("state")
        if state:
            # Get the actual state data from AllAuth's state store
            state_data = self.get_state_data(state)
            print(f"state_data: {state_data}")
            if state_data and (redirect_url := state_data.get("redirect_url")):
                print("redirect_url", redirect_url)
                return redirect_url

        # If no redirect URL in state, fall back to frontend URL
        return getattr(settings, "FRONTEND_URL", "http://localhost:3000")
