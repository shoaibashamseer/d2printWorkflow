from django.urls import reverse
from rest_framework import serializers

from core.models import OrderItemLifecycle, Task


class DeliveryConfirmationSerializer(serializers.Serializer):
    photo = serializers.ImageField(required=False, allow_null=True)

    def validate_photo(self, photo):
        if photo and photo.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("Photo must be 10 MB or smaller.")
        return photo


class OrderItemLifecycleSerializer(serializers.BaseSerializer):
    """Unified representation for eligible items and persisted lifecycle rows."""

    def to_representation(self, instance):
        lifecycle = instance if isinstance(instance, OrderItemLifecycle) else None
        item = lifecycle.order_item if lifecycle else instance
        history = self.context.get("history", False)
        tasks = getattr(item, "lifecycle_tasks", None)
        if tasks is None:
            tasks = list(Task.objects.filter(order_item=item))
        complete_tasks = bool(tasks) and all(task.status == "completed" for task in tasks)
        completed_times = [task.completed_at for task in tasks if task.completed_at]
        photo_url = None
        if lifecycle and lifecycle.delivery_photo:
            path = reverse(
                "worker-item-lifecycle-photo",
                kwargs={"order_item_id": item.id},
            )
            request = self.context.get("request")
            photo_url = request.build_absolute_uri(path) if request else path

        snapshot_product_name = item.product_name_at_order
        snapshot_customer_name = item.customer_name_at_order
        snapshot_description = item.product_description_at_order
        snapshot_quantity = item.quantity_at_order

        if history:
            product_name = snapshot_product_name
            customer_name = snapshot_customer_name
            product_description = snapshot_description
            quantity = snapshot_quantity
        else:
            product_name = snapshot_product_name if snapshot_product_name is not None else item.product.name
            customer_name = snapshot_customer_name if snapshot_customer_name is not None else item.order.customer.name
            product_description = snapshot_description if snapshot_description is not None else (item.product.description or None)
            quantity = snapshot_quantity if snapshot_quantity is not None else item.quantity

        return {
            "id": lifecycle.id if lifecycle else None,
            "order_item_id": item.id,
            "order_id": item.order_id,
            "customer_name": customer_name,
            "product_name": product_name,
            "product_description": product_description,
            # The Product model does not currently contain a SKU/code field.
            "product_sku": None,
            "quantity": quantity,
            # Never substitute the current catalog price for a missing snapshot.
            "unit_price_at_order": item.unit_price_at_order,
            "delivery_date": item.order.delivery_date,
            "delivery_method": item.order.delivery_method,
            "production_completed_at": max(completed_times) if complete_tasks and completed_times else None,
            "delivery_confirmed_at": lifecycle.delivery_confirmed_at if lifecycle else None,
            "delivery_confirmed_by": lifecycle.delivery_confirmed_by_id if lifecycle else None,
            "billing_completed_at": lifecycle.billing_completed_at if lifecycle else None,
            "billing_completed_by": lifecycle.billing_completed_by_id if lifecycle else None,
            "payment_received_at": lifecycle.payment_received_at if lifecycle else None,
            "payment_received_by": lifecycle.payment_received_by_id if lifecycle else None,
            "delivery_photo_url": photo_url,
        }
