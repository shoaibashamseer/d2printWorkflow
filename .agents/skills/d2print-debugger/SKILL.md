---
name: d2print-debugger
description: Use when diagnosing D2Print full-stack failures involving React, browser behavior, Axios, HTTP responses, Django, PostgreSQL, authentication, Gunicorn, Nginx, or deployment.
---

# D2Print full-stack debugging

## Activate when

The user reports a React or browser console error, Axios failure, HTTP 400/401/403/404/500, Django traceback, PostgreSQL IntegrityError, missing database column, serializer error, authentication issue, Gunicorn/Nginx failure, or production deployment error.

## Procedure

1. Gather evidence before proposing a fix: exact user action, sanitized request URL/method/body, timestamp/timezone, response status/body, console or server traceback, and recent relevant changes. Redact credentials, tokens, personal data, and secret configuration.
2. Identify the failing layer by tracing the request: React component/state → Axios client/interceptors → network/proxy → Django URL/auth/permission/view/serializer → ORM/PostgreSQL → response. For service failures, separately inspect systemd/Gunicorn and Nginx evidence using verified service names and paths.
3. Reproduce with the narrowest safe local request or test. Compare expected and actual payloads, types, field names, status transitions, schema/migration state, and permission context. Locate the first causal error rather than treating downstream symptoms.
4. State the root cause and supporting evidence. If evidence is incomplete, name the specific missing evidence and continue non-destructive inspection; do not invent a cause.
5. Make the smallest fix at the responsible layer. Preserve API compatibility and unrelated work. Add a regression test or a repeatable verification step.
6. Verify the original failing path and relevant neighboring cases. Inspect the diff and ensure diagnostic output contains no secrets.

## Common error guides

- 400: inspect serializer/form validation details and actual request types/required fields.
- 401/403: distinguish missing/expired credentials from authenticated-but-forbidden access; inspect client interceptors and server permissions.
- 404: verify route, identifier, and object visibility; avoid assuming the record is absent from all environments.
- 500/traceback: find the first application frame and correlated request; inspect sanitized logs.
- IntegrityError: identify the exact database constraint and conflicting values without exposing sensitive data.
- Missing column: compare model, migration files, and applied migration state in a safe environment. Do not run migrations against production as a diagnostic.
- Gunicorn/Nginx: verify actual unit/config paths, upstream, socket/port, ownership, and logs before suggesting a change.

## Safety and deliverables

Never recommend destructive database commands as diagnostics. Do not expose secrets. Do not restart services, run production migrations, or deploy without explicit approval. Deliver the failing layer, evidence-backed root cause, focused fix, and verification results or clear remaining uncertainty.
