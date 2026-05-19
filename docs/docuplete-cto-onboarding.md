# Docuplete — CTO Onboarding Brief

| | |
|---|---|
| **Prepared** | May 2026 |
| **Author** | Engineering Lead |
| **Audience** | Incoming CTO / Head of Engineering |

This document gives you everything you need to orient yourself on day one. Deeper detail on each topic lives in the linked docs.

---

## What Docuplete does

Docuplete is a **document automation SaaS** for teams that repeatedly fill the same PDF forms. Users upload PDF templates, map form fields to named data points, and conduct guided "interviews" — step-by-step question flows that collect the data and auto-populate the document. The output is a completed, optionally e-signed PDF.

**Core capability loop:**
```
Upload PDF template
  → Map fields (visual drag-and-drop mapper on a PDF canvas)
  → Build a shared field library (reusable data points across packages)
  → Run an interview (collect answers via guided form)
  → Generate filled PDF
  → Request e-signature (optional)
  → Store and deliver the signed document
```

**Who uses it:** Professional services teams — financial advisors, legal, real estate, HR — anyone with high-volume, repetitive document workflows.

**Revenue model:** Monthly SaaS subscription managed through Stripe. Plans gate features and usage limits. Billing portal is self-serve.

---

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind CSS |
| **Backend** | Express 5 + TypeScript, compiled to ESM |
| **Database** | PostgreSQL (managed — Replit dev, Railway prod) |
| **Auth** | Clerk (Replit-managed tenant) — user identity, sessions, MFA, org management |
| **Billing** | Stripe — subscriptions, checkout, billing portal |
| **Object storage** | Google Cloud Storage — PDF templates and generated session PDFs |
| **Email** | Resend — transactional email from `docuplete.com` |
| **Error tracking** | Sentry — API server + frontend exceptions |
| **Monorepo tooling** | pnpm workspaces + TypeScript project references |

---

## Monorepo structure

```
/
├── artifacts/
│   ├── docuplete/           Marketing site (React + Vite) — app.docuplete.com public pages
│   ├── docuplete-docs/      Public documentation site
│   ├── docuplete-roi/       ROI calculator (standalone marketing tool)
│   ├── docuplete-explainer/ Explainer video artifact
│   ├── api-server/          Shared Express API — serves both Docuplete and West Hills Capital
│   └── west-hills-capital/  WHC internal portal + Docuplete app (same React artifact, path-split)
│
├── packages/
│   ├── sdk/                 Node.js SDK for the Docuplete public API
│   ├── python-sdk/          Python SDK
│   ├── mcp-server/          MCP (Model Context Protocol) server integration
│   ├── zapier/              Zapier connector
│   └── make/                Make.com connector
│
└── docs/                    Internal documentation (you are here)
```

> **Note:** The Docuplete app (`app.docuplete.com`) and the West Hills Capital internal portal share a single React + Vite artifact (`artifacts/west-hills-capital`). They are split at the routing layer — Docuplete app pages live under `src/pages/app/`, WHC pages elsewhere. This is a known consolidation that can be separated when team size warrants it.

---

## Infrastructure and environments

| Environment | Hosting | Database | Secrets |
|---|---|---|---|
| **Development** | Replit | Replit-managed PostgreSQL | Replit Secrets panel |
| **Production** | Railway | Railway PostgreSQL (or Replit-managed) | Railway Environment tab |

**Deploy path:**
```
Code change in Replit
  → Push to GitHub (main branch)
  → Railway detects push and auto-deploys the API server
  → Frontend artifacts deployed via Replit publish
```

There is no staging environment today — changes go from development directly to production. This is the highest-priority infrastructure gap to address as the team grows.

See [`docs/deployment.md`](deployment.md) for the full CI/CD setup including branch protection and Railway configuration.

---

## Key integrations at a glance

| Service | Purpose | Credential location | Contacts |
|---|---|---|---|
| **Clerk** | User auth, sessions, MFA, org management | Replit Secrets: `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` | Replit-managed Clerk console |
| **Stripe** | Subscription billing and checkout | Replit/Railway: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe dashboard |
| **Google Cloud Storage** | PDF template and session PDF storage | Replit/Railway: GCS service account credentials | GCP console |
| **Resend** | Transactional email (`docuplete.com` domain) | Replit/Railway: `RESEND_API_KEY` | resend.com dashboard |
| **Sentry** | Error tracking and alerting | Replit/Railway: `SENTRY_DSN` | sentry.io |
| **GitHub** | Source code, CI, Dependabot alerts | GitHub org: `WestHillsCapital/WestHillsCapital` | github.com |
| **Railway** | Production hosting, env vars, logs | railway.app account | Engineering Lead |

All credentials live in Replit Secrets (dev) or Railway environment variables (prod). **Nothing is committed to source code.** See [`docs/systems-account-registry.md`](systems-account-registry.md) for the full credential inventory with rotation schedules.

---

## Security and compliance status (SOC 2)

Docuplete is in active SOC 2 preparation. What is in place:

| Area | Status |
|---|---|
| **Audit log** | Full audit trail of all user actions (35 event types), IP capture, Clerk auth events, export API with date-range filter |
| **Encryption** | AES-256-GCM at field level for sensitive data; `ENCRYPTION_MASTER_KEY` in Railway |
| **Security policies** | Full policy suite in `docs/policies/` — Information Security, Acceptable Use, Data Classification, Access Control, Log Retention |
| **Vendor inventory** | All sub-processors documented with DPA status in [`docs/vendor-inventory.md`](vendor-inventory.md) |
| **Incident response plan** | Documented in [`docs/incident-response-plan.md`](incident-response-plan.md) |
| **Business continuity / DR** | Documented in [`docs/business-continuity-plan.md`](business-continuity-plan.md) |
| **Penetration testing** | Scope defined in [`docs/pentest-scope.md`](pentest-scope.md); first test not yet scheduled |
| **Security training** | Content and tracking in [`docs/security-training.md`](security-training.md) |
| **Access reviews** | Policy in place (quarterly cadence); first formal review not yet completed |
| **MFA** | Enforced for users via Clerk; vendor console MFA confirmation outstanding (see systems-account-registry) |

---

## Known gaps and open items (inherit these on day one)

| Item | Risk | Priority |
|---|---|---|
| **No staging environment** | All changes go directly to production | High |
| **"Last rotated" dates unknown** for all API keys | Cannot demonstrate rotation cadence to auditors | High |
| **MFA confirmation pending** on Replit, Railway, Clerk, Stripe, Resend consoles | SOC 2 CC6.1 gap | High |
| **Several vendor DPAs unconfirmed** (Clerk, Sentry, Resend, Railway) | GDPR/SOC 2 CC9.2 gap | Medium |
| **No automated test suite** | Regressions caught manually only | Medium |
| **Penetration test not yet scheduled** | Required for SOC 2 CC7.1 | Medium |
| **PDF AcroForm flatten** implemented (May 2026) — monitor for edge cases | Flat PDFs cannot be re-edited by recipients | Low |

The full known technical debt list (WHC-focused but partially shared infrastructure) is in [`docs/technical-debt.md`](technical-debt.md).

---

## Day-one access checklist

Request access to the following before you start:

- [ ] GitHub org — `WestHillsCapital/WestHillsCapital` (repository access)
- [ ] Replit workspace — Collaborator access (development environment, Secrets panel)
- [ ] Railway — team member access (production deployment, environment variables, logs)
- [ ] Clerk dashboard — team member access (user management, audit logs)
- [ ] Stripe dashboard — team member access (subscription management)
- [ ] Sentry — team member access (error tracking)
- [ ] Resend — team member access (email delivery logs, domain management)
- [ ] GCP console — viewer or owner access (GCS bucket, service account management)

Enable MFA on **every** vendor console account on day one.

---

## Key docs to read next

| Document | What it covers |
|---|---|
| [`docs/README.md`](README.md) | West Hills Capital system overview (sibling product sharing the same infra) |
| [`docs/architecture.md`](architecture.md) | Full system topology, route structure, data flows |
| [`docs/deployment.md`](deployment.md) | CI/CD pipeline, Railway setup, branch protection |
| [`docs/systems-account-registry.md`](systems-account-registry.md) | Every system account — credentials, owners, rotation schedules |
| [`docs/vendor-inventory.md`](vendor-inventory.md) | All sub-processors with SOC 2 and DPA status |
| [`docs/policies/`](policies/) | Full security policy suite |
| [`docs/incident-response-plan.md`](incident-response-plan.md) | How to handle security incidents |
| [`docs/environment-variables.md`](environment-variables.md) | Full list of environment variables and what breaks without each one |
