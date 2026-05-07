# Acceptable Use Policy

| | |
|---|---|
| **Version** | 1.0 |
| **Effective date** | May 2026 |
| **Last reviewed** | May 2026 |
| **Next review due** | May 2027 |
| **Policy owner** | Engineering Lead |
| **SOC 2 controls** | CC1.4, CC6.1, CC6.6 |

---

## 1. Purpose

This policy defines acceptable and prohibited uses of company systems, devices, accounts, and data. Its goal is to protect the organization and its customers from security risks arising from inappropriate or negligent use of technology resources.

---

## 2. Scope

This policy applies to all employees, contractors, and consultants who use any company-owned or personally-owned device to access company systems, cloud services, or customer data — regardless of location.

"Company systems" includes, but is not limited to:
- Source code repository (GitHub — `WestHillsCapital/WestHillsCapital`)
- Production and development infrastructure (Railway, Replit)
- Cloud services (Google Cloud Storage, Redis)
- Authentication provider (Clerk)
- Error tracking (Sentry)
- Email delivery (Resend)
- Payment processing (Stripe)
- Any service with access to production secrets or customer data

---

## 3. Acceptable use

Users may:

- Access company systems for legitimate business purposes during the course of their work
- Use company-provisioned credentials on personal devices when following the personal device rules in Section 5
- Store work-related files in company-approved locations (GitHub repository, Google Drive, Railway environment variables)
- Report security concerns or policy questions to the Engineering Lead without fear of retaliation

---

## 4. Prohibited activities

The following activities are strictly prohibited:

### 4.1 Credential and access management

- Sharing personal credentials (GitHub, Clerk, Railway, Replit, Stripe) with any other person, including colleagues
- Storing production secrets, API keys, or database URLs in plain text in any location not specifically designed for secrets management (e.g. in code files, Slack messages, email, notes apps, browser history)
- Using a shared or generic account instead of individually provisioned credentials
- Accessing customer data outside the scope of a specific assigned task

### 4.2 Data handling

- Downloading or exporting customer PII or submitted interview answers outside the systems designed to hold them without explicit written authorization
- Sending unencrypted customer data over email or messaging platforms
- Uploading customer data to unauthorized third-party services, AI tools, or personal cloud storage
- Circumventing or disabling encryption or access controls on company systems

### 4.3 Systems and infrastructure

- Deploying code directly to production without a passing CI run and an approved pull request (except as permitted by the hotfix bypass procedure documented in `docs/deployment.md`)
- Disabling or removing security controls (Sentry error tracking, audit logging, TLS enforcement) without Engineering Lead approval and documentation
- Installing unauthorized software on company systems or creating unauthorized integrations with production infrastructure
- Attempting to access systems, accounts, or data beyond what is required for the current task (even if technically reachable)

### 4.4 General conduct

- Using company systems for illegal activity of any kind
- Using company email or accounts to send spam or phishing messages
- Misrepresenting identity or affiliation in communications

---

## 5. Personal device use

Employees and contractors who access company systems from personally-owned devices must:

- Keep the device operating system and browser updated to a supported version
- Use a password-protected user account (not a shared family account) on the device
- Enable full-disk encryption (FileVault on macOS, BitLocker on Windows, or equivalent)
- Use a reputable password manager rather than storing credentials in browser auto-fill or plain-text files
- Lock the device automatically after a maximum of 5 minutes of inactivity
- Not allow other household members to use the device while company accounts are logged in

---

## 6. Acceptable use of AI tools

- AI-assisted coding tools (e.g. GitHub Copilot, Claude, ChatGPT) may be used for development tasks
- Do NOT paste real customer data, production secrets, database contents, or PII into any AI tool's input
- Review all AI-generated code for security issues before committing — AI tools can suggest insecure patterns
- Be aware that inputs to cloud-hosted AI tools may be stored and used for model training depending on the provider's terms

---

## 7. Monitoring

The organization reserves the right to monitor access to company systems for security purposes, including review of audit logs, login history, and Railway/Sentry logs. Monitoring is limited to company systems and is not performed on personal communications.

---

## 8. Reporting violations

Anyone who suspects a policy violation or a security incident should report it to the Engineering Lead immediately. Reports made in good faith will not result in retaliation. Confirmed violations are investigated per the [Incident Response Plan](../incident-response-plan.md).

---

## 9. Enforcement

Violations may result in immediate revocation of access and disciplinary action up to and including termination. Violations involving customer data may additionally have legal consequences.

---

## 10. Policy review

This policy is reviewed annually. After each review, the "Last reviewed" and "Next review due" dates at the top of this document are updated and committed to the `main` branch.
