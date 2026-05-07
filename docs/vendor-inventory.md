# Vendor Inventory & Sub-Processor Register

| | |
|---|---|
| **Version** | 1.0 |
| **Effective date** | May 2026 |
| **Last reviewed** | May 2026 |
| **Next review due** | May 2027 |
| **Policy owner** | Engineering Lead |
| **SOC 2 controls** | CC9.2 |

---

## 1. Purpose

This document inventories every third-party vendor and sub-processor that has access to, stores, or processes company or customer data. It records each vendor's compliance status, Data Processing Agreement (DPA) status, and the data they can access. It is updated whenever a new vendor is onboarded or an existing one is removed.

A **sub-processor** is any third party that processes personal data on behalf of the organization — including infrastructure providers, authentication services, monitoring tools, and payment processors.

---

## 2. Sub-processor register

### 2.1 Infrastructure and hosting

#### Replit

| Field | Value |
|---|---|
| **Category** | Infrastructure — development environment, production hosting, managed PostgreSQL, managed object storage |
| **Data accessed** | Full production database (PostgreSQL); all object storage (template PDFs, generated PDFs via GCS sidecar); all source code; production secrets (via Secrets panel) |
| **Data classification** | Restricted |
| **SOC 2 status** | SOC 2 Type II (see trust page) |
| **Trust / compliance page** | https://replit.com/security |
| **DPA status** | Review whether a DPA is available via Replit's enterprise terms; confirm before expanding PII processing |
| **Last reviewed** | May 2026 |

#### Railway

| Field | Value |
|---|---|
| **Category** | Infrastructure — production API server hosting, worker process hosting, managed PostgreSQL (production option), managed Redis |
| **Data accessed** | Production application logs (pino/stdout); environment variables including `DATABASE_URL`, `ENCRYPTION_MASTER_KEY`, and other production secrets; Redis job queue contents |
| **Data classification** | Restricted (secrets exposure surface); Confidential (logs) |
| **SOC 2 status** | SOC 2 Type II |
| **Trust / compliance page** | https://railway.app/security |
| **DPA status** | DPA available at https://railway.app/legal/dpa — **confirm signing status** |
| **Last reviewed** | May 2026 |

#### Google Cloud Storage (GCS)

| Field | Value |
|---|---|
| **Category** | Object storage — template PDFs and generated/signed session PDFs |
| **Data accessed** | All template PDF files uploaded by users (`pdfs/` prefix); all generated session PDFs (`signed-pdfs/` prefix); content is Restricted-tier customer data |
| **Data classification** | Restricted |
| **SOC 2 status** | SOC 2 Type II; also ISO 27001, ISO 27017, ISO 27018, FedRAMP |
| **Trust / compliance page** | https://cloud.google.com/security/compliance |
| **DPA status** | Covered by Google Cloud Data Processing Addendum (DPA) — included in Google Cloud Terms of Service; **confirm DPA has been accepted** |
| **Last reviewed** | May 2026 |

### 2.2 Authentication and identity

#### Clerk

| Field | Value |
|---|---|
| **Category** | Authentication — user identity, session management, MFA, OAuth provider management |
| **Data accessed** | User email addresses, Clerk user IDs, session tokens, MFA state, OAuth tokens (Google, etc.) for Docuplete product users and internal portal staff |
| **Data classification** | Restricted |
| **SOC 2 status** | SOC 2 Type II |
| **Trust / compliance page** | https://clerk.com/security |
| **DPA status** | DPA available at https://clerk.com/legal/dpa — **confirm signing status** |
| **Last reviewed** | May 2026 |

### 2.3 Payments and billing

#### Stripe

| Field | Value |
|---|---|
| **Category** | Payment processing — subscription billing, checkout, invoice management |
| **Data accessed** | Customer name, email, billing address, Stripe customer and subscription IDs; payment method tokens (Stripe-managed — no raw card data ever reaches our servers). Webhook payloads contain subscription lifecycle events. |
| **Data classification** | Confidential (Stripe-side identifiers); Restricted (customer billing identity) |
| **SOC 2 status** | SOC 2 Type II; PCI DSS Level 1; ISO 27001 |
| **Trust / compliance page** | https://stripe.com/docs/security |
| **DPA status** | Covered by Stripe's Data Processing Agreement — included in Stripe Services Agreement; **confirm acceptance** |
| **Last reviewed** | May 2026 |

### 2.4 Error tracking and observability

#### Sentry

| Field | Value |
|---|---|
| **Category** | Error tracking — JavaScript/TypeScript exception capture, stack traces, structured error events |
| **Data accessed** | Application stack traces, error messages, logger context fields. Context may include actor email addresses from pino log fields. Sentry's data scrubbing is enabled but does not guarantee full PII removal from all stack traces. |
| **Data classification** | Confidential |
| **SOC 2 status** | SOC 2 Type II |
| **Trust / compliance page** | https://sentry.io/security/ |
| **DPA status** | DPA available at https://sentry.io/legal/dpa/ — **confirm signing status** |
| **PII risk note** | Review Sentry's data scrubbing / PII scrubbing configuration annually. Ensure `SENTRY_DSN` is only set for the production environment and events are not being forwarded to unapproved regions. |
| **Last reviewed** | May 2026 |

### 2.5 Email delivery

#### Resend

| Field | Value |
|---|---|
| **Category** | Transactional email — interview invitation links, appointment confirmations, shipping notifications, system notifications |
| **Data accessed** | Recipient email addresses, first and last names, appointment details, deal status information included in email bodies |
| **Data classification** | Confidential |
| **SOC 2 status** | SOC 2 Type II (in progress; verify current status on trust page) |
| **Trust / compliance page** | https://resend.com/security |
| **DPA status** | DPA available — **confirm signing status via Resend account settings or legal contact** |
| **Last reviewed** | May 2026 |

### 2.6 Source code and CI/CD

#### GitHub (Microsoft)

| Field | Value |
|---|---|
| **Category** | Source code repository, CI/CD pipeline (`WestHillsCapital/WestHillsCapital`) |
| **Data accessed** | All application source code; GitHub Actions CI logs (may contain build-time environment information); Dependabot security alerts |
| **Data classification** | Internal (source code); no customer PII should ever appear in the repository |
| **SOC 2 status** | SOC 2 Type II; ISO 27001 |
| **Trust / compliance page** | https://github.com/security |
| **DPA status** | Covered by GitHub Data Protection Agreement — included in GitHub Terms of Service for organizational accounts |
| **Last reviewed** | May 2026 |

### 2.7 Optional account-level storage integrations

The following providers are connected only at account-holder request and only process PDF data that the account holder has explicitly routed to their own cloud storage. These are **optional**, not used for core platform operations.

#### Google Drive (Google LLC)

| Field | Value |
|---|---|
| **Category** | Optional document storage — accounts can connect their Google Drive to receive generated session PDFs |
| **Data accessed** | Generated PDF content routed to the user's own Google Drive folder (using their OAuth token) |
| **Data classification** | Restricted |
| **SOC 2 status** | SOC 2 Type II; ISO 27001 |
| **Trust / compliance page** | https://cloud.google.com/security/compliance |
| **DPA status** | Data is written to the account holder's own Google Drive under their credentials. Google's standard DPA applies to Google Workspace accounts. |
| **Last reviewed** | May 2026 |

#### Microsoft OneDrive (Microsoft Corporation)

| Field | Value |
|---|---|
| **Category** | Optional document storage — accounts can connect their OneDrive to receive generated session PDFs |
| **Data accessed** | Generated PDF content routed to the user's own OneDrive folder (using their OAuth token) |
| **Data classification** | Restricted |
| **SOC 2 status** | SOC 2 Type II; ISO 27001 |
| **Trust / compliance page** | https://www.microsoft.com/en-us/trust-center |
| **DPA status** | Data is written to the account holder's own OneDrive under their credentials. Microsoft's standard DPA applies to Microsoft 365 accounts. |
| **Last reviewed** | May 2026 |

#### Dropbox

| Field | Value |
|---|---|
| **Category** | Optional document storage — accounts can connect their Dropbox to receive generated session PDFs |
| **Data accessed** | Generated PDF content routed to the user's own Dropbox folder (using their OAuth token) |
| **Data classification** | Restricted |
| **SOC 2 status** | SOC 2 Type II; ISO 27001 |
| **Trust / compliance page** | https://www.dropbox.com/security |
| **DPA status** | Data is written to the account holder's own Dropbox under their credentials. **Confirm whether Dropbox's Business Associate Agreement or DPA is required for GDPR compliance.** |
| **Last reviewed** | May 2026 |

### 2.8 Fulfillment and logistics (West Hills Capital)

#### Dillon Gage International

| Field | Value |
|---|---|
| **Category** | Precious metals wholesaler — deal fulfillment, tracking number retrieval |
| **Data accessed** | Deal details including customer name, shipping address, product selection, deal amounts. API credentials stored in `FIZTRADE_API_KEY`. |
| **Data classification** | Confidential |
| **SOC 2 status** | Not publicly available — assess via direct vendor questionnaire |
| **Trust / compliance page** | https://www.dillongage.com |
| **DPA status** | **Outstanding — confirm whether a DPA or data handling agreement is in place** |
| **Last reviewed** | May 2026 |

#### FedEx

| Field | Value |
|---|---|
| **Category** | Shipping logistics — tracking number resolution and shipment status |
| **Data accessed** | Tracking numbers; shipping address data included in shipment records |
| **Data classification** | Confidential |
| **SOC 2 status** | Not publicly available |
| **Trust / compliance page** | https://www.fedex.com/en-us/data-privacy-overview.html |
| **DPA status** | **Outstanding — confirm whether a DPA is required for the data exchanged** |
| **Last reviewed** | May 2026 |

---

## 3. DPA status summary

| Vendor | DPA status |
|---|---|
| Replit | Confirm whether enterprise DPA is available and signed |
| Railway | DPA available — **confirm signed** |
| Google Cloud Storage | DPA included in Google Cloud ToS — **confirm accepted** |
| Clerk | DPA available — **confirm signed** |
| Stripe | DPA included in Stripe ToS — **confirm accepted** |
| Sentry | DPA available — **confirm signed** |
| Resend | DPA available — **confirm signed** |
| GitHub | DPA included in GitHub ToS for org accounts |
| Dillon Gage | **Outstanding — assess and obtain** |
| FedEx | **Outstanding — assess whether required** |

---

## 4. Vendor review procedure

This procedure must be followed before any new vendor is granted access to production systems or customer data.

### 4.1 Evaluation checklist

Before onboarding a new vendor, the Engineering Lead must verify:

| Check | Requirement |
|---|---|
| **Data access scope** | Identify exactly what data the vendor will access and its classification tier (see [Data Classification Policy](policies/data-classification-policy.md)) |
| **SOC 2 report** | Obtain and review the vendor's current SOC 2 Type II report (or equivalent: ISO 27001 + Type I report at minimum). If unavailable, complete a security questionnaire instead. |
| **DPA / data processing agreement** | If the vendor will process personal data of EU residents or PII of any customer, a DPA is required before onboarding. Obtain the vendor's standard DPA or negotiate a custom one. |
| **Sub-processor disclosure** | Determine whether the vendor uses its own sub-processors for the data in question and confirm those sub-processors are disclosed in their DPA or privacy policy. |
| **Data residency** | Confirm the region(s) where the vendor will store or process data. Ensure this is compatible with any contractual or regulatory requirements. |
| **Incident notification** | Confirm the vendor's contractual commitment to notify us in case of a security breach affecting our data. GDPR Article 33 requires our notification to supervisory authorities within 72 hours of becoming aware — vendor notification must allow time for this. |
| **Encryption** | Confirm that data is encrypted at rest and in transit within the vendor's infrastructure. |
| **Access control** | Confirm the vendor uses MFA for administrative access and that access to our data is limited to staff with a business need. |

### 4.2 Approval

1. The Engineering Lead reviews the completed checklist.
2. If the vendor passes all checks: add the vendor to this document and proceed with onboarding.
3. If the vendor fails any critical check (no SOC 2 report, no DPA offered, no encryption): escalate to the business owner for a risk acceptance decision before onboarding. Document the decision in writing.

### 4.3 Ongoing review

- All vendors in this register are reviewed **annually** (see "Next review due" at the top of this document).
- At each annual review: verify the vendor's compliance certifications are current, confirm the DPA is still in effect, and review any security incidents the vendor has disclosed.
- If a vendor is removed, revoke all credentials, API keys, or OAuth tokens immediately and document the removal.

---

## 5. Document history

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | May 2026 | Engineering Lead | Initial inventory |
