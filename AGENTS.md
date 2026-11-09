# D2Print Workflow repository guidance

## Project technology and hosting

- Backend: Django and Django REST Framework.
- Frontend: React.
- Production database: PostgreSQL.
- Production hosting: Oracle Cloud Ubuntu.
- Application server: Gunicorn, managed by systemd, behind Nginx.
- GitHub is the source-control location.

Treat these as project context. Inspect the repository and deployment configuration to confirm concrete versions, paths, service names, and current behavior rather than guessing.

## Development rules

- Inspect the existing implementation and Git status before editing. Preserve unrelated local changes; never overwrite or revert them.
- Preserve existing features and API compatibility. Never recreate the application unnecessarily; make small, focused changes.
- Do not delete production data. Never expose passwords, tokens, secret values, or environment variables in code, logs, or reports.
- Do not run production migrations, restart production services, or deploy without explicit user approval.
- Verify changes with relevant tests or checks before reporting success. If a check cannot be run, say so and explain the limitation.
- When asked for complete replacement code, provide the complete file rather than a partial excerpt.

## Business context

D2Print supports a printing-shop lifecycle involving customers; products and product properties; workflows and workflow steps; orders and order items; task creation and automatic assignment; worker roles and task queues; production completion; delivery; billing; raw materials and inventory; customer history; and reporting.

Before changing a workflow feature, trace its effects through related models, APIs, status transitions, and dependent frontend screens. Verify actual role IDs, status values, and workflow relationships in code and data definitions; do not infer their meaning from names alone.

## Focused skills

Use the relevant focused instructions under `.agents/skills/` for backend, frontend, workflow logic, debugging, or deployment work. These skills supplement this repository guidance.
