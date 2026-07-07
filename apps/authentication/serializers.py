from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password]) #accept pass comming in but not going out ,djangos built in password strnght checker

    class Meta: #columns which are visible in the endpoint
        model = User
        fields = ["id", "username", "email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data) #hashses the password before saving
    
class UserSerializer(serializers.ModelSerializer): #showing user info elsewhere(team member lists)
    class Meta:
        model = User
        fields = ["id", "username", "email", "date_joined"]

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer): #already handles token generation
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data #frontend gets basic profile back immd at login,
        return data
    