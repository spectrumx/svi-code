from django.urls import path

from .views import login_with_redirect
from .views import user_detail_view
from .views import user_redirect_view
from .views import user_update_view

app_name = "users"
urlpatterns = [
    path("~redirect/", view=user_redirect_view, name="redirect"),
    path("~update/", view=user_update_view, name="update"),
    path("login-with-redirect/", view=login_with_redirect, name="login-with-redirect"),
    path("<str:username>/", view=user_detail_view, name="detail"),
]
