from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.teams.models import Team, Membership
from .models import Project, Task, Comment
from .serializers import ProjectSerializer, TaskSerializer, CommentSerializer
from .permissions import ProjectPermission, TaskPermission, CommentPermission

from apps.teams.utils import log_activity

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [ProjectPermission]

    def get_queryset(self):
        # Only projects belonging to teams the requester is actually in
        return Project.objects.filter(team__memberships__user=self.request.user).distinct()

    def perform_create(self, serializer):
        team_id = self.request.data.get("team")
        if not team_id:
            raise ValidationError({"team": ["This field is required."]})

        team = Team.objects.filter(id=team_id).first()
        if not team:
            raise ValidationError({"team": ["Team not found."]})

        membership = Membership.objects.filter(team=team, user=self.request.user).first()
        if not membership or membership.role not in [Membership.Role.OWNER, Membership.Role.MAINTAINER]:
            raise PermissionDenied("Only Owners and Maintainers can create projects.")

        serializer.save(team=team)
        log_activity(team, self.request.user, f"{self.request.user.email} created project '{team_id and serializer.instance.name}'.")


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [TaskPermission]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["status", "priority"]
    search_fields = ["title"]

    def get_queryset(self):
        return Task.objects.filter(
            project__team__memberships__user=self.request.user
        ).distinct()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        project_id = self.request.data.get("project") or self.request.query_params.get("project")
        if project_id:
            context["project"] = Project.objects.filter(id=project_id).first()
        return context

    def perform_create(self, serializer):
        project_id = self.request.data.get("project")
        if not project_id:
            raise ValidationError({"project": ["This field is required."]})

        project = Project.objects.filter(id=project_id).first()
        if not project:
            raise ValidationError({"project": ["Project not found."]})

        membership = Membership.objects.filter(team=project.team, user=self.request.user).first()
        if not membership:
            raise PermissionDenied("You are not a member of this project's team.")

        # Owners/Maintainers/Members can create tasks; Viewers cannot
        if membership.role == Membership.Role.VIEWER:
            raise PermissionDenied("Viewers cannot create tasks.")

        serializer.save(project=project, created_by=self.request.user)

        log_activity(project.team, self.request.user, f"{self.request.user.email} created task '{serializer.instance.title}'.")


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [CommentPermission]

    def get_queryset(self):
        return Comment.objects.filter(
            task__project__team__memberships__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        task_id = self.request.data.get("task")
        if not task_id:
            raise ValidationError({"task": ["This field is required."]})

        task = Task.objects.filter(id=task_id).first()
        if not task:
            raise ValidationError({"task": ["Task not found."]})

        membership = Membership.objects.filter(team=task.project.team, user=self.request.user).first()
        if not membership:
            raise PermissionDenied("You are not a member of this task's team.")

        # All roles, including Viewer, can comment - no role check beyond membership
        serializer.save(task=task, author=self.request.user)

        log_activity(task.project.team, self.request.user, f"{self.request.user.email} commented on '{task.title}'.")