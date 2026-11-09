---
name: d2print-backend
description: Use when inspecting, designing, debugging, or changing D2Print Django models, Django REST Framework APIs, validation, persistence, migrations, or backend performance.
---

# D2Print backend engineering

## Activate when

A task involves Django models or relationships, DRF serializers, API views/viewsets, URL routing, authentication or permissions, PostgreSQL behavior, migrations, backend tests, API debugging, or query performance.

## Procedure

1. Read repository guidance and inspect `git status --short`. Locate the existing model, serializer, view, URL, settings, migration, and test files relevant to the request. Read their callers and current API contract before editing.
2. Trace relationships and behavior through existing code. Check field options (`null`, `blank`, `unique`, defaults, validators), related names, delete behavior, constraints, and any existing data assumptions. In Django, `null` controls database NULL while `blank` controls validation; empty strings and NULL are distinct, especially for unique fields. Match existing conventions deliberately.
3. Make the smallest compatible change. Preserve endpoint paths, methods, response shapes, permissions, and established status/error behavior unless the request explicitly changes them. Keep validation at the correct boundary and enforce important invariants at the database layer where appropriate.
4. For writes spanning related rows, assess `transaction.atomic`, locking, race conditions, idempotency, and rollback behavior. For schema changes, inspect migration history and data volume/compatibility; create reversible migrations where practical. Never apply production migrations without explicit approval.
5. Add or update focused automated tests for successful, invalid, unauthorized, boundary, and relationship cases. Use the project’s existing test conventions; do not rely on a live production database.
6. Check query counts and access patterns. Use `select_related`/`prefetch_related` or aggregation only when they fit the actual relationship and measured endpoint behavior.
7. Run the narrow relevant tests and available static/system checks. Inspect the final diff and report changed files, checks run, and any unverified behavior.

## Investigation notes

- Debug API requests from route to permission/authentication, view, serializer, model/database, then response. Record the exact request shape and sanitized error evidence.
- For PostgreSQL constraint errors, identify the constraint and the write path; do not weaken integrity rules merely to suppress an exception.
- Do not print credentials, token values, or secret settings while inspecting configuration.

## Safety and deliverables

Do not delete data or modify unrelated work. Do not run destructive SQL, production migrations, production service restarts, or deployment without explicit approval. Deliver a focused implementation, relevant tests or checks, and a concise explanation of compatibility and migration implications.
