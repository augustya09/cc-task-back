from django.shortcuts import render
from django.contrib.auth import get_user_model
from rest_framework import viewsets, status 
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .utils import log_activity

from .models import Team, Membership
from .serializers import (
    TeamSerializer,
    MembershipSerializer,
    InviteMemberSerializer,
    ChangeRoleSerailiser,
)

# Create your views here.


User = get_user_model()

class TeamViewSet(viewsets.ModelViewSet): #knows basic CRUD operations
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated] #only logged in users can use this endpoint

    def get_queryset(self): #which teams should the user be allowed to see
        return Team.objects.filter(memberships__user=self.request.user)
    
    def perform_create(self, serializer):

        team = serializer.save() #save the newly created team 
        Membership.objects.create(
            user=self.request.user, team=team, role=Membership.Role.OWNER #creator = owner
        )
        log_activity(team, self.request.user, f"{self.request.user.email} created the team.")

    def _get_membership(self, team, user):
        return Membership.objects.filter(team=team, user=user).first()
    
    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        team = self.get_object()
        if Membership.objects.filter(team=team, user=request.user).exists():
            return Response(
                {"success": False, "message": "Already member of this team.", "errors":{}},
                status=status.HTTP_400_BAD_REQUEST
            )
        Membership.objects.create(team=team, user=request.user, role=Membership.Role.MEMBER)
        log_activity(team, request.user, f"{request.user.email} joined the team.")
        return Response(
            {"success":True, "message":"joined Team."}, status=status.HTTP_201_CREATED
        )
    

    @action(detail=True, methods=["post"])
    def invite(self, request, pk=None):
        team = self.get_object()
        requester_membership = self._get_membership(team, request.user)
        log_activity(team, request.user, f"{request.user.email} invited {invited_user.email}.")

        if not requester_membership or requester_membership.role not in [
            Membership.Role.OWNER,
            Membership.Role.MAINTAINER,
        ]:
            return Response(
                {"success":False, "message":"You do not have persmission to invite members.", "errors":{}},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = InviteMemberSerializer(data=request.data)
        serializer.is_valid(riase_exception=True)

        try:
            invited_user = User.objects.get(email=serializer.validated_data["email"])

        except User.DoesNotExist:
            return Response(
                {"success": False, "message":"No user found with that email", "errors":{}},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        membership, created = Membership.objects.get_or_create(
            team=team,
            user=invited_user,
            defaults={"role":serializer.validated_data["role"]}
        )
        if not created:
            return Response(
                {"success":True, "message":f"{invited_user.email} added to team "},
                status=status.HTTP_201_CREATED
            )
        
    @action(detail=True, methods=["get"], url_path="members")
    def list_members(self, request, pk=None):
        team = self.get_object()
        memberships = team .memberships.select_related("user").all()
        return Response(MembershipSerializer(memberships, many=True).data)

    @action(
        detail=True,
        methods=["patch"],
        url_path="members/(?P<user_id>[^/.]+)/role"
    )
    def change_role(self, request, pk=None, user_id=None):
        team = self.get_object()
        requester_membership = self._get_membership(team, request.user)

        if not requester_membership or requester_membership.role != Membership.Role.OWNER:
            return Response(
                {"success":False, "message":"Only the team owner can change roles", "errors":{}},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        target_membership = Membership.objects.filter(team=team, user__id=user_id).first()
        if not target_membership:
            return Response(
                {"success":False, "message":"That user is not a member of this team", "errors":{}},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = ChangeRoleSerailiser(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_membership.role = serializer.validated_data["role"]
        target_membership.save()
        log_activity(team, request.user, f"{request.user.email} changed {target_membership.user.email}'s role to {target_membership.role}.")
        return Response(MembershipSerializer(target_membership).data)
    
    @action(detail=True, methods=["get"], url_path="activity")
    def activity(self, request, pk=None):
        team = self.get_object()
        logs = team.activity_logs.select_related("user").all()
        return Response([
            {"user": log.user.email if log.user else None, "description": log.description, "created_at": log.created_at}
            for log in logs
        ])

