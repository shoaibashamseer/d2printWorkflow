from rest_framework import serializers
from core.models import Customer


class CustomerSerializer(serializers.ModelSerializer):


    class Meta:
        model = Customer

        fields = [
            "id",
            "name",
            "phone",
            "customer_type",
            "email",
            "company_name",
            "address",
            "is_frequent",
            "delivery_method",
            "order_get_method",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]
