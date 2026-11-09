---
name: d2print-frontend
description: Use when inspecting, building, debugging, or changing D2Print React screens, components, hooks, routing, Axios integration, authentication UI, styles, or frontend behavior.
---

# D2Print frontend engineering

## Activate when

A task touches React components or hooks, React Router, Axios API calls, authentication/token handling, searchable selection components, customer/order forms, manager or worker dashboards, delivery/billing interfaces, responsive layout, CSS, or frontend tests/builds.

## Procedure

1. Read repository guidance, inspect `git status --short`, and identify the actual app structure, package scripts, route map, API client, auth flow, shared components, styles, and tests. Read the existing screen and all callers before editing.
2. Trace the user journey and corresponding backend contract. Confirm field names, response shapes, permissions, and status values from code. Preserve existing navigation, UI patterns, and API compatibility unless a redesign or behavior change is requested.
3. Make a small, focused change. Reuse established components and hooks; keep state and effects predictable; prevent stale requests or duplicate submissions where relevant. Keep tokens in the existing secure handling path and never log them.
4. For forms and searchable selectors, preserve current validation and relation IDs; handle loading, no-results, empty, error, and success states. Prevent users from submitting stale or incomplete selections.
5. Check accessibility and responsive behavior: labels, keyboard operation, focus, readable feedback, and layouts at supported widths. Keep styling changes scoped and consistent with existing CSS conventions.
6. Add or update focused tests when the project has a test setup. Run relevant tests and the repository’s frontend build or lint command when available. Report unavailable checks rather than claiming success.
7. Review the diff and confirm no unrelated files or generated artifacts changed.

## Feature-specific checks

- Customer and order forms: inspect customer selection, product properties, order items, validation, totals, and edit/create parity.
- Manager and worker dashboards: verify role-gated access, task queues, state refresh, and empty/error cases.
- Delivery and billing: verify status prerequisites and consistency with backend transitions.
- Axios/auth: inspect interceptors, token refresh/expiry behavior, base URL configuration, and sanitized error handling.

## Safety and deliverables

Preserve the existing UI unless redesign is requested. Do not expose credentials or make unrelated application changes. Deliver the focused UI/API integration change, relevant verification results, and any known limitation.
