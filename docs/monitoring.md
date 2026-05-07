# Monitoring & Alerting

---

## Error tracking — Sentry

The API server reports errors to Sentry via `@sentry/node`.

| Setting | Value |
|---|---|
| Organization | `joe-airesearch` |
| Project | `node-express` |
| DSN | Set via `SENTRY_DSN` secret (required for error reporting) |
| SDK init | `artifacts/api-server/src/instrument.ts` |

The Sentry integration captures:
- All unhandled Express errors (via `Sentry.setupExpressErrorHandler`)
- Unhandled promise rejections and uncaught exceptions
- Manually captured exceptions from the fulfillment and tracking schedulers

---

## Production alert rule

A Sentry alert rule fires an **email notification** the moment a new error is
first seen in the **production** environment.

| Field | Value |
|---|---|
| Rule name | New issue in production — email alert |
| Rule ID | `17022848` |
| Trigger | A new issue is created (`FirstSeenEventCondition`) |
| Environment | `production` |
| Notification target | Issue Owners → fallback: Active Members (`joeairesearch@gmail.com`) |
| Max frequency | Once per 60 minutes per issue |
| Status | Active |

There is also a default Sentry rule (ID `16955445`) that fires on high-priority
issues regardless of environment. The production rule above was added to
guarantee email delivery for all new issues in production specifically.

---

## Testing the alert pipeline end-to-end

1. Deploy or confirm the API server is running in the `production` environment
   (i.e. `NODE_ENV=production` so Sentry tags events with `environment:production`).
2. Open the Super Admin panel (`/internal/super-admin`).
3. Use the **"Trigger Sentry test error"** button (calls `GET /api/debug-sentry`,
   which is gated behind internal auth).
4. Wait up to 5 minutes — an email should arrive at `joeairesearch@gmail.com`.
5. Confirm the issue appears in the Sentry dashboard under the `production`
   environment filter.

Alternatively, verify via the Sentry API:

```bash
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/projects/joe-airesearch/node-express/rules/17022848/" \
  | python3 -m json.tool
```

---

## Relevant files

| File | Purpose |
|---|---|
| `artifacts/api-server/src/instrument.ts` | Sentry SDK init, reads `SENTRY_DSN` |
| `artifacts/api-server/src/app.ts` | `setupExpressErrorHandler`, debug-sentry route |
| `artifacts/api-server/src/index.ts` | Scheduler error capture, unhandled rejection capture |
| `artifacts/west-hills-capital/src/pages/internal/SuperAdmin.tsx` | Test error buttons |
