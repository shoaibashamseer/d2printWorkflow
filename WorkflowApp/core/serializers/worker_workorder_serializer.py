from rest_framework import serializers

class WorkerWorkOrderSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    customer = serializers.CharField()
    company = serializers.CharField(allow_null=True)
    phone = serializers.CharField(allow_null=True)

    delivery_date = serializers.DateField()
    delivery_status = serializers.CharField()

    products = serializers.ListField()

    workflow = serializers.ListField()

    my_task = serializers.DictField()

    completed = serializers.BooleanField()

    grand_total = serializers.DecimalField(
        max_digits=12,
        decimal_places=2
    )