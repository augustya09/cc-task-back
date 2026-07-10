#permission matrix
from rest_framework import permissions
from apps.teams.models import Membership

class ProjectPermission(permissions.BasePermission):
    """
    Owners and maintainers = create, update, delete
    Members = create tasks, update tasks
    Viewers= view tasks only
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        membership = Membership.objects.filter(team=obj.team, user=request.user).first()
        if not membership:
            return False
        if request.meethod in permissions.SAFE_METHODS:
            return True
        
        return membership.role in [Membership.Role.OWNER, Membership.Role.MAINTAINER]
    
    
class TaskPermission(permissions.BasePermission):
    """
    Owners/Maintainers: create, delete, assign tasks
    Members: create tasks, update tasks assigned to them (but NOT reassign)
    Viewers: view tasks only
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        membership = Membership.objects.filter(team=obj.project.team, user=request.user).first()
        if not membership:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        if request.method == "DELETE":
            return membership.role in [Membership.Role.OWNER, Membership.Role.MAINTAINER]

        if request.method in ["PUT", "PATCH"]:
            is_reassignment = "assigned_to_ids" in request.data

            if membership.role in [Membership.Role.OWNER, Membership.Role.MAINTAINER]:
                return True  # can always update or reassign

            if membership.role == Membership.Role.MEMBER:
                if is_reassignment:
                    return False  # Members cannot reassign tasks, only Owner/Maintainer can
                return obj.assigned_to.filter(id=request.user.id).exists()

            return False

        return False
    
class CommentPermission(permissions.BasePermission):
    #all roles can comment

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        membership = Membership.objects.filter(team=obj.task.project.team, user=request.user).first()
        return membership
        
        
