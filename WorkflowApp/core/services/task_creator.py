from core.models import WorkflowStep, Task


def create_tasks_for_order(order):

    for item in order.items.all():

        steps = WorkflowStep.objects.filter(
            workflow=item.workflow
        ).order_by("sequence_order")

        first = True

        for step in steps:

            Task.objects.create(
                order=order,
                order_item=item,
                workflow_step=step,

                # Nobody owns the task until they start it
                assigned_to=None,

                status="ready" if first else "pending"
            )

            first = False
