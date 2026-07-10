from .models import ActivityLog


def log_activity(team, user, description):
    ActivityLog.objects.create(team=team, user=user, description=description)