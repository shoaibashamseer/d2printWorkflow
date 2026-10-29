from core.models import Task
from django.utils import timezone


def complete_task(task: Task):
    """
    Marks the given task as completed
    and unlocks the next task in the same
    order item workflow.
    """

    if task.status != "in_progress":
        raise ValueError(
            "Only IN_PROGRESS tasks can be completed"
        )

    # -----------------------------------------
    # COMPLETE CURRENT TASK
    # -----------------------------------------

    task.status = "completed"

    task.completed_at = timezone.now()

    task.save(
        update_fields=[
            "status",
            "completed_at",
        ]
    )

    # -----------------------------------------
    # FIND NEXT TASK
    # SAME ORDER ITEM
    # -----------------------------------------

    next_task = (
        Task.objects
        .filter(
            order_item=task.order_item,
            workflow_step__sequence_order__gt=(
                task.workflow_step.sequence_order
            ),
            status="pending",
        )
        .order_by(
            "workflow_step__sequence_order"
        )
        .first()
    )

    # -----------------------------------------
    # UNLOCK NEXT TASK
    # -----------------------------------------

    if next_task:

        next_task.status = "ready"

        next_task.save(
            update_fields=["status"]
        )

    # -----------------------------------------
    # CHECK WHETHER THIS ORDER IS COMPLETED
    # -----------------------------------------

    remaining = (
        Task.objects
        .filter(order=task.order)
        .exclude(status="completed")
        .exists()
    )

    if not remaining:

        task.order.status = "completed"

        task.order.save(
            update_fields=["status"]
        )


def start_task(task: Task):
    """
    Marks a READY task as IN_PROGRESS.
    """

    if task.status != "ready":
        raise ValueError(
            "Only READY tasks can be started"
        )

    task.status = "in_progress"
    task.assigned_to = None
    task.started_at = timezone.now()

    task.save(
        update_fields=[
            "status",
            "assigned_to",
            "started_at",
        ]
    )
