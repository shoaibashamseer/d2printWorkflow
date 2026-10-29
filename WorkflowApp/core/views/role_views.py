from rest_framework.viewsets import ModelViewSet
from core.models import Role
from core.serializers.role_serializer import RoleSerializer


class RoleViewSet(ModelViewSet):
    queryset = Role.objects.all().order_by("name")
    serializer_class = RoleSerializer
