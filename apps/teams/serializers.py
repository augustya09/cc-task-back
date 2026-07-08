from rest_framework import serializers
from apps.authentication.serializers import UserSerializer
from .models import Team, Membership

class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only = True)

    class Meta:
        model = Membership
        fields = ["id", "user", "role", "created_at"]

class TeamSerializer(serializers.ModelSerializer): #converts one team into JSON
    members = MembershipSerializer(source="memberships", many=True, read_only=True)

    class Meta:
        model = Team
        fields = ["id", "name", "description", "members", "created_at"]

class InviteMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=Membership.Role.choices, default = Membership.Role.MEMBER)

class ChangeRoleSerailiser(serializers.Serializer):
    role = serializers.ChoiceField(choices=Membership.Role.choices)

