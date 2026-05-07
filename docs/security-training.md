# Security Awareness Training Program

| | |
|---|---|
| **Version** | 1.0 |
| **Effective date** | May 2026 |
| **Last reviewed** | May 2026 |
| **Next review due** | May 2027 |
| **Policy owner** | Engineering Lead |
| **SOC 2 controls** | CC1.4, CC2.2 |

---

## 1. Purpose

This document defines the organization's security awareness training program. All personnel with access to company systems or customer data must complete security training before being granted access and annually thereafter. The program ensures that everyone understands their security responsibilities and knows how to recognize and respond to threats.

---

## 2. Scope and audience

| Audience | Requirement |
|---|---|
| Full-time employees | Initial training within 3 days of hire; annual renewal |
| Contractors and consultants with system access | Initial training before access is granted; annual renewal for ongoing engagements |
| Business owners and non-technical staff with access to the internal portal | Initial training within 3 days of access being granted; annual renewal |

Individuals who complete training must sign the acknowledgment at the bottom of this document (or a copy of it).

---

## 3. Training curriculum

Each training cycle covers the following topics. The full training content is in [`docs/security-training-content.md`](security-training-content.md).

| Module | Topic | Approx. time |
|---|---|---|
| 1 | Recognizing phishing and social engineering | 15 min |
| 2 | Password management and passphrases | 10 min |
| 3 | Multi-factor authentication (MFA) | 10 min |
| 4 | Secure device usage | 10 min |
| 5 | Data classification and handling | 15 min |
| 6 | Acceptable use of company systems and AI tools | 10 min |
| 7 | Incident reporting — what to do and who to call | 10 min |

**Total estimated time: ~80 minutes**

Training is self-directed: each person reads the training content document, completes the quiz at the end of each module (if applicable), and signs the acknowledgment.

---

## 4. Frequency

| Trigger | Action |
|---|---|
| **New hire / new contractor** | Complete all 7 modules before system access is granted |
| **Annual renewal** | Complete all 7 modules within the renewal window (within 30 days of the anniversary of the last completion) |
| **After a security incident** | Engineering Lead may require targeted re-training for any team member involved in or affected by the incident |
| **Material policy change** | Engineering Lead notifies the team; team members re-read the relevant sections and re-sign the acknowledgment within 14 days |

---

## 5. Completion tracking

All team members must be listed below. The Engineering Lead updates this table after each training cycle.

> Replace placeholder rows with actual team members before the first SOC 2 audit.

| Name | Role | Initial training date | Last annual renewal | Next renewal due | Status |
|---|---|---|---|---|---|
| [Engineering Lead name] | Engineering Lead | [Date] | [Date or N/A] | [Date] | ✓ Current |
| [Team member name] | [Role] | [Date] | [Date or N/A] | [Date] | ✓ Current |
| [Contractor name] | Contractor | [Date] | [Date or N/A] | [Date] | ✓ Current |

**Status key:**
- **✓ Current** — training is up to date
- **⚠ Due within 30 days** — renewal is approaching
- **✗ Overdue** — access should be suspended until training is completed

The Engineering Lead reviews this table quarterly as part of the access review process (see [Access Control Policy](policies/access-control-policy.md)).

---

## 6. Delivery method

Training is currently self-directed reading of `docs/security-training-content.md`, supplemented by team discussion. For a small team, a 60–90 minute synchronous review session is recommended over a standalone asynchronous approach, as it allows questions and shared context.

**Suggested annual training session format:**
1. Each team member reads `security-training-content.md` in advance (1 hour)
2. Team meets for a 30-minute discussion session covering recent incidents, any changes to the policy suite, and questions
3. Each person signs the acknowledgment and the Engineering Lead records the completion date in Section 5

---

## 7. Onboarding checklist

New team members must complete the following security steps before being granted access to production systems:

- [ ] Read `docs/security-training-content.md` (all 7 modules)
- [ ] Read `docs/policies/information-security-policy.md`
- [ ] Read `docs/policies/acceptable-use-policy.md`
- [ ] Read `docs/policies/data-classification-policy.md`
- [ ] Read `docs/policies/access-control-policy.md`
- [ ] Sign the acknowledgment in Section 8 below and provide a copy to the Engineering Lead
- [ ] Enable MFA on their GitHub account
- [ ] Enable MFA on their Replit account (if applicable)
- [ ] Set up a password manager for work credentials
- [ ] Confirm their device meets the requirements in the Acceptable Use Policy (Section 5 of that document)

The Engineering Lead updates the completion tracking table in Section 5 and records the date access was provisioned.

---

## 8. Training acknowledgment template

> Copy the text below, complete the fields, and return to the Engineering Lead (printed, or as a digitally signed PDF, or as a confirmed email).

---

**Security Awareness Training Acknowledgment**

I, **[Full name]**, confirm that on **[Date]** I read and understood the following documents:

- `docs/security-training-content.md` (all 7 modules, version dated [date of document])
- `docs/policies/information-security-policy.md`
- `docs/policies/acceptable-use-policy.md`
- `docs/policies/data-classification-policy.md`
- `docs/policies/access-control-policy.md`

I understand my responsibilities under these policies, including:
- Protecting customer data and company credentials
- Reporting suspected security incidents immediately to the Engineering Lead
- Not sharing passwords, API keys, or other credentials with anyone
- Handling customer data in accordance with the Data Classification Policy
- Complying with the Acceptable Use Policy at all times

**Signature:** ______________________

**Date:** ______________________

**Role:** ______________________

---

## 9. Program review

This program is reviewed annually by the Engineering Lead. After each review:
- Update the training content in `security-training-content.md` to reflect new threats, policy changes, or lessons learned from security incidents
- Update the "Last reviewed" and "Next review due" dates at the top of this document
- Commit the updated documents to the `main` branch
