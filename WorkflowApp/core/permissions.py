from rest_framework.permissions import BasePermission

from core.models import UserProfile


class WorkerLifecyclePermission(BasePermission):
    """Allow authenticated workers, managers, and bosses to use worker lifecycle APIs."""

    message = "A worker, manager, or boss role is required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        try:
            profile = UserProfile.objects.select_related("role").get(user=user)
        except UserProfile.DoesNotExist:
            return False
        role = profile.role
        return bool(role and role.user_type in {"worker", "manager", "boss"})
