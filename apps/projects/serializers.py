from rest_framework import serializers
from apps.authentication.serializers import UserSerializer
from apps.teams.models import Membership #needed because tasks can only be assigned to people who are in the team 
from .models import Project, Task , Comment

class CommentSerializer(serializers.ModelSerializer):
    author  = UserSerializer(read_only=True) #instead of id you get the whole user object

    class Meta:
        model = Comment
        fields  = ["id", "task", "author", "content", "created_at"]
        read_only_fields = ["task"]

class TaskSerializer(serializers.ModelSerializer):
    assigned_to = UserSerializer(many=True, read_only=True) # a task can be assigned to multiple users, so we set many=True
    assigned_to_ids = serializers.PrimaryKeyRelatedField(
        source="assigned_to", queryset=Membership.objects.all(), many=True, write_only=True, required=False,)
    created_by = UserSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            "id", "project", "title", "description", "status", "priority",
            "assigned_to", "assigned_to_ids", "created_by", "comments", "created_at"
        ]

        read_only_fields = ["project", "created_by"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and "project_pk" in self.context:
            from apps.authentication.serializers import User as _
            from django.contrib.auth import get_user_model
            User = get_user_model()
            project = self.context.get("project")

            if project:
                member_ids = Membership.objects.filter(team=project.team).values_list("user_id", flat=True)
                self.fields["assigned_to_ids"].queryset = User.objects.filter(id__in=member_ids)

class ProjectSerializer(serializers.ModelSerializer):
    task = TaskSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = ["id", "team", "name", "description", "task", "created_at"]
        read_only_fields = ["team"]
        