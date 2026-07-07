from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView #takes a valid token and issues a new access token
from .views import RegisterView, LoginView, LogoutView

urlpatterns = [
    path("signup/", RegisterView.as_view(), name ="signup"),
    path("login/", LoginView.as_view(), name='login'),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]