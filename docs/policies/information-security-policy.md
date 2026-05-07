# Information Security Policy

| | |
|---|---|
| **Version** | 1.0 |
| **Effective date** | May 2026 |
| **Last reviewed** | May 2026 |
| **Next review due** | May 2027 |
| **Policy owner** | Engineering Lead |
| **SOC 2 controls** | CC1.1, CC1.2, CC1.3, CC1.4, CC1.5 |

---

## 1. Purpose

This policy establishes the organization's commitment to protecting the confidentiality, integrity, and availability of information assets — including customer data processed through the Docuplete platform and the West Hills Capital internal portal. It defines the guiding principles that all other security policies, procedures, and controls must support.

---

## 2. Scope

This policy applies to:

- All employees, contractors, and consultants who access company systems or data
- All company-owned and personally-owned devices used to access company resources
- All cloud services, infrastructure, and third-party platforms used to operate the business (Railway, Replit, Google Cloud Storage, Clerk, Sentry, Stripe, Resend, Redis)
- All customer data processed, stored, or transmitted by any company system

---

## 3. Policy statement

The organization will:

1. **Protect customer data** — Implement technical and organizational controls to protect personally identifiable information (PII), financial data, and submitted document content from unauthorized access, disclosure, or loss.

2. **Apply the principle of least privilege** — Grant access to systems and data only to the extent required to perform a specific job function. Access is provisioned individually and reviewed quarterly.

3. **Encrypt sensitive data** — Encrypt sensitive data at rest using AES-256-GCM with per-account Data Encryption Keys (DEKs). Encrypt all data in transit using TLS 1.2 or higher.

4. **Manage vulnerabilities** — Run automated dependency audits on every deployment (`pnpm audit --audit-level=high`) and remediate high or critical vulnerabilities before releasing to production.

5. **Log and monitor** — Maintain audit logs for security-relevant events (authentication, access control changes, data exports, API key issuance). Retain security logs for a minimum of 12 months.

6. **Respond to incidents** — Follow the [Incident Response Plan](../incident-response-plan.md) for detecting, containing, and recovering from security incidents, including notifying affected customers within 72 hours of a confirmed breach.

7. **Manage third-party risk** — Evaluate and document sub-processors and third-party vendors. Ensure contractual data processing agreements are in place where required by applicable regulations.

8. **Train staff** — Provide security awareness training to all team members at least annually. Ensure this policy and related policies are reviewed and acknowledged by all staff.

9. **Review continuously** — Review this policy and all subsidiary policies annually, or after any significant change to the technical environment or after a P0/P1 security incident.

---

## 4. Guiding security principles

| Principle | Implementation |
|---|---|
| Confidentiality | PII encrypted at rest (AES-256-GCM DEK); TLS in transit; Clerk authentication enforced on all internal routes |
| Integrity | Immutable audit log (`org_audit_log`); critical audit writes re-throw on failure; PDF SHA-256 hashes stored alongside signed documents |
| Availability | Railway managed infrastructure; BullMQ retry logic; automated health check at `GET /api/health`; database connection pooling with timeouts |
| Least privilege | Role-based access (admin / member) in Clerk; API keys scoped per-account; internal portal restricted by `INTERNAL_ALLOWED_EMAILS` |
| Accountability | All security-sensitive actions recorded in the audit log with actor identity, timestamp, and IP address |

---

## 5. Roles and responsibilities

| Role | Responsibilities |
|---|---|
| **Engineering Lead** | Owns this policy and all subsidiary security policies; approves changes to security controls; chairs the annual security review |
| **All employees** | Read, understand, and comply with this policy and all subsidiary policies; report suspected incidents or policy violations immediately |
| **Contractors / consultants** | Bound by this policy via contractual agreement; complete security onboarding before being granted system access |

---

## 6. Related documents

- [Acceptable Use Policy](acceptable-use-policy.md)
- [Data Classification Policy](data-classification-policy.md)
- [Access Control Policy](access-control-policy.md)
- [Log Retention Policy](log-retention-policy.md)
- [Incident Response Plan](../incident-response-plan.md)
- [Deployment Guide](../deployment.md)

---

## 7. Compliance and enforcement

Violations of this policy may result in disciplinary action up to and including termination of employment or contract. Violations that affect customer data may additionally trigger regulatory notification obligations and legal liability. The Engineering Lead is responsible for investigating reported violations and determining the appropriate response.

---

## 8. Policy review

This policy is reviewed annually by the Engineering Lead and acknowledged by all staff. After each review, the "Last reviewed" and "Next review due" dates at the top of this document are updated and the change is committed to the `main` branch of the repository.
