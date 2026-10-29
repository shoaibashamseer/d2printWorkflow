from rest_framework.viewsets import ModelViewSet
from rest_framework.response import Response
from rest_framework import status
from django.db.models.deletion import ProtectedError
from core.models import Order
from core.serializers.order_serializer import OrderSerializer

class OrderViewSet(ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer

    def destroy(self, request, *args, **kwargs):
        order = self.get_object()
        try:
            order.delete()
        except ProtectedError:
            return Response(
                {"detail": "This order has delivery history and cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
