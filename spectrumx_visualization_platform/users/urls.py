from django.urls import path

from .views import store_login_redirect
from .views import user_detail_view
from .views import user_redirect_view
from .views import user_update_view

app_name = "users"
urlpatterns = [
    path("~redirect/", view=user_redirect_view, name="redirect"),
    path("~update/", view=user_update_view, name="update"),
    path(
        "store-login-redirect/", view=store_login_redirect, name="store-login-redirect"
    ),
    path("<str:username>/", view=user_detail_view, name="detail"),
]
