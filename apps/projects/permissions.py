#permission matrix
from rest_framework import permissions
from apps.teams.models import Membership

class ProjectPermission(permissions.BasePermission):
    """
    Owners and maintainers = create, update, delete
    Members = read only
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
            if membership.role in [Membership.Role.OWNER, Membership.Role.MAINTAINER]:
                return True
            if membership.role == Membership.Role.MEMBER:
                return obj.assigned_to.filter(user=request.user).exists()
            return False
        return False
    
class CommentPermission(permissions.BasePermission):
    #all roles can comment

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        membership = Membership.objects.filter(team=obj.task.project.team, user=request.user).first()
        return membership
        
        
