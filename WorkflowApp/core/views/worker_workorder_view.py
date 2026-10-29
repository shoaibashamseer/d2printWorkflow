from datetime import date

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Order


class WorkerWorkOrderViewSet(viewsets.ViewSet):

    permission_classes = [IsAuthenticated]

    # =====================================================
    # LIST ALL WORK ORDERS
    # =====================================================
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
                "task_set__workflow_step__role",
                "task_set__assigned_to",
            )
            .order_by(
                "delivery_date",
                "-id"
            )
        )

        result = []

        for order in orders:

            products = []
            workflow = []

            completed_steps = 0
            total_steps = order.task_set.count()
            grand_total = 0

        # =================================================
        # ORDER ITEMS
        # =================================================

            for item in order.items.all():

                # -------------------------------------------------
            # PRICE
            # -------------------------------------------------

                if order.customer.customer_type == "wholesale":
                    price = item.product.wholesale_price
                else:
                    price = item.product.retail_price

                line_total = price * item.quantity
                grand_total += line_total

            # -------------------------------------------------
            # FEATURES
            # -------------------------------------------------

                feature_list = []

                for f in item.features.all():

                    feature_list.append({
                        "name": f.feature_name,
                        "value": f.value,
                    })

            # -------------------------------------------------
            # MATERIALS
            # -------------------------------------------------

                material_list = []

                for m in item.materials.all():

                    material_list.append({
                        "name": m.material_variant.material.name,
                        "variant": m.material_variant.name,
                        "qty": m.quantity_used,
                        "unit": m.material_variant.unit,
                    })

            # -------------------------------------------------
            # TASKS FOR THIS ITEM
            # -------------------------------------------------

                item_tasks = []

                item_tasks_queryset = (
                    order.task_set
                    .filter(order_item=item)
                    .order_by(
                        "workflow_step__sequence_order"
                    )
                )

                for task in item_tasks_queryset:

                    if task.status == "completed":
                        completed_steps += 1

                    task_data = {
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

                        "assigned_to_me": (
                            task.assigned_to_id == request.user.id
                        ),
                    }

                    item_tasks.append(task_data)

                # Keep overall workflow list
                    workflow.append(task_data)

            # -------------------------------------------------
            # PRODUCT
            # -------------------------------------------------

                products.append({

                    "id": item.id,

                    "product": item.product.name,

                    "quantity": item.quantity,

                    "price": float(price),

                    "total": float(line_total),

                    "features": feature_list,

                    "materials": material_list,

                # IMPORTANT
                    "tasks": item_tasks,
                })

        # =================================================
        # CURRENT AVAILABLE TASK
        # =================================================

            current_task = None

            for task in (
                order.task_set
                .all()
                .order_by(
                    "workflow_step__sequence_order"
                )
            ):

                if task.status in [
                    "ready",
                    "in_progress"
                ]:

                    current_task = {

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

                        "assigned_to_me": (
                            task.assigned_to_id == request.user.id
                        ),
                    }

                    break

        # =================================================
        # DELIVERY PRIORITY
        # =================================================

            if order.delivery_date < today:

                priority = "overdue"

            elif order.delivery_date == today:

                priority = "today"

            else:

                priority = "future"

        # =================================================
        # PROGRESS
        # =================================================

            percent = 0

            if total_steps:

                percent = round(
                    (completed_steps / total_steps) * 100
                )

        # =================================================
        # RESULT
        # =================================================

            result.append({

                "order_id": order.id,

                "customer_id": order.customer.id,

                "customer": order.customer.name,

                "company": order.customer.company_name,

                "phone": order.customer.phone,

                "delivery_date": order.delivery_date,

                "priority": priority,

                "products": products,

                "workflow": workflow,

                "my_task": current_task,

                "progress": percent,

                "completed": percent == 100,

                "grand_total": float(grand_total),
            })

        return Response(result)
    # =====================================================
    # RETRIEVE SINGLE ORDER
    # =====================================================

    def retrieve(self, request, pk=None):

        from django.shortcuts import get_object_or_404

        order = get_object_or_404(

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
                "task_set__workflow_step__role",
                "task_set__assigned_to",
            ),

            pk=pk,
        )


        products = []

        grand_total = 0


        # =================================================
        # PRODUCTS
        # =================================================

        for item in order.items.all():

            if order.customer.customer_type == "wholesale":

                price = item.product.wholesale_price

            else:

                price = item.product.retail_price


            total = price * item.quantity

            grand_total += total


            products.append({

                "id": item.id,

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


        # =================================================
        # WORKFLOW
        # =================================================

        workflow = []

        current_task = None


        for task in order.task_set.all().order_by(
            "workflow_step__sequence_order"
        ):

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


            # -----------------------------
            # CURRENT TASK
            # -----------------------------

            if current_task is None:

                if task.status in [
                    "ready",
                    "in_progress"
                ]:

                    current_task = {

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

                        "assigned_to_me": (
                            task.assigned_to_id
                            == request.user.id
                        ),

                    }


        # =================================================
        # RESPONSE
        # =================================================

        return Response({

            "order_id": order.id,

            "customer": order.customer.name,

            "company": order.customer.company_name,

            "phone": order.customer.phone,

            "delivery_date": order.delivery_date,

            "delivery_method": order.delivery_method,

            "products": products,

            "workflow": workflow,

            "my_task": current_task,

            "grand_total": float(grand_total),

        })
