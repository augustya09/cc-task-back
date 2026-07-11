from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .serializers import RegisterSerializer, CustomTokenObtainPairSerializer

# Create your views here.

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny] #allows anyone to access this view

class LoginView(TokenObtainPairView): #check email+password generate access+refresh tokens
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]

class LogoutView(APIView): #logout is not jwt built in 
    permission_classes = [IsAuthenticated] #log out only if you are logged in 

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")

            if not refresh_token:
                return Response(
                    {
                    "success": False,
                    "message": "Refresh token is required.",
                    "errors": {},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
            )
            
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except (TokenError, KeyError):
            return Response(
                {"success": False, "message": "Invalid or missing refresh token", "errors":{}},
                status=status.HTTP_400_BAD_REQUEST
            )
