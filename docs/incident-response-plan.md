# Incident Response Plan

| | |
|---|---|
| **Last reviewed** | May 2026 |
| **Next review due** | May 2027 |
| **Owner** | Engineering Lead |
| **SOC 2 controls** | CC7.3, CC7.4, CC7.5 |

---

## 1. Purpose and scope

This plan defines how the team detects, contains, investigates, notifies affected parties about, and recovers from security incidents and significant operational outages affecting the Docuplete platform and the West Hills Capital internal portal.

An **incident** is any event — confirmed or suspected — that:

- Compromises the confidentiality, integrity, or availability of customer data
- Disrupts production services for a material period
- Violates applicable laws, regulations, or contractual obligations
- Results from unauthorized access, malware, or misuse of credentials

This plan does not cover minor bugs or planned maintenance windows.

---

## 2. Severity classification

| Tier | Name | Criteria | Target response | Target resolution |
|---|---|---|---|---|
| **P0** | Critical | Data breach confirmed; ransomware or destructive attack; complete service outage > 15 min; unauthorized access to production database or secrets | Immediate (< 15 min) | 4 hours |
| **P1** | High | Suspected (unconfirmed) data breach; partial service degradation affecting > 50% of users; authentication bypass; key/secret exposure | < 1 hour | 8 hours |
| **P2** | Medium | Non-PII data exposure; service degradation affecting < 50% of users; failed security control (e.g., audit log write failure); single-account data anomaly | < 4 hours | 24 hours |
| **P3** | Low | Isolated error spike; performance regression; failed scheduled job with no data loss; policy violation with no user impact | Next business day | 72 hours |

### Severity examples

| Example | Tier |
|---|---|
| `ENCRYPTION_MASTER_KEY` leaked to a public repository | P0 |
| PostgreSQL `DATABASE_URL` exposed in logs | P0 |
| API server completely unresponsive | P0 |
| Sentry spike: 500 errors on all authenticated routes | P1 |
| Unauthorized Clerk user accessing another account's data | P0 |
| Single customer reports they can see another customer's submissions | P1 |
| BullMQ worker dead — webhooks and PDF generation queued but not processing | P2 |
| `insertAuditLog` critical write failed (logged in Sentry) | P2 |
| Prune job failed; expired sessions not deleted on schedule | P3 |
| Elevated 4xx rate on a single endpoint | P3 |

---

## 3. Roles and responsibilities

| Role | Person(s) | Responsibilities |
|---|---|---|
| **Incident Commander (IC)** | Engineering Lead (primary); any senior engineer (backup) | Declares incident tier; coordinates response; decides on notifications; owns communication |
| **Technical Lead** | On-call engineer | Investigates, contains, and remediates; provides status updates to IC every 30 min during active P0/P1 |
| **Communications Lead** | Engineering Lead or designated staff | Drafts and sends customer notifications; coordinates with legal/compliance if required |
| **Scribe** | Any available team member | Documents timeline, decisions, and actions taken in a shared incident thread |

For small-team environments the Incident Commander and Technical Lead may be the same person.

---

## 4. Detection sources and tooling

| Source | What to watch | How to access |
|---|---|---|
| **Sentry** | JavaScript/TypeScript exceptions; unhandled promise rejections; `logger.error` calls that include error objects; `[Encryption]` decryption failures; critical audit log write failures | Sentry dashboard — configured via `SENTRY_DSN` / `VITE_SENTRY_DSN` |
| **Railway logs** | API server stdout/stderr (pino JSON); worker process logs; crash/restart events | Railway project → service → Logs tab |
| **Pino structured logs** | `[DocuFill]` errors; `[DemoPackage]` errors; `[Queue]` failures; `[Audit]` failures; `[Encryption]` errors | Pipe Railway logs through `pino-pretty` for human-readable output during an incident |
| **Clerk dashboard** | Suspicious sign-in patterns; brute-force attempts; session anomalies | clerk.com dashboard |
| **Customer reports** | Direct emails, support tickets, or in-app feedback describing unexpected data or access | Support inbox / shared email |
| **GitHub / CI alerts** | Dependabot high/critical CVE PRs; CI failures blocking deploy | GitHub Notifications; `.github/workflows/ci.yml` |
| **Stripe dashboard** | Unexpected charge disputes; webhook delivery failures | stripe.com dashboard |

### Immediate investigation queries

**Check for recent auth anomalies:**
```sql
SELECT created_at, action, actor_email, ip_address, metadata
  FROM audit_log
 WHERE created_at > NOW() - INTERVAL '1 hour'
   AND action IN ('security.session_revoked', 'security.2fa_disabled', 'apikey.create', 'security.trusted_device_revoked')
 ORDER BY created_at DESC
 LIMIT 50;
```

**Check for recent login history anomalies:**
```sql
SELECT ulh.created_at, ulh.ip_address, ulh.user_agent, au.email
  FROM user_login_history ulh
  JOIN account_users au ON au.clerk_id = ulh.clerk_id
 WHERE ulh.created_at > NOW() - INTERVAL '1 hour'
 ORDER BY ulh.created_at DESC
 LIMIT 50;
```

**Check for accounts with recent data access:**
```sql
SELECT account_id, COUNT(*) AS events
  FROM audit_log
 WHERE created_at > NOW() - INTERVAL '30 minutes'
 GROUP BY account_id
 ORDER BY events DESC
 LIMIT 20;
```

---

## 5. Response playbook

### Step 1 — Detect and triage (< 15 min for P0/P1)

1. Identify the signal (Sentry alert, log spike, customer report, Dependabot CVE).
2. Assign a severity tier using the table in Section 2.
3. The first responder becomes the **Incident Commander** and opens an incident thread (Slack channel, email thread, or shared doc) titled: `[INC-YYYY-MM-DD] <brief description> (P<tier>)`.
4. Notify the rest of the team in the incident thread immediately.

### Step 2 — Contain

**Data breach / unauthorized access:**
- Revoke the compromised credential immediately: rotate `ENCRYPTION_MASTER_KEY`, `DATABASE_URL`, API keys, or Clerk keys as applicable (see `docs/deployment.md` → Encryption key rotation).
- Force-expire all active Clerk sessions for affected accounts if feasible.
- Enable Railway's IP allowlist or take the API server offline if the attack vector is an open endpoint.
- Preserve logs — do not clear Railway log storage before copying evidence.

**Service outage:**
- Identify the failing service (API server, worker, database, GCS) from Railway logs.
- Roll back to the last known-good checkpoint via the Replit checkpoint history if a bad deploy caused the outage (see `docs/deployment.md` → Rollback).
- Restart the affected Railway service if the issue is a crash loop.

**Secret / key exposure:**
- Rotate the exposed secret immediately via Replit's Secrets panel.
- Remove the secret from any public location (git history, logs, issue tracker).
- Run `node artifacts/api-server/scripts/rotate-master-key.mjs` to re-wrap all DEKs under the new master key if `ENCRYPTION_MASTER_KEY` was exposed.

### Step 3 — Assess

1. Determine the full blast radius: which accounts, which data, what time window.
2. Confirm whether customer PII was accessed or exfiltrated.
3. Identify root cause: misconfiguration, code bug, dependency vulnerability, social engineering, or external attack.
4. Preserve evidence: copy relevant Railway log segments and Sentry events to the incident thread before they expire.

### Step 4 — Notify

Notification timelines depend on severity. See Section 6 for details.

### Step 5 — Remediate

1. Apply the fix (code patch, configuration change, key rotation, dependency update).
2. Deploy through the normal CI/CD pipeline unless a hotfix bypass is required (see `docs/deployment.md` → Hotfix bypass procedure).
3. Verify the fix resolves the issue using post-deploy checks.
4. Confirm no residual exposure remains.

### Step 6 — Post-mortem

For every P0 and P1 incident, and for any P2 with significant customer impact, complete a post-mortem within **5 business days** of resolution. See Section 7 for the template.

---

## 6. Notification obligations

### Customer notification

| Scenario | Timeline | Channel |
|---|---|---|
| Confirmed breach of customer PII (names, emails, financial data, submitted answers) | Within **72 hours** of confirmation | Direct email to affected account holders |
| Extended service outage (> 2 hours) | Within **4 hours** of detection | Status page update + direct email to affected accounts |
| Suspected but unconfirmed breach | Notify internally; do not notify customers until confirmed or regulatory deadline requires it | — |

Customer notifications must include:
- What happened (in plain language)
- What data may have been affected
- When it happened (approximate time window)
- What we have done to contain and remediate the issue
- What affected customers should do (e.g., change passwords, watch for phishing)
- A contact address for follow-up questions

### Regulatory notification

- **GDPR (EU residents):** Report confirmed personal data breaches to the relevant supervisory authority within **72 hours** of becoming aware of the breach (Article 33 GDPR).
- **US state laws (CCPA, etc.):** Consult legal counsel to determine notification obligations based on the nature and jurisdiction of affected data.
- When in doubt, involve legal counsel before deciding not to notify.

### Internal escalation

| Tier | Escalation |
|---|---|
| P0 | Notify all team members immediately; contact legal counsel within 2 hours |
| P1 | Notify Engineering Lead and business owner within 1 hour |
| P2/P3 | Document in incident thread; review in next weekly engineering sync |

---

## 7. Post-mortem template

Copy this template into a new document in the `docs/post-mortems/` directory and link it from the incident thread.

```markdown
# Post-Mortem: [INC-YYYY-MM-DD] <title>

**Date of incident:** YYYY-MM-DD
**Severity:** P0 / P1 / P2
**Duration:** HH:MM (from first detection to full resolution)
**Author(s):**
**Review date:**

## Summary
One paragraph describing what happened, what was affected, and how it was resolved.

## Timeline (all times UTC)
| Time | Event |
|---|---|
| HH:MM | First signal detected (Sentry alert / customer report / internal) |
| HH:MM | Incident declared by [name] |
| HH:MM | Containment action taken: [describe] |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Incident resolved; monitoring confirmed normal |

## Root cause
Describe the underlying technical or process failure that caused the incident.

## Impact
- Accounts affected: N
- Data categories affected: [e.g., submitted interview answers, none]
- Customer-visible impact: [e.g., 503 errors for 45 min, no data loss]
- Regulatory notification required: Yes / No

## What went well
- …

## What went wrong
- …

## Action items
| Item | Owner | Due date |
|---|---|---|
| … | … | … |
```

---

## 8. Contact list and escalation path

> Keep this section up to date. Replace placeholder values with real contacts before the first SOC 2 audit.

| Role | Name | Primary contact | Backup contact |
|---|---|---|---|
| Engineering Lead / Incident Commander | [Name] | [email / phone] | [Name, email] |
| Business Owner | [Name] | [email / phone] | — |
| Legal Counsel | [Firm / Name] | [email / phone] | — |
| Sentry Account Admin | [Name] | [email] | — |
| Railway Account Admin | [Name] | [email] | — |
| Clerk Account Admin | [Name] | [email] | — |
| GCS / Google Cloud Admin | [Name] | [email] | — |

### External contacts

| Vendor | Purpose | Contact |
|---|---|---|
| Clerk | Auth provider; report suspected session compromise | security@clerk.com |
| Railway | Infrastructure; report suspected unauthorized access to Railway project | support@railway.app |
| Sentry | Error tracking; export or delete event data | support@sentry.io |
| Google Cloud | GCS; report suspected unauthorized bucket access | cloud.google.com/support |
| Resend | Email delivery; report suspicious activity | support@resend.com |

---

## 9. Plan review and testing

- This plan is reviewed **annually** (see review dates at top of document) or immediately after any P0/P1 incident.
- A tabletop exercise simulating a P1 data breach scenario is conducted once per year as part of the SOC 2 annual review cycle.
- The Engineering Lead is responsible for keeping the contact list (Section 8) current.
- After each review, update the "Last reviewed" and "Next review due" dates at the top of this document and commit the change to the `main` branch.
