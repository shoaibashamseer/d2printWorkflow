---
name: d2print-workflow-logic
description: Use when changing or investigating D2Print printing-shop lifecycle rules, task generation or assignment, worker queues, production, delivery, billing, inventory, or order history.
---

# D2Print workflow logic

## Activate when

A task affects the lifecycle Customer → Product → Order → Order Items → Workflow → Workflow Steps → Tasks → Worker Assignment → Production → Delivery → Billing, or raw-material consumption, inventory consistency, duplicate task prevention, or customer/order history.

## Procedure

1. Read repository guidance and Git status. Map the relevant models, serializers, endpoints, signals/jobs, frontend screens, and tests before editing. Trace the full affected lifecycle in both directions where statuses or totals are derived.
2. Verify actual role IDs, status constants, workflow relations, assignment rules, and transition preconditions from implementation and migrations. Never assume numeric IDs or meanings from labels.
3. Write down the invariant the change must preserve: which order item/step creates which task, who may accept or complete it, what unlocks the next step, and how delivery, billing, inventory, and history reflect the result.
4. Make state transitions explicit and validate them on the server. Preserve API behavior where possible; reject invalid transitions clearly. Ensure manager/worker permissions are enforced server-side, not only in React.
5. Make multi-row generation and updates atomic. Consider concurrent requests, retries, idempotency keys or uniqueness constraints, duplicate task creation, partial failures, and safe locking. Keep stock deductions and order/task state consistent; prevent negative or double-consumed inventory unless the existing rules explicitly allow it.
6. Trace dependent screens and APIs for manager queues, worker queues, production completion, delivery, billing, inventory alerts, customer history, and reports. Update only affected consumers and preserve established contracts.
7. Add focused tests for normal lifecycle, invalid transitions, permission boundaries, repeated requests, concurrent/duplicate generation, inventory boundaries, and rollback behavior as relevant. Run those tests and inspect the final diff.

## Safety

Never delete production data or use destructive commands to repair workflow state. Do not mutate live production records, run production migrations, restart services, or deploy without explicit approval. Use sanitized fixtures for diagnostics.

## Deliverables

Explain the invariant and transition behavior changed, list affected models/APIs/screens, note compatibility or migration impact, and report verification performed.
