from rest_framework.viewsets import ModelViewSet
from rest_framework.response import Response
from rest_framework import status
from django.db.models.deletion import ProtectedError
from core.models import Customer
from core.serializers.customer_serializer import CustomerSerializer

class CustomerViewSet(ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    def destroy(self, request, *args, **kwargs):
        customer = self.get_object()
        try:
            customer.delete()
        except ProtectedError:
            return Response(
                {"detail": "This customer is linked to saved orders and cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
