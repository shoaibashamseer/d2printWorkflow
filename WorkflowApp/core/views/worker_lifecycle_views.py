import mimetypes

from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import OrderItem, OrderItemLifecycle, Task
from core.permissions import WorkerLifecyclePermission
from core.serializers.order_item_lifecycle_serializer import (
    DeliveryConfirmationSerializer,
    OrderItemLifecycleSerializer,
)


def lifecycle_queryset():
    return OrderItemLifecycle.objects.select_related(
        "order_item",
        "order_item__order",
        "order_item__order__customer",
        "order_item__product",
        "delivery_confirmed_by",
        "billing_completed_by",
        "payment_received_by",
    ).prefetch_related(
        Prefetch(
            "order_item__task_set",
            queryset=Task.objects.only("id", "order_item_id", "status", "completed_at"),
            to_attr="lifecycle_tasks",
        )
    )


class DeliveryItemListView(APIView):
    permission_classes = [WorkerLifecyclePermission]

    def get(self, request):
        item_tasks = Task.objects.filter(order_item_id=OuterRef("pk"))
        delivered_items = OrderItemLifecycle.objects.filter(
            order_item_id=OuterRef("pk"),
            delivery_confirmed_at__isnull=False,
        )
        items = OrderItem.objects.select_related(
            "order", "order__customer", "product"
        ).prefetch_related(
            Prefetch(
                "task_set",
                queryset=Task.objects.only("id", "order_item_id", "status", "completed_at"),
                to_attr="lifecycle_tasks",
            )
        ).annotate(
            has_production_tasks=Exists(item_tasks),
            has_incomplete_tasks=Exists(
                item_tasks.exclude(status="completed")
            ),
            already_delivered=Exists(delivered_items),
        ).filter(
            has_production_tasks=True,
            has_incomplete_tasks=False,
            already_delivered=False,
        ).order_by("order__delivery_date", "order_id", "id")
        data = OrderItemLifecycleSerializer(items, many=True, context={"request": request}).data
        return Response(data)


class BillingItemListView(APIView):
    permission_classes = [WorkerLifecyclePermission]

    def get(self, request):
        items = lifecycle_queryset().filter(
            delivery_confirmed_at__isnull=False,
            payment_received_at__isnull=True,
        ).order_by("order_item__order__delivery_date", "order_item__order_id", "order_item_id")
        data = OrderItemLifecycleSerializer(items, many=True, context={"request": request}).data
        return Response(data)


class HistoryItemListView(APIView):
    permission_classes = [WorkerLifecyclePermission]

    def get(self, request):
        items = lifecycle_queryset().filter(
            billing_completed_at__isnull=False,
        ).order_by("-billing_completed_at", "order_item__order_id", "order_item_id")
        data = OrderItemLifecycleSerializer(
            items,
            many=True,
            context={"request": request, "history": True},
        ).data
        return Response(data)


class DeliveryConfirmationView(APIView):
    permission_classes = [WorkerLifecyclePermission]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    @transaction.atomic
    def post(self, request, order_item_id):
        item = get_object_or_404(
            OrderItem.objects.select_for_update().select_related(
                "order", "order__customer", "product"
            ),
            pk=order_item_id,
        )
        tasks = Task.objects.select_for_update().filter(order_item=item)
        if not tasks.exists():
            raise ValidationError({"detail": "Delivery is blocked because this item has no production tasks."})
        if tasks.exclude(status="completed").exists():
            raise ValidationError({"detail": "All production tasks for this item must be completed before delivery."})

        serializer = DeliveryConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lifecycle, _ = OrderItemLifecycle.objects.get_or_create(order_item=item)
        if lifecycle.delivery_confirmed_at is None:
            lifecycle.delivery_confirmed_at = timezone.now()
            lifecycle.delivery_confirmed_by = request.user
            photo = serializer.validated_data.get("photo")
            if photo:
                lifecycle.delivery_photo = photo
            lifecycle.save()

        result = OrderItemLifecycleSerializer(
            lifecycle,
            context={"request": request},
        )
        return Response(result.data, status=status.HTTP_200_OK)


class BillingCompletionView(APIView):
    permission_classes = [WorkerLifecyclePermission]

    @transaction.atomic
    def post(self, request, order_item_id):
        item = get_object_or_404(OrderItem.objects.select_for_update(), pk=order_item_id)
        lifecycle = OrderItemLifecycle.objects.select_for_update().filter(order_item=item).first()
        if lifecycle is None or lifecycle.delivery_confirmed_at is None:
            raise ValidationError({"detail": "Delivery must be confirmed before billing can be completed."})
        if lifecycle.billing_completed_at is None:
            lifecycle.billing_completed_at = timezone.now()
            lifecycle.billing_completed_by = request.user
            lifecycle.save(update_fields=["billing_completed_at", "billing_completed_by"])
        result = OrderItemLifecycleSerializer(lifecycle, context={"request": request})
        return Response(result.data, status=status.HTTP_200_OK)


class PaymentReceivedView(APIView):
    permission_classes = [WorkerLifecyclePermission]

    @transaction.atomic
    def post(self, request, order_item_id):
        item = get_object_or_404(OrderItem.objects.select_for_update(), pk=order_item_id)
        lifecycle = OrderItemLifecycle.objects.select_for_update().filter(order_item=item).first()
        if lifecycle is None or lifecycle.billing_completed_at is None:
            raise ValidationError({"detail": "Billing must be completed before payment can be confirmed."})
        if lifecycle.payment_received_at is None:
            lifecycle.payment_received_at = timezone.now()
            lifecycle.payment_received_by = request.user
            lifecycle.save(update_fields=["payment_received_at", "payment_received_by"])
        result = OrderItemLifecycleSerializer(
            lifecycle,
            context={"request": request, "history": True},
        )
        return Response(result.data, status=status.HTTP_200_OK)


class DeliveryPhotoView(APIView):
    permission_classes = [WorkerLifecyclePermission]

    def get(self, request, order_item_id):
        lifecycle = get_object_or_404(
            OrderItemLifecycle.objects.only("delivery_photo"),
            order_item_id=order_item_id,
        )
        if not lifecycle.delivery_photo:
            return Response({"detail": "No delivery photo is saved for this item."}, status=status.HTTP_404_NOT_FOUND)
        try:
            photo = lifecycle.delivery_photo.open("rb")
        except (FileNotFoundError, OSError):
            return Response({"detail": "The saved delivery photo is unavailable."}, status=status.HTTP_404_NOT_FOUND)
        content_type = mimetypes.guess_type(lifecycle.delivery_photo.name)[0] or "application/octet-stream"
        response = FileResponse(photo, content_type=content_type)
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
