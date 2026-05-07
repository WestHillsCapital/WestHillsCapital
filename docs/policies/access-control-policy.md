# Access Control Policy

| | |
|---|---|
| **Version** | 1.0 |
| **Effective date** | May 2026 |
| **Last reviewed** | May 2026 |
| **Next review due** | May 2027 |
| **Policy owner** | Engineering Lead |
| **SOC 2 controls** | CC6.1, CC6.2, CC6.3 |

---

## 1. Purpose

This policy defines how access to company systems and customer data is provisioned, maintained, reviewed, and revoked, based on the principle of least privilege. It covers every access surface used to operate the Docuplete platform and West Hills Capital business.

---

## 2. Scope

All employees, contractors, and automated service accounts that have any form of access to company systems — including production infrastructure, the source code repository, cloud services, and the Postgres database.

---

## 3. Guiding principles

- **Least privilege** — Access is granted only to the minimum level required to perform a specific function. No blanket admin access is granted by default.
- **Individual accountability** — Every person or system has their own credential. Shared accounts are prohibited.
- **Access review** — All access is reviewed quarterly. Access that cannot be justified is revoked.
- **Prompt de-provisioning** — Access is revoked within one business day of a team member's departure or role change.

---

## 4. Access surfaces and roles

### 4.1 Product access — Clerk (Docuplete platform)

The Docuplete platform uses Clerk for authentication. Every Docuplete organization account has its own isolated tenant. Within an account:

| Role | Capabilities |
|---|---|
| `admin` | Full access to packages, sessions, billing, team management, API keys, and organization settings |
| `member` | Access to packages and sessions; cannot manage team members, API keys, or billing |

**Provisioning:** New users are invited by an admin within their organization. The Docuplete staff does not provision individual end-user accounts.

**Internal portal access:** The internal staff portal is restricted by `INTERNAL_ALLOWED_EMAILS` — a comma-separated list of authorized staff email addresses set as an environment variable. Any Clerk sign-in not on this list is denied access to internal routes.

**De-provisioning:** When a Docuplete staff member leaves, their email is removed from `INTERNAL_ALLOWED_EMAILS` within one business day. Existing Clerk sessions for that email are force-expired via the Clerk dashboard.

### 4.2 API key access — product API (Docuplete)

API keys are issued per Docuplete account for programmatic access to the public API:

- Keys are shown to the user **once** at creation; the SHA-256 hash is stored. Plaintext is never persisted.
- Keys can be named and revoked individually from the account settings UI.
- All key creation and revocation events are recorded in the `org_audit_log` as critical audit events.
- API keys grant access only to data within the issuing account — cross-account access via API key is impossible by design.

**De-provisioning:** API keys are revoked by account admins. When an account is cancelled or purged, all associated API keys are functionally invalidated because the account data is removed.

### 4.3 Infrastructure — Railway

Railway hosts the API server and worker processes:

- Access is limited to employees with an explicit need to manage production infrastructure.
- The Railway project should have no more than 2 team members with admin access.
- Railway service environment variables (production secrets) are visible only to Railway team members.
- Access is granted by the Railway project owner and reviewed quarterly.

**De-provisioning:** Departing team members are removed from the Railway project within one business day. If they had access to production secrets, all affected secrets are rotated within 24 hours.

### 4.4 Infrastructure — Replit

Replit hosts the development environment and manages the Secrets panel shared between development and (for some configurations) production:

- Access is limited to employees actively working on development.
- Production secrets stored in Replit Secrets are visible to all Replit workspace collaborators — minimize the number of collaborators with workspace access.
- Access is granted by the Replit workspace owner and reviewed quarterly.

**De-provisioning:** Departing team members are removed from the Replit workspace within one business day.

### 4.5 Source code — GitHub

The `WestHillsCapital/WestHillsCapital` GitHub repository is protected by branch protection rules (see `docs/deployment.md`):

| Permission level | Who holds it |
|---|---|
| Admin | Engineering Lead only |
| Write (push / PR merge) | All active developers |
| Read | Any team member who needs to read the code |

- No direct pushes to `main` are permitted. All changes require a PR with at least one approved review and a passing CI run.
- Repository secrets (used by GitHub Actions CI) are managed by the repository admin.

**De-provisioning:** Departing team members are removed from the GitHub repository within one business day. If they held admin access, repository secrets are rotated.

### 4.6 Third-party services (Sentry, Clerk, Stripe, Resend, Google Cloud)

- Access to third-party service dashboards is limited to team members with a specific operational need.
- All accounts use multi-factor authentication where the service supports it.
- Service account credentials (API keys, OAuth tokens) are stored in Railway environment variables or Replit Secrets — not in code or plain-text files.
- Departing team members are removed from all third-party service dashboards within one business day. Shared service API keys are rotated if a departing member had access to them.

---

## 5. Provisioning procedure

When a new team member joins or a contractor is engaged:

1. Engineering Lead determines which systems the person requires access to based on their role.
2. Access is provisioned individually for each system (no shared credentials).
3. The person is briefed on the [Acceptable Use Policy](acceptable-use-policy.md) and acknowledges it in writing before being granted access.
4. Access is documented in the quarterly access review record.

---

## 6. De-provisioning procedure

When a team member leaves or changes role:

1. Engineering Lead or delegated administrator revokes all system access within **one business day** of the departure or role change.
2. For departing team members with access to production secrets: rotate all secrets they had access to within **24 hours**.
3. Run `node artifacts/api-server/scripts/rotate-master-key.mjs` if the departing member had access to `ENCRYPTION_MASTER_KEY` (see `docs/deployment.md` → Encryption key rotation).
4. Remove them from: GitHub repository, Railway project, Replit workspace, Clerk dashboard, Sentry organization, and any other third-party service they had access to.
5. Record the de-provisioning in the quarterly access review log.

---

## 7. Quarterly access review

The Engineering Lead conducts a quarterly access review of all systems listed in Section 4. The review:

1. Lists all current access holders for each system.
2. Verifies that each person still requires the access level they hold.
3. Revokes any access that cannot be justified.
4. Documents the review outcome (date, reviewer, systems reviewed, changes made).

The review record is stored in `docs/access-reviews/YYYY-QN.md` and committed to the `main` branch.

---

## 8. Emergency access

If emergency access to a production system is required outside the normal provisioning process (e.g., during a P0 incident), the Engineering Lead may grant temporary access. This access must be:

- Time-limited (revoked within 24 hours or immediately after the incident is resolved)
- Documented in the incident post-mortem

---

## 9. Policy review

This policy is reviewed annually. The Engineering Lead updates the access surface inventory in Section 4 whenever a new system is introduced or an existing one is retired.
