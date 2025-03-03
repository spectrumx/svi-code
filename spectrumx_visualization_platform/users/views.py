from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.messages.views import SuccessMessageMixin
from django.http import HttpResponseRedirect
from django.utils.translation import gettext_lazy as _
from django.views.generic import DetailView
from django.views.generic import RedirectView
from django.views.generic import UpdateView

from spectrumx_visualization_platform.users.models import User


class UserDetailView(LoginRequiredMixin, DetailView):
    model = User
    slug_field = "username"
    slug_url_kwarg = "username"


user_detail_view = UserDetailView.as_view()


class UserUpdateView(LoginRequiredMixin, SuccessMessageMixin, UpdateView):
    model = User
    fields = ["name"]
    success_message = _("Information successfully updated")

    def get_success_url(self):
        # for mypy to know that the user is authenticated
        assert self.request.user.is_authenticated
        return self.request.user.get_absolute_url()

    def get_object(self):
        return self.request.user


user_update_view = UserUpdateView.as_view()


def store_login_redirect(request):
    """
    Store the redirect URL in the session and redirect to the login page.
    """
    # Get the next parameter from the request
    next_url = request.GET.get("next")
    if next_url:
        # Store the redirect URL in the session
        request.session["login_redirect_url"] = next_url

    # Redirect to the Auth0 login page
    return HttpResponseRedirect("/accounts/auth0/login/")


class UserRedirectView(LoginRequiredMixin, RedirectView):
    permanent = False

    def get_redirect_url(self):
        """
        Returns the URL to redirect to after login.
        This method is called after the user has successfully authenticated.
        """
        print("UserRedirectView get_redirect_url")
        # Use the account adapter to handle the redirect
        from allauth.account.adapter import get_adapter

        adapter = get_adapter(self.request)
        return adapter.get_login_redirect_url(self.request)


user_redirect_view = UserRedirectView.as_view()
