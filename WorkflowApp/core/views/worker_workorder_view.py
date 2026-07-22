from datetime import date

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Order


class WorkerWorkOrderViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):

        today = date.today()

        orders = (
            Order.objects
            .select_related("customer")
            .prefetch_related(
                "items",
                "items__product",
                "items__workflow",
                "items__features",
                "items__materials",
                "items__materials__material_variant",
                "task_set",
                "task_set__workflow_step",
                "task_set__assigned_to",
            )
            .order_by("delivery_date", "-id")
        )

        result = []

        for order in orders:

            products = []
            workflow = []

            my_task = None

            completed_steps = 0
            total_steps = order.task_set.count()

            grand_total = 0

            # -----------------------
            # PRODUCTS
            # -----------------------

            for item in order.items.all():

                if order.customer.customer_type == "wholesale":
                    price = item.product.wholesale_price
                else:
                    price = item.product.retail_price

                line_total = price * item.quantity
                grand_total += line_total

                feature_list = []

                for f in item.features.all():
                    feature_list.append({
                        "name": f.feature_name,
                        "value": f.value
                    })

                material_list = []

                for m in item.materials.all():
                    material_list.append({
                        "name": m.material_variant.material.name,
                        "variant": m.material_variant.name,
                        "qty": m.quantity_used,
                        "unit": m.material_variant.unit,
                    })

                products.append({

                    "id": item.id,

                    "product": item.product.name,

                    "quantity": item.quantity,

                    "price": float(price),

                    "total": float(line_total),

                    "features": feature_list,

                    "materials": material_list,

                })

            # -----------------------
            # WORKFLOW
            # -----------------------

            for task in order.task_set.all().order_by(
                "workflow_step__sequence_order"
            ):

                if task.status == "completed":
                    completed_steps += 1

                workflow.append({

                    "task_id": task.id,

                    "step": task.workflow_step.name,

                    "role": (
                        task.workflow_step.role.name
                        if task.workflow_step.role
                        else ""
                    ),

                    "status": task.status,

                    "worker": (
                        task.assigned_to.username
                        if task.assigned_to
                        else None
                    ),

                })

                # Worker's own task

                profile = getattr(request.user, "userprofile", None)

                if (
                    profile
                    and profile.role == task.workflow_step.role
                ):
                    my_task = {

                        "task_id": task.id,

                        "step": task.workflow_step.name,

                        "status": task.status,

                        "assigned_to_me": (
                            task.assigned_to == request.user
                        ),

                    }

            # -----------------------
            # DELIVERY STATUS
            # -----------------------

            if order.delivery_date < today:

                priority = "overdue"

            elif order.delivery_date == today:

                priority = "today"

            else:

                priority = "future"

            percent = 0

            if total_steps:

                percent = round(
                    (completed_steps / total_steps) * 100
                )

            result.append({

                "order_id": order.id,

                "customer": order.customer.name,

                "company": order.customer.company_name,

                "phone": order.customer.phone,

                "delivery_date": order.delivery_date,

                "priority": priority,

                "products": products,

                "workflow": workflow,

                "my_task": my_task,

                "progress": percent,

                "completed": percent == 100,

                "grand_total": float(grand_total),

            })

        return Response(result)
    
    def retrieve(self, request, pk=None):

        from django.shortcuts import get_object_or_404

        order = get_object_or_404(
            Order.objects
            .select_related("customer")
            .prefetch_related(
                "items",
                "items__product",
                "items__features",
                "items__materials",
                "items__materials__material_variant",
                "task_set",
                "task_set__workflow_step",
                "task_set__assigned_to",
            ),
            pk=pk,
        )

        products = []

        grand_total = 0

        for item in order.items.all():

            if order.customer.customer_type == "wholesale":
                price = item.product.wholesale_price
            else:
                price = item.product.retail_price

            total = price * item.quantity
            grand_total += total

            products.append({
                "product": item.product.name,
                "quantity": item.quantity,
                "price": float(price),
                "total": float(total),
                "features": [
                    {
                        "name": f.feature_name,
                        "value": f.value,
                    }
                    for f in item.features.all()
                ],
            })

        workflow = []

        my_task = None

        profile = getattr(request.user, "userprofile", None)

        for task in order.task_set.all().order_by(
            "workflow_step__sequence_order"
        ):

            workflow.append({

                "task_id": task.id,

                "step": task.workflow_step.name,

                "role": task.workflow_step.role.name
                if task.workflow_step.role
                else "",

                "status": task.status,

                "worker": task.assigned_to.username
                if task.assigned_to
                else None,

            })

            if (
                profile
                and profile.role == task.workflow_step.role
            ):
                my_task = {
                    "task_id": task.id,
                    "step": task.workflow_step.name,
                    "status": task.status,
                }

        return Response({

            "order_id": order.id,

            "customer": order.customer.name,

            "company": order.customer.company_name,

            "phone": order.customer.phone,

            "delivery_date": order.delivery_date,

            "delivery_method": order.delivery_method,

            "products": products,

            "workflow": workflow,

            "my_task": my_task,

            "grand_total": float(grand_total),

    })