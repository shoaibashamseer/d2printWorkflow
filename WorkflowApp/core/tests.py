from io import BytesIO
from decimal import Decimal
from tempfile import TemporaryDirectory
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from core.models import (
    Customer,
    Order,
    OrderItem,
    OrderItemLifecycle,
    Product,
    Role,
    Task,
    UserProfile,
    Workflow,
    WorkflowStep,
)

User = get_user_model()


class WorkerLifecycleApiTests(TestCase):
    def setUp(self):
        self.role = Role.objects.create(name="Worker", user_type="worker")
        self.worker = User.objects.create_user(username="worker1", password="test-pass")
        UserProfile.objects.update_or_create(
            user=self.worker,
            defaults={"role": self.role, "must_change_password": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(self.worker)
        self.customer = Customer.objects.create(name="Customer One", phone="1111")
        self.workflow = Workflow.objects.create(name="Standard")
        self.step = WorkflowStep.objects.create(workflow=self.workflow, name="Print", sequence_order=1)
        self.product = Product.objects.create(
            name="Flyer",
            description="A4 flyer",
            retail_price="10.50",
            wholesale_price="8.25",
            default_workflow=self.workflow,
        )
        self.order = Order.objects.create(
            customer=self.customer,
            delivery_date="2026-11-01",
            delivery_method="courier",
        )

    def make_item(self, *, quantity=1, with_task=True, task_status="completed", snapshots=True):
        values = {}
        if snapshots:
            values = {
                "product_name_at_order": self.product.name,
                "product_description_at_order": self.product.description,
                "customer_name_at_order": self.customer.name,
                "quantity_at_order": quantity,
                "unit_price_at_order": self.product.retail_price,
            }
        item = OrderItem.objects.create(
            order=self.order,
            product=self.product,
            workflow=self.workflow,
            quantity=quantity,
            **values,
        )
        lifecycle = OrderItemLifecycle.objects.create(order_item=item)
        if with_task:
            Task.objects.create(
                order=self.order,
                order_item=item,
                workflow_step=self.step,
                status=task_status,
                completed_at=timezone.now() if task_status == "completed" else None,
            )
        return item, lifecycle

    def item_url(self, item, action):
        return f"/api/worker/order-items/{item.id}/{action}/"

    def test_zero_or_unfinished_tasks_block_delivery(self):
        no_tasks, _ = self.make_item(with_task=False)
        unfinished, _ = self.make_item(task_status="in_progress")

        no_task_response = self.client.post(self.item_url(no_tasks, "confirm-delivery"), {}, format="json")
        unfinished_response = self.client.post(self.item_url(unfinished, "confirm-delivery"), {}, format="json")

        self.assertEqual(no_task_response.status_code, 400)
        self.assertEqual(unfinished_response.status_code, 400)
        self.assertFalse(OrderItemLifecycle.objects.get(order_item=no_tasks).delivery_confirmed_at)
        self.assertFalse(OrderItemLifecycle.objects.get(order_item=unfinished).delivery_confirmed_at)

    def test_delivery_without_photo_and_repeated_confirmation_are_persisted_once(self):
        item, lifecycle = self.make_item()
        url = self.item_url(item, "confirm-delivery")

        first = self.client.post(url, {}, format="json")
        repeated = self.client.post(url, {}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(repeated.status_code, 200)
        lifecycle.refresh_from_db()
        self.assertIsNotNone(lifecycle.delivery_confirmed_at)
        self.assertEqual(lifecycle.delivery_confirmed_by, self.worker)
        self.assertFalse(lifecycle.delivery_photo)
        self.assertEqual(OrderItemLifecycle.objects.filter(order_item=item).count(), 1)
        self.assertEqual(len(self.client.get("/api/worker/billing-items/").data), 1)

    def test_billing_history_and_payment_are_separate_and_idempotent(self):
        item, lifecycle = self.make_item()
        before_delivery = self.client.post(self.item_url(item, "complete-billing"))
        before_billing = self.client.post(self.item_url(item, "payment-received"))
        self.assertEqual(before_delivery.status_code, 400)
        self.assertEqual(before_billing.status_code, 400)

        self.client.post(self.item_url(item, "confirm-delivery"), {}, format="json")
        billing_response = self.client.post(self.item_url(item, "complete-billing"))
        self.assertEqual(billing_response.status_code, 200)
        lifecycle.refresh_from_db()
        self.assertIsNotNone(lifecycle.billing_completed_at)
        self.assertIsNone(lifecycle.payment_received_at)
        self.assertEqual(len(self.client.get("/api/worker/history/").data), 1)
        self.assertEqual(len(self.client.get("/api/worker/billing-items/").data), 1)
        self.assertIsNone(self.client.get("/api/worker/history/").data[0]["payment_received_at"])

        payment_response = self.client.post(self.item_url(item, "payment-received"))
        repeated_payment = self.client.post(self.item_url(item, "payment-received"))
        self.assertEqual(payment_response.status_code, 200)
        self.assertEqual(repeated_payment.status_code, 200)
        lifecycle.refresh_from_db()
        self.assertIsNotNone(lifecycle.payment_received_at)
        self.assertEqual(lifecycle.payment_received_by, self.worker)
        self.assertEqual(len(self.client.get("/api/worker/billing-items/").data), 0)
        self.assertEqual(len(self.client.get("/api/worker/history/").data), 1)

    def test_items_from_same_order_progress_independently(self):
        ready_for_delivery, _ = self.make_item(quantity=1)
        unfinished, _ = self.make_item(quantity=3, task_status="ready")

        response = self.client.get("/api/worker/delivery-items/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["order_item_id"] for row in response.data], [ready_for_delivery.id])
        self.client.post(self.item_url(ready_for_delivery, "confirm-delivery"), {}, format="json")
        self.assertEqual(len(self.client.get("/api/worker/delivery-items/").data), 0)
        self.assertIsNone(OrderItemLifecycle.objects.get(order_item=unfinished).delivery_confirmed_at)

    def test_completing_final_task_exposes_only_that_item_for_delivery(self):
        completed_item, _ = self.make_item(task_status="in_progress")
        unfinished_item, _ = self.make_item(quantity=2, task_status="ready")
        completed_task = Task.objects.get(order_item=completed_item)

        completion = self.client.post(f"/api/tasks/{completed_task.id}/complete/")

        self.assertEqual(completion.status_code, 200)
        completed_task.refresh_from_db()
        self.assertEqual(completed_task.status, "completed")
        delivery_items = self.client.get("/api/worker/delivery-items/")
        self.assertEqual(delivery_items.status_code, 200)
        self.assertEqual(
            [row["order_item_id"] for row in delivery_items.data],
            [completed_item.id],
        )
        self.assertNotIn(unfinished_item.id, [row["order_item_id"] for row in delivery_items.data])

    def test_history_uses_order_time_snapshots_and_never_current_price(self):
        item, lifecycle = self.make_item(quantity=2)
        self.client.post(self.item_url(item, "confirm-delivery"), {}, format="json")
        self.client.post(self.item_url(item, "complete-billing"))
        self.product.name = "Renamed Flyer"
        self.product.description = "Updated details"
        self.product.retail_price = "90.00"
        self.product.save()
        self.customer.name = "Renamed Customer"
        self.customer.save()

        row = self.client.get("/api/worker/history/").data[0]

        self.assertEqual(row["product_name"], "Flyer")
        self.assertEqual(row["product_description"], "A4 flyer")
        self.assertEqual(row["customer_name"], "Customer One")
        self.assertEqual(row["quantity"], 2)
        self.assertEqual(str(row["unit_price_at_order"]), "10.50")
        self.assertIsNone(row["product_sku"])

    def test_new_order_api_records_order_time_snapshots_without_changing_payload(self):
        response = self.client.post(
            "/api/orders/",
            {
                "customer": self.customer.id,
                "delivery_date": "2026-11-15",
                "delivery_method": "courier",
                "order_get_method": "direct",
                "items": [{"product": self.product.id, "quantity": 4}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        item = OrderItem.objects.get(order_id=response.data["id"])
        self.assertEqual(item.product_name_at_order, "Flyer")
        self.assertEqual(item.product_description_at_order, "A4 flyer")
        self.assertEqual(item.customer_name_at_order, "Customer One")
        self.assertEqual(item.quantity_at_order, 4)
        self.assertEqual(item.unit_price_at_order, Decimal(self.product.retail_price))
        self.assertFalse(OrderItemLifecycle.objects.filter(order_item=item).exists())

    def test_legacy_missing_snapshots_are_not_backfilled_from_current_values(self):
        item, lifecycle = self.make_item(snapshots=False)
        self.client.post(self.item_url(item, "confirm-delivery"), {}, format="json")
        self.client.post(self.item_url(item, "complete-billing"))

        row = self.client.get("/api/worker/history/").data[0]

        self.assertIsNone(row["product_name"])
        self.assertIsNone(row["customer_name"])
        self.assertIsNone(row["quantity"])
        self.assertIsNone(row["unit_price_at_order"])

    def test_optional_photo_is_saved_and_served_through_authenticated_api(self):
        item, lifecycle = self.make_item()
        image_buffer = BytesIO()
        Image.new("RGB", (2, 2), color="blue").save(image_buffer, format="PNG")
        upload = SimpleUploadedFile("proof.png", image_buffer.getvalue(), content_type="image/png")
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                response = self.client.post(
                    self.item_url(item, "confirm-delivery"),
                    {"photo": upload},
                    format="multipart",
                )
                self.assertEqual(response.status_code, 200)
                lifecycle.refresh_from_db()
                self.assertTrue(lifecycle.delivery_photo.storage.exists(lifecycle.delivery_photo.name))
                photo_response = self.client.get(f"/api/worker/order-items/{item.id}/photo/")
                self.assertEqual(photo_response.status_code, 200)
                self.assertIn("image/png", photo_response["Content-Type"])
                photo_response.close()

    def test_lifecycle_requires_an_allowed_role_and_managers_are_allowed(self):
        item, _ = self.make_item()
        unassigned = User.objects.create_user(username="unassigned", password="test-pass")
        self.client.force_authenticate(unassigned)
        denied = self.client.get("/api/worker/delivery-items/")
        self.assertEqual(denied.status_code, 403)

        manager_role = Role.objects.create(name="Manager", user_type="manager")
        manager = User.objects.create_user(username="manager1", password="test-pass")
        UserProfile.objects.update_or_create(
            user=manager,
            defaults={"role": manager_role, "must_change_password": True},
        )
        self.client.force_authenticate(manager)
        allowed = self.client.post(self.item_url(item, "confirm-delivery"), {}, format="json")
        self.assertEqual(allowed.status_code, 200)

    def test_saved_order_references_are_not_cascade_deleted(self):
        item, _ = self.make_item()
        self.client.post(self.item_url(item, "confirm-delivery"), {}, format="json")
        order_delete = self.client.delete(f"/api/orders/{self.order.id}/")
        product_delete = self.client.delete(f"/api/manager/products/{self.product.id}/")
        customer_delete = self.client.delete(f"/api/customers/{self.customer.id}/")

        self.assertEqual(order_delete.status_code, 409)
        self.assertEqual(product_delete.status_code, 409)
        self.assertEqual(customer_delete.status_code, 409)
        self.assertTrue(OrderItemLifecycle.objects.filter(order_item=item).exists())
