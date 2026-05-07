# Data Classification Policy

| | |
|---|---|
| **Version** | 1.0 |
| **Effective date** | May 2026 |
| **Last reviewed** | May 2026 |
| **Next review due** | May 2027 |
| **Policy owner** | Engineering Lead |
| **SOC 2 controls** | CC3.2, CC6.1, CC6.5 |

---

## 1. Purpose

This policy establishes a framework for classifying data based on its sensitivity, so that appropriate handling, storage, transmission, and disposal controls can be applied consistently. Every type of data processed by the organization is assigned to one of four tiers.

---

## 2. Scope

This policy covers all data created, received, maintained, or transmitted by the organization in connection with the Docuplete platform, the West Hills Capital business, and all supporting infrastructure.

---

## 3. Classification tiers

### Tier 1 — Restricted

The highest sensitivity tier. Unauthorized disclosure would directly harm customers or the business, create regulatory liability, or enable system compromise.

**Handling requirements:**
- Encrypt at rest (AES-256-GCM with per-account DEK) and in transit (TLS 1.2+)
- Access strictly limited to the systems and individuals with a specific need
- Never transmitted by email or messaging in plaintext
- Disposal: securely zero-out or cryptographically erase; document disposal
- Log all access in the audit trail

### Tier 2 — Confidential

Sensitive business or customer data not intended for public disclosure. Unauthorized disclosure could harm customers or the business but does not reach the threshold of Restricted.

**Handling requirements:**
- Encrypt in transit (TLS 1.2+); encrypt at rest where technically feasible
- Shared only with employees, contractors, and sub-processors who have a legitimate need
- Not transmitted to unauthorized third parties
- Disposal: delete from all storage systems when no longer needed

### Tier 3 — Internal

Internal business information not intended for external audiences. Disclosure would be embarrassing or operationally disruptive but would not directly harm customers.

**Handling requirements:**
- Not published publicly
- Shared only within the organization and with authorized contractors
- Standard access controls; no special encryption requirement beyond TLS in transit

### Tier 4 — Public

Information intentionally made public. No restrictions on distribution.

**Handling requirements:**
- Verify content is intentionally public before publishing
- No special handling required after publication

---

## 4. Data inventory and classification

### Customer / end-user data

| Data type | Tier | Storage location | Notes |
|---|---|---|---|
| Interview answers (submitted field values) | **Restricted** | PostgreSQL `docufill_interview_sessions.answers_ciphertext` | AES-256-GCM encrypted per account |
| Template PDF files | **Restricted** | Google Cloud Storage (`pdfs/`) + PostgreSQL fallback (`pdf_data_ciphertext`) | Encrypted at rest (GCS-managed + AES-256-GCM for DB fallback) |
| Generated / signed session PDFs | **Restricted** | Google Cloud Storage (`signed-pdfs/`) | GCS at-rest encryption |
| Customer PII in prefill data (name, email, DOB, address) | **Restricted** | PostgreSQL `docufill_interview_sessions.prefill` | Stored as JSONB; consider encrypting in a future sprint |
| E-sign signer identity (email, IP, user agent, geo) | **Restricted** | PostgreSQL `docufill_interview_sessions` columns | Retained for legal validity of signatures |
| E-sign OTP (one-time verification code) | **Restricted** | PostgreSQL `docufill_interview_sessions.otp_hash` | Stored as bcrypt hash; plaintext never persisted |
| PDF SHA-256 hash + RFC 3161 timestamp token | **Confidential** | PostgreSQL `pdf_sha256`, `tsa_token_b64` | Non-reversible; needed for tamper evidence |

### Authentication and access control

| Data type | Tier | Storage location | Notes |
|---|---|---|---|
| `ENCRYPTION_MASTER_KEY` | **Restricted** | Replit Secrets / Railway env vars | Must never appear in logs, code, or git history |
| `DATABASE_URL` (production) | **Restricted** | Replit Secrets / Railway env vars | Grants full DB access |
| API keys (hashed) | **Restricted** | PostgreSQL `api_keys.key_hash` | SHA-256 hashed; plaintext shown only once at creation |
| API key plaintext (transient) | **Restricted** | In-memory only, never persisted | Shown to user once on creation; not logged |
| Clerk user JWT / session tokens | **Restricted** | Client browser (HttpOnly cookie) | Validated by Clerk on each request |
| Internal session tokens | **Restricted** | PostgreSQL `internal_sessions`; browser cookie | Expire automatically; pruned by scheduler |
| Trusted device tokens | **Confidential** | PostgreSQL `trusted_devices.token_hash` | Hashed; used for 2FA bypass on recognized devices |

### Stripe and payment data

| Data type | Tier | Storage location | Notes |
|---|---|---|---|
| Stripe customer ID, subscription ID | **Confidential** | PostgreSQL `accounts` | Stripe-side identifiers; no card data stored locally |
| Stripe webhook payload | **Confidential** | Validated in-memory; not persisted | Verified via Stripe webhook signature |

### Infrastructure and operational

| Data type | Tier | Storage location | Notes |
|---|---|---|---|
| Application logs (pino/Railway) | **Internal** | Railway log storage | May contain email addresses in error context; retain 12 months |
| Sentry error events | **Confidential** | Sentry (cloud) | May contain stack traces with partial PII; scrubbed by Sentry before storage |
| Audit log (`org_audit_log`) | **Confidential** | PostgreSQL | Actor email, IP, action; retain 12 months minimum |
| Login history (`user_login_history`) | **Confidential** | PostgreSQL | IP address, user agent; retain 90 days |
| Webhook delivery logs | **Internal** | PostgreSQL `webhook_deliveries` | Request/response payloads; retain 90 days |
| PDF audit events (`pdf_audit_events`) | **Confidential** | PostgreSQL | Actor, document, timestamp; retain 12 months |
| Spot price history | **Internal** | PostgreSQL `spot_price_history` | Market data; no PII |
| `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, third-party service API keys | **Restricted** | Replit Secrets / Railway env vars | Treated as credentials |

### Public data

| Data type | Tier | Storage location |
|---|---|---|
| Marketing site content (West Hills Capital public pages) | **Public** | Vite build artifacts |
| Docuplete marketing site (docuplete.com) | **Public** | Vite build artifacts |
| API reference documentation | **Public** | `docs/api-reference.md` |
| Spot price quotes (displayed on public site) | **Public** | In-memory cache; `spot_price_history` |
| Published article content | **Public** | PostgreSQL `content_articles` (status = published) |

---

## 5. Handling rules by tier

| Control | Restricted | Confidential | Internal | Public |
|---|---|---|---|---|
| Encrypt at rest | Required (AES-256-GCM) | Required where feasible | Not required | Not required |
| Encrypt in transit | Required (TLS 1.2+) | Required (TLS 1.2+) | Required (TLS 1.2+) | Recommended |
| Access control | Strict need-to-know | Role-based; logged | Organization-wide | Open |
| Audit logging | Required | Required for changes | Recommended | Not required |
| Email / messaging | Never in plaintext | Avoid; encrypt if required | Allowed internally | Allowed |
| Third-party sharing | Prohibited without DPA | Allowed with DPA | Allowed with NDA | Freely shareable |
| Retention / disposal | Per retention schedule; secure erase | Per retention schedule; delete when done | Per retention schedule | Indefinite |

---

## 6. Data handling violations

Handling data at a level below its classification tier (e.g., transmitting Restricted data in plaintext email) is a policy violation and must be reported to the Engineering Lead. Depending on the data involved, the violation may trigger the [Incident Response Plan](../incident-response-plan.md).

---

## 7. Policy review

This policy is reviewed annually. The data inventory in Section 4 is updated whenever a new data type is introduced or an existing one is moved, deleted, or re-classified. The Engineering Lead is responsible for keeping this inventory current.
