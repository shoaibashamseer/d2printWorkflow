---
name: d2print-deployment
description: Use when preparing, reviewing, or carrying out an explicitly approved D2Print deployment or production operations on Oracle Cloud Ubuntu.
---

# D2Print safe deployment

## Activate when

A task concerns production readiness, GitHub synchronization, Oracle Cloud Ubuntu, Python virtual environments, Django production settings, React builds, Gunicorn, systemd, Nginx, static/media files, database backups/migrations, health checks, or rollback.

## Procedure

1. Inspect repository guidance and `git status --short`; inspect commits and diffs. Preserve unrelated changes. Verify the Git remote and branch without printing credentials embedded in remote URLs.
2. Establish the real deployment layout from approved inventory and configuration. Verify the deployment directory, virtual environment, settings module, systemd unit, Gunicorn command/socket, Nginx site, static/media paths, database target, and backup location. Never assume names or paths.
3. Review the exact release diff and compatibility risks. Confirm required environment variable names without displaying values. Never overwrite production settings or secrets. Build the frontend and run backend checks in a non-production environment as appropriate.
4. Before any production operation, provide a concrete step-by-step plan and rollback plan covering application code, static assets, database backup, migration reversibility/compatibility, health checks, and recovery commands. Obtain explicit user approval before deployment, production migrations, or service restarts.
5. For GitHub pull/push, confirm branch, remote, and intended commits. Resolve conflicts by inspecting both sides; never use `git reset --hard` or `git clean -fd` for routine conflicts. Do not force-push without explicit direction.
6. Take and verify an appropriate database backup before approved schema/data operations. Assess migration ordering, locks, runtime compatibility, and rollback constraints. Never delete production data.
7. After approved deployment, verify service health, logs, HTTP/API behavior, frontend assets, and key workflow paths. If checks fail, follow the agreed rollback plan and report evidence.

## Safety

No production migrations, service restarts, pushes, or deployment without explicit approval. Verify actual paths and service names first. Protect credentials, environment values, and user data. Do not replace production settings or secrets. Avoid destructive Git cleanup.

## Deliverables

Provide the verified target/branch and components, reviewed change summary, backup and rollback plan, checks and health results, and any follow-up needed. If deployment was not explicitly approved, stop at a concrete reviewable plan.
