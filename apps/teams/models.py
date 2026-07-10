from django.db import models
from django.conf import settings
from apps.common.models import BaseModel

# write your models here

class Team(BaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


class Membership(BaseModel):
    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        MAINTAINER = "MAINTAINER", "Maintainer"
        MEMBER = "MEMBER", "Member"
        VIEWER = "VIEWER", "Viewer"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)

    class Meta:
        unique_together = ("user", "team")

    def __str__(self):
        return f"{self.user.email} - {self.team.name} ({self.role})"
    
class ActivityLog(BaseModel):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="activity_logs")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="activity_logs",
    )
    description = models.CharField(max_length=500)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.description