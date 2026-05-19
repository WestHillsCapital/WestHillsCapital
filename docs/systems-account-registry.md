# Systems Account Registry

| | |
|---|---|
| **Version** | 1.0 |
| **Effective date** | May 2026 |
| **Last reviewed** | May 2026 |
| **Next review due** | May 2027 |
| **Policy owner** | Engineering Lead |
| **SOC 2 controls** | CC6.2, CC6.3 |

---

## 1. Purpose

This registry inventories every non-human (system) account used to operate the Docuplete platform and West Hills Capital systems. A *system account* is any credential, service account, API key, OAuth client, or bot identity that acts autonomously — i.e., not tied to a single named human logging in interactively.

Each entry records what the account is, why it exists, who is responsible for it, its privilege level, whether MFA applies, and when credentials must be rotated. This document is the authoritative source for access-control reviews under CC6.2 (logical access provisioning) and CC6.3 (access removal and modification).

**Human accounts** (individual staff logins with named owners, reviewed via Clerk user management and INTERNAL_ALLOWED_EMAILS) are out of scope here but are reviewed as part of the quarterly access review process.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| **Service account** | A non-human identity created for a specific application or automated process |
| **API key** | A static secret used to authenticate requests to a third-party service |
| **OAuth client** | A client ID + secret pair that allows our application to request OAuth tokens |
| **Privilege level** | The maximum access the credential can exercise: Read-only / Read-write / Admin |
| **Owner** | The named individual responsible for this credential — reviews it, authorises rotation, and is the escalation contact |
| **MFA** | Whether multi-factor authentication protects the underlying vendor console account that manages this credential |

---

## 3. Account registry

### 3.1 Infrastructure

---

#### INFRA-001 — Replit Owner Account

| Field | Value |
|---|---|
| **Account type** | Human-managed platform account (owner seat) |
| **Vendor / system** | Replit |
| **Credential type** | Username + password + Replit SSO |
| **Privilege level** | Owner — full access to source code, production secrets, managed PostgreSQL, object storage, and deployment configuration |
| **Business justification** | Required to manage the development environment, production Replit deployments, database, and Secrets panel for both Docuplete and West Hills Capital |
| **Owner** | Engineering Lead |
| **MFA enforced** | Confirm — Replit supports TOTP-based 2FA; verify it is enabled on this account |
| **Rotation schedule** | Password reviewed annually; immediate rotation required on any suspected compromise |
| **Last rotated** | Unknown — confirm and document |
| **Last reviewed** | May 2026 |
| **Notes / actions** | Limit the number of people with Owner access. Any additional team members should be added as Collaborators with scoped permissions, not as additional Owner accounts. |

---

#### INFRA-002 — Railway Production Account

| Field | Value |
|---|---|
| **Account type** | Human-managed platform account |
| **Vendor / system** | Railway |
| **Credential type** | Username + password + Railway SSO |
| **Privilege level** | Admin — full access to production API server, environment variables (including `DATABASE_URL` and `ENCRYPTION_MASTER_KEY`), deployment logs, and Redis |
| **Business justification** | Required to manage production deployments, set production environment variables, and monitor the API server |
| **Owner** | Engineering Lead |
| **MFA enforced** | Confirm — Railway supports 2FA; verify it is enabled |
| **Rotation schedule** | Password reviewed annually; immediate rotation on any suspected compromise |
| **Last rotated** | Unknown — confirm and document |
| **Last reviewed** | May 2026 |
| **Notes / actions** | Treat Railway credentials as Restricted — anyone with access can read all production secrets. Confirm whether Railway supports team-level scoped access and consider limiting who holds Admin rights. |

---

#### INFRA-003 — GitHub Repository Access (`WestHillsCapital/WestHillsCapital`)

| Field | Value |
|---|---|
| **Account type** | Repository + organisation account |
| **Vendor / system** | GitHub (Microsoft) |
| **Credential type** | GitHub account (owner); deploy keys or GitHub Actions tokens for CI |
| **Privilege level** | Owner — full repository access, CI/CD pipeline, branch protection settings |
| **Business justification** | Source code hosting, CI/CD automation (Railway auto-deploy on push), Dependabot security alerts |
| **Owner** | Engineering Lead |
| **MFA enforced** | GitHub requires MFA for organisation members; confirm it is enforced at the org level |
| **Rotation schedule** | Personal access tokens (PATs) expire annually if configured; review GitHub Actions secrets annually |
| **Last rotated** | Unknown — confirm any PATs or deploy keys |
| **Last reviewed** | May 2026 |
| **Notes / actions** | Confirm that no long-lived PATs with write access are committed or stored outside GitHub Secrets. Review which GitHub Actions secrets are in use. |

---

### 3.2 Google service account

---

#### GOOGLE-001 — Google Service Account (Sheets / Calendar / Drive)

| Field | Value |
|---|---|
| **Account type** | GCP service account (non-human) |
| **Vendor / system** | Google Cloud Platform |
| **Credential type** | Service account JSON key — stored as `GOOGLE_SERVICE_ACCOUNT_KEY` environment secret |
| **Privilege level** | Read-write — Editor on Google Sheets spreadsheets; Writer on Google Drive deals folder; Calendar event creation rights on the booking calendar |
| **Business justification** | Enables automated CRM sync (leads, appointments, deals, operations tabs), appointment event creation, blocker calendar reads, and invoice PDF upload to Google Drive for West Hills Capital |
| **Owner** | Engineering Lead |
| **MFA enforced** | N/A — service accounts do not log in interactively; the underlying GCP project owner account should have MFA enabled |
| **Rotation schedule** | Service account JSON key rotated **annually** or immediately on any suspected compromise or staff departure; new key generated in GCP console and old key deleted |
| **Last rotated** | Unknown — confirm and document |
| **Last reviewed** | May 2026 |
| **Scoped resources** | `GOOGLE_SHEETS_SPREADSHEET_ID` (master CRM), `GOOGLE_DEAL_BUILDER_SHEET_ID`, `GOOGLE_DEALS_OPS_SHEET_ID`, `GOOGLE_BOOKING_CALENDAR_ID`, `GOOGLE_BLOCKER_CALENDAR_IDS`, `GOOGLE_DRIVE_DEALS_FOLDER_ID` |
| **Notes / actions** | Follow least-privilege: share the service account only on the specific spreadsheets and folders it needs, not on entire Google Workspace. Confirm the GCP project owner account has MFA. Consider transitioning to Workload Identity Federation to avoid long-lived JSON keys. |

---

#### GOOGLE-002 — Google OAuth Client (Internal Portal)

| Field | Value |
|---|---|
| **Account type** | OAuth 2.0 client credential |
| **Vendor / system** | Google Cloud Platform (Google Identity) |
| **Credential type** | OAuth client ID — stored as `GOOGLE_CLIENT_ID` environment secret |
| **Privilege level** | Read-only identity — only reads the authenticated user's email address to validate against `INTERNAL_ALLOWED_EMAILS` |
| **Business justification** | Powers "Sign in with Google" on the `/internal` portal for West Hills Capital staff; gates all internal-only routes |
| **Owner** | Engineering Lead |
| **MFA enforced** | N/A for the client credential itself; individual staff Google accounts should have MFA enforced via Google Workspace |
| **Rotation schedule** | Client secret reviewed annually; rotate immediately if the GCP project is compromised |
| **Last rotated** | Unknown — confirm and document |
| **Last reviewed** | May 2026 |
| **Notes / actions** | Authorised redirect URIs in the GCP console must be kept in sync with any domain changes. The `INTERNAL_ALLOWED_EMAILS` allowlist must be reviewed whenever staff join or leave. |

---

### 3.3 Authentication (Docuplete)

---

#### AUTH-001 — Clerk Application (Docuplete)

| Field | Value |
|---|---|
| **Account type** | SaaS managed identity — Replit-managed Clerk tenant |
| **Vendor / system** | Clerk |
| **Credential type** | Clerk secret key (server-side) + publishable key (client-side); webhook signing secret (`CLERK_WEBHOOK_SECRET`) |
| **Privilege level** | Admin — creates and manages user records, sessions, MFA state, and OAuth tokens for all Docuplete product users |
| **Business justification** | Provides user authentication, session management, MFA enforcement, and SSO for the Docuplete SaaS product |
| **Owner** | Engineering Lead |
| **MFA enforced** | Clerk dashboard access — confirm MFA is enabled on the Clerk console account; customer-facing MFA enforcement is configurable per organisation |
| **Rotation schedule** | Clerk secret key rotated annually or on any suspected compromise; webhook signing secret rotated whenever the webhook endpoint changes |
| **Last rotated** | Unknown — confirm and document |
| **Last reviewed** | May 2026 |
| **Notes / actions** | Confirm Clerk secret key is not exposed in any client-side bundle or repository. Review Clerk's audit log periodically for unusual sign-in patterns. Webhook signing secret must be validated on every inbound webhook (already implemented in `clerkWebhookHandlers.ts`). |

---

### 3.4 Payment processing

---

#### PAY-001 — Stripe API Key (Docuplete Billing)

| Field | Value |
|---|---|
| **Account type** | API key (restricted) |
| **Vendor / system** | Stripe |
| **Credential type** | Stripe secret key (server-side); webhook endpoint signing secret |
| **Privilege level** | Read-write — creates and manages subscriptions, checkout sessions, customer records, and billing portal sessions. Does not have access to raw payment card data (Stripe-managed). |
| **Business justification** | Powers Docuplete subscription billing — plan checkout, upgrades, downgrades, cancellations, and billing portal |
| **Owner** | Engineering Lead |
| **MFA enforced** | Confirm — Stripe dashboard requires 2FA for all team members; verify it is enforced |
| **Rotation schedule** | Stripe secret key rotated annually; webhook signing secret rotated if endpoint URL changes or on any compromise |
| **Last rotated** | Unknown — confirm and document |
| **Last reviewed** | May 2026 |
| **Notes / actions** | Use restricted keys scoped to only the required Stripe API resources rather than a full secret key if feasible. Webhook signing secret validation must be in place on all Stripe webhook routes (verify in `stripeBillingSync.ts`). |

---

### 3.5 Trade execution (West Hills Capital)

---

#### TRADE-001 — Dillon Gage / Fiztrade API Key

| Field | Value |
|---|---|
| **Account type** | API key |
| **Vendor / system** | Dillon Gage International (Fiztrade) |
| **Credential type** | Static API key — stored as `DILLON_GAGE_API_KEY` environment secret |
| **Privilege level** | Read-write — lock spot prices, execute live trades, retrieve shipping status. Incorrect or unauthorised use results in real financial transactions. |
| **Business justification** | Required for live precious metals deal execution (LockPrices + ExecuteTrade) and automated shipping status polling for West Hills Capital |
| **Owner** | Engineering Lead (technical); Joe (business owner) |
| **MFA enforced** | Unknown — confirm with Dillon Gage account representative whether Fiztrade console access requires MFA |
| **Rotation schedule** | Rotate **annually** or immediately on any suspected compromise or staff departure. Coordinate rotation with Dillon Gage support. |
| **Last rotated** | Unknown — confirm and document |
| **Last reviewed** | May 2026 |
| **Notes / actions** | This is the highest-risk credential in the West Hills Capital system — it can trigger real financial transactions. Ensure `FIZTRADE_DRY_RUN=true` is set in all non-production environments. Restrict access to the Replit/Railway secret to the minimum number of people necessary. Contact Dillon Gage representative to confirm whether key-level audit logs are available. |

---

### 3.6 Email delivery

---

#### EMAIL-001 — Resend API Key

| Field | Value |
|---|---|
| **Account type** | API key |
| **Vendor / system** | Resend |
| **Credential type** | Static API key — stored as `RESEND_API_KEY` environment secret |
| **Privilege level** | Read-write — send transactional email from verified `westhillscapital.com` and `docuplete.com` domains; read email delivery and bounce logs |
| **Business justification** | Delivers all transactional email for both Docuplete (interview links, notifications, billing receipts) and West Hills Capital (appointment confirmations, deal recap, shipping updates, follow-ups) |
| **Owner** | Engineering Lead |
| **MFA enforced** | Confirm — Resend dashboard 2FA status; verify it is enabled |
| **Rotation schedule** | Rotated annually or immediately on any suspected compromise |
| **Last rotated** | Unknown — confirm and document |
| **Last reviewed** | May 2026 |
| **Notes / actions** | A compromised Resend key could be used to send email from verified company domains. Confirm whether Resend supports scoped API keys (send-only vs. full access) and use the most restricted scope available. |

---

### 3.7 Object storage

---

#### STORAGE-001 — Google Cloud Storage Credentials

| Field | Value |
|---|---|
| **Account type** | GCP service account (same as GOOGLE-001, or a dedicated storage service account) |
| **Vendor / system** | Google Cloud Storage |
| **Credential type** | Service account credentials (JSON key or Workload Identity) used for GCS bucket access |
| **Privilege level** | Read-write — upload, read, and delete objects in the Docuplete PDF bucket (`pdfs/` prefix for templates; `signed-pdfs/` prefix for generated session PDFs) |
| **Business justification** | Required for storing customer-uploaded PDF templates and serving generated session PDFs for Docuplete |
| **Owner** | Engineering Lead |
| **MFA enforced** | N/A — service account; GCP project owner account should have MFA |
| **Rotation schedule** | Annually, in sync with GOOGLE-001 if using the same key |
| **Last rotated** | Unknown — confirm and document |
| **Last reviewed** | May 2026 |
| **Notes / actions** | Confirm whether this uses a dedicated GCS-scoped service account or shares the GOOGLE-001 key. Prefer a dedicated account scoped only to the storage bucket. Confirm bucket-level IAM does not grant public read access. |

---

### 3.8 Error tracking

---

#### OBS-001 — Sentry DSN

| Field | Value |
|---|---|
| **Account type** | Project credential (DSN) |
| **Vendor / system** | Sentry |
| **Credential type** | Sentry DSN (Data Source Name) — embedded in application build; also auth token for API access stored separately |
| **Privilege level** | Write — ingests error events into the Sentry project; Sentry auth token (if used) allows reading and managing events |
| **Business justification** | Real-time error capture and alerting for the API server and frontend applications |
| **Owner** | Engineering Lead |
| **MFA enforced** | Confirm — Sentry dashboard 2FA; verify it is enabled for all team members |
| **Rotation schedule** | DSN rotated if the project is compromised or a team member with access departs; auth token (if any) rotated annually |
| **Last rotated** | Unknown — confirm and document |
| **Last reviewed** | May 2026 |
| **Notes / actions** | The DSN is embedded in the client-side build and is considered semi-public (Sentry rate-limits abuse). The server-side auth token, if present, must be kept secret. Confirm PII scrubbing is configured in Sentry to avoid capturing customer email addresses in stack traces. |

---

## 4. Summary table

| ID | Account | Vendor | Type | Privilege | Owner | MFA | Rotation |
|---|---|---|---|---|---|---|---|
| INFRA-001 | Replit Owner Account | Replit | Platform account | Owner | Engineering Lead | Confirm | Annual |
| INFRA-002 | Railway Production Account | Railway | Platform account | Admin | Engineering Lead | Confirm | Annual |
| INFRA-003 | GitHub Repository | GitHub | Repo + org account | Owner | Engineering Lead | Org-enforced | Annual (PATs) |
| GOOGLE-001 | Google Service Account | GCP | Service account key | Read-write | Engineering Lead | N/A | Annual |
| GOOGLE-002 | Google OAuth Client | GCP | OAuth client credential | Read identity | Engineering Lead | N/A | Annual |
| AUTH-001 | Clerk Application | Clerk | SaaS managed | Admin | Engineering Lead | Confirm | Annual |
| PAY-001 | Stripe API Key | Stripe | API key | Read-write | Engineering Lead | Confirm | Annual |
| TRADE-001 | Dillon Gage API Key | Fiztrade | API key | Read-write (financial) | Engineering Lead / Joe | Confirm | Annual |
| EMAIL-001 | Resend API Key | Resend | API key | Read-write | Engineering Lead | Confirm | Annual |
| STORAGE-001 | GCS Credentials | Google Cloud | Service account key | Read-write | Engineering Lead | N/A | Annual |
| OBS-001 | Sentry DSN | Sentry | Project DSN | Write (ingest) | Engineering Lead | Confirm | Annual |

---

## 5. Onboarding and offboarding procedures

### Adding a new system account

1. Confirm business justification with the Engineering Lead before creating the credential.
2. Apply least-privilege — request only the permissions the system needs, not admin-level access.
3. Add an entry to this registry before or immediately after the account is created.
4. Store the credential in Replit Secrets (development) or Railway environment variables (production). Never commit to source code.
5. Document the rotation schedule and set a calendar reminder for the next review.

### Removing a system account

1. Revoke or delete the credential at the vendor console immediately.
2. Remove the corresponding environment secret from Replit and Railway.
3. Mark the entry in this registry as decommissioned with the date.
4. Verify no code paths still reference the revoked credential.

---

## 6. Annual review checklist

At each annual review, the Engineering Lead must:

- [ ] Confirm each credential is still actively needed — remove any orphaned accounts
- [ ] Verify MFA is enabled on all vendor console accounts marked "Confirm"
- [ ] Confirm the named Owner for each account is still current (update on org changes)
- [ ] Rotate any credentials that have not been rotated within their schedule
- [ ] Update the "Last rotated" date for any credentials rotated during the review
- [ ] Cross-reference with `vendor-inventory.md` — any new vendor should have a corresponding entry here if a system account was created
- [ ] Update "Last reviewed" and "Next review due" dates at the top of this document

---

## 7. Document history

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | May 2026 | Engineering Lead | Initial registry |
