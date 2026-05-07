# Security Awareness Training Content

| | |
|---|---|
| **Version** | 1.0 |
| **Effective date** | May 2026 |
| **Last reviewed** | May 2026 |
| **Next review due** | May 2027 |
| **Audience** | All employees, contractors, and consultants with system access |

Read all seven modules before signing the training acknowledgment in [`docs/security-training.md`](security-training.md). Estimated reading time: ~60–70 minutes.

---

## Module 1 — Recognizing phishing and social engineering

### What is phishing?

Phishing is an attempt by an attacker to trick you into revealing credentials, clicking a malicious link, or taking an action that gives the attacker access to systems or data. Phishing can arrive as email, text messages (smishing), or voice calls (vishing).

### Common phishing patterns to recognize

**Urgency:** "Your account will be suspended in 24 hours unless you verify now." Attackers use urgency to stop you from thinking carefully.

**Authority impersonation:** Emails that appear to come from GitHub, Stripe, Clerk, Railway, Google, or even from a colleague's name (but with a different email address). Always check the actual sender email address, not just the display name.

**Unexpected login prompts:** A browser tab that asks you to re-enter your GitHub or Google password when you didn't initiate a login. This is a classic credential-harvesting technique.

**Lookalike domains:** `raitway.app`, `githubb.com`, `cIerk.com` (capital i instead of l). Inspect URLs carefully before entering credentials.

**Attachment-based attacks:** PDFs or `.docx` files that ask you to enable macros, or that contain links to phishing sites. We rarely send executable attachments — treat unexpected ones with suspicion.

**Vendor impersonation:** "Your Stripe account needs re-verification." Log in to the vendor's site directly by typing the URL — do not click the link in the email.

### What to do if you suspect phishing

1. **Do not click any links** in the suspicious email or message.
2. **Do not reply** to the email or provide any information.
3. Report it to the Engineering Lead immediately — even if you are not sure.
4. If you did click a link or enter credentials: report it immediately. Time matters — the faster you report, the faster access can be revoked and the damage contained.
5. If the message claimed to be from a vendor (Stripe, Clerk, GitHub), log in directly to that vendor's dashboard via a browser bookmark and check whether any real action is required.

### Spear phishing (targeted attacks)

Targeted phishing uses information about you (your name, role, recent work, colleague names) to appear more convincing. The sophistication of the attack does not change what you should do — report it and do not act on it.

---

## Module 2 — Password management and passphrases

### Why passwords matter

Every company system — GitHub, Railway, Replit, Clerk dashboard, Stripe, Sentry — has its own credentials. A compromised account can lead to a full production data breach. Weak or reused passwords are one of the most common attack vectors.

### Minimum requirements

- **Unique password for every account.** Never reuse a password across services.
- **Minimum length: 16 characters** for all accounts, more where possible.
- **Passphrases are excellent.** Four or more random words strung together ("correct-horse-battery-staple") are both memorable and strong.
- **Never share passwords** with colleagues — each person has their own account. There are no acceptable exceptions.
- **Never store passwords in plaintext:** no sticky notes, no notes apps, no plain-text files, no spreadsheets.

### Use a password manager

A password manager generates, stores, and autofills strong unique passwords for every account. Examples: 1Password, Bitwarden, Dashlane. Pick one and use it for all work accounts.

Benefits:
- Generates cryptographically random passwords
- Stores them encrypted; you only need to remember one strong master password
- Flags reused or compromised passwords
- Autofills credentials, reducing the risk of typing them into a phishing site

### Production secrets are not passwords

Production secrets (`ENCRYPTION_MASTER_KEY`, `DATABASE_URL`, API keys) are managed via Replit Secrets and Railway environment variables — not in a personal password manager. See the [Acceptable Use Policy](policies/acceptable-use-policy.md) for rules on handling secrets.

---

## Module 3 — Multi-factor authentication (MFA)

### What MFA is and why it matters

Multi-factor authentication requires something you know (password) plus something you have (a phone app, a hardware key) to log in. Even if an attacker steals your password, MFA prevents them from accessing the account without the second factor.

### Where MFA is required

MFA must be enabled on every account that has access to company systems:

| Account | MFA method |
|---|---|
| GitHub | Authenticator app or hardware key (SMS not recommended — SIM-swap attacks) |
| Replit | Authenticator app |
| Railway | Authenticator app |
| Google (for internal portal OAuth) | Authenticator app or hardware key |
| Clerk dashboard | Authenticator app |
| Stripe dashboard | Authenticator app or hardware key |
| Sentry | Authenticator app |

### Authenticator app recommendations

- **Preferred:** Hardware key (YubiKey or similar) for highest-value accounts (GitHub, Google)
- **Good:** Time-based one-time password (TOTP) apps — Authy, Google Authenticator, 1Password built-in authenticator
- **Avoid:** SMS-based 2FA — vulnerable to SIM-swap attacks

### MFA backup codes

Store MFA backup codes in your password manager alongside the account credentials. Do not store them in the same place as the TOTP secret (i.e., store them in your password manager, not in the authenticator app).

---

## Module 4 — Secure device usage

### Device requirements recap

The [Acceptable Use Policy](policies/acceptable-use-policy.md) Section 5 defines device requirements. In brief:

- Keep operating system and browser updated to a supported version
- Use a password-protected account (not a shared account)
- Enable full-disk encryption (FileVault on macOS, BitLocker on Windows)
- Auto-lock after 5 minutes of inactivity
- Do not allow others to use the device while company accounts are logged in

### Software and browser extensions

- Install software only from trusted sources (official vendor sites, App Store, reputable package managers)
- Browser extensions have access to everything you type in the browser — including passwords and company data. Keep extensions minimal and only install extensions from well-known, established publishers.
- Keep all installed software patched and updated. Enable automatic updates where practical.

### Public Wi-Fi

- Avoid accessing company systems on public Wi-Fi without a VPN.
- If you must use public Wi-Fi (conference, café, travel), use a reputable VPN.
- Avoid accessing production secrets or sensitive data on public Wi-Fi even with a VPN.

### Screen awareness

- Be aware of shoulder surfing when working in public.
- Use a privacy screen protector if you regularly work in crowded environments.
- Lock your screen before leaving your device unattended — even for a moment.

### Lost or stolen device

Report a lost or stolen device to the Engineering Lead **immediately**. The Engineering Lead will:
- Revoke all active Clerk sessions for your account
- Revoke your GitHub personal access tokens
- Remove your device from any authorized device lists
- Initiate a remote wipe if possible

---

## Module 5 — Data classification and handling

### The four tiers

The [Data Classification Policy](policies/data-classification-policy.md) defines four tiers. Here is what each tier means in daily work:

**Restricted** — Customer interview answers, template PDFs, generated session PDFs, API keys (plaintext), production secrets (`ENCRYPTION_MASTER_KEY`, `DATABASE_URL`).
- Never transmit in plaintext email or messaging
- Never paste into AI tools
- Never download to personal devices without explicit authorization
- Access only through the systems designed to hold them

**Confidential** — Stripe customer IDs, audit log entries, PDF audit events, Sentry error events, email delivery records.
- Share only with colleagues who have a business need
- Do not transmit to unauthorized third parties
- Acceptable to discuss internally via secure channels

**Internal** — Application logs, spot price history, operational runbooks (this document).
- Do not publish publicly
- Acceptable to share within the team and with authorized contractors

**Public** — Marketing website content, public API documentation, published articles.
- No restrictions once published

### Practical rules for daily work

**Printing:** Never print customer data (interview answers, PII, PDFs). If you must print for a legitimate business reason, shred the output when done.

**Screen sharing:** Before sharing your screen on a video call, close any tabs or windows showing customer data. Mute notifications that might display customer information.

**AI tools:** Do not paste customer data, production secrets, database contents, or audit log entries into any AI tool (Copilot, Claude, ChatGPT, etc.). Public AI tools may retain your input for training purposes.

**Slack / messaging:** Do not share API keys, database URLs, or customer PII in chat. Use the Replit Secrets panel or Railway environment variables for credentials.

**Email:** Do not email plaintext customer data to yourself or others. If you need to share data for a business reason, use an access-controlled system.

### Data you encounter but don't own

You may have incidental access to customer data (interview sessions, PDFs, account information) as part of debugging or support. Access only the data you need to resolve the specific issue. Do not browse through customer data out of curiosity. Log your access where the system provides a mechanism to do so.

---

## Module 6 — Acceptable use of company systems and AI tools

### Summary of the Acceptable Use Policy

The full [Acceptable Use Policy](policies/acceptable-use-policy.md) defines what is permitted. The most important rules:

**Never:**
- Share your credentials (GitHub, Clerk, Railway, Replit, Stripe) with anyone
- Store production secrets in code files, Slack, email, notes apps, or plain-text files
- Deploy directly to production without a passing CI run and an approved PR (except hotfix bypass as defined in deployment docs)
- Download or export customer PII outside approved systems without written authorization
- Paste customer data or production secrets into AI tools

**Always:**
- Use your individual account — no shared accounts
- Use the Replit Secrets panel or Railway environment variables for secrets
- Report policy questions or violations to the Engineering Lead without delay

### AI tools specifically

AI-assisted coding tools are permitted for development. Before using one:

1. Review the AI tool's data retention and training policy.
2. Do not paste actual customer data (names, emails, interview answers, PDFs) into the prompt.
3. Do not paste production secrets (API keys, `DATABASE_URL`, `ENCRYPTION_MASTER_KEY`) into the prompt.
4. Treat AI-generated code as untrusted input — review it for security issues before committing.

Common AI-generated security mistakes to watch for:
- SQL string concatenation instead of parameterized queries (SQL injection)
- Missing authentication checks on API endpoints
- Logging sensitive values at INFO level
- Storing secrets in code or config files

---

## Module 7 — Incident reporting — what to do and who to call

### What counts as a security incident?

You do not need to be certain before reporting. Report if you suspect any of the following:

- You clicked a phishing link or entered credentials on a suspicious site
- You received an unexpected MFA prompt you did not initiate
- Your device has been lost, stolen, or accessed without authorization
- You accidentally shared a credential, API key, or customer data with the wrong person
- You noticed unexpected account activity (GitHub, Railway, Stripe, Clerk) — logins you don't recognize, changes you didn't make
- A customer reports they can see another customer's data
- You found a production secret in an unexpected place (code comment, Slack message, email)
- The API server or database is behaving strangely in a way that could indicate unauthorized access

**When in doubt, report.** Reporting something that turns out to be a false alarm has no downside. Failing to report a real incident causes serious harm.

### How to report

**Contact the Engineering Lead immediately** via the fastest available channel (phone, direct message, or email). Do not wait.

When you report, include:
- What you observed or did
- When it happened (approximate time)
- Any systems or data that may be affected
- Whether you have already taken any action (e.g., changed a password)

**Do not:**
- Try to investigate or contain the incident yourself without guidance
- Delete logs or other evidence
- Notify customers or external parties before consulting the Engineering Lead — notifications are managed centrally per the [Incident Response Plan](../incident-response-plan.md)

### After you report

The Engineering Lead will follow the [Incident Response Plan](../incident-response-plan.md) and guide you through any containment steps (e.g., revoking credentials, force-expiring sessions, rotating keys). Your role is to provide accurate information quickly and then follow instructions.

### No retaliation

Reporting a security concern or potential incident in good faith will never result in disciplinary action. The organization's ability to respond effectively depends on timely reporting — even for mistakes.

---

## Knowledge check

After reading all seven modules, answer these questions mentally (or discuss them with the Engineering Lead during the team training session). There is no formal test — these are prompts to confirm you understood the key points.

1. You receive an email from "Stripe Support" saying your account needs re-verification and asking you to click a link. What do you do?
2. A colleague asks you to share your Railway account password so they can check a deployment log quickly. What do you do?
3. You are debugging a customer complaint and realize you need to look at their interview session in the database. You can see the answers are encrypted. What should you do and not do?
4. You receive an MFA prompt on your phone for a GitHub login, but you haven't tried to log in. What does this mean and what do you do?
5. You realize you accidentally pasted a customer's email address into a ChatGPT prompt while drafting a support response. What do you do?
6. Your laptop is stolen while traveling. What is the first thing you do?
7. A new contractor asks you to add their personal GitHub account to the repository so they can push code directly. What process should they go through?

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 1.0 | May 2026 | Initial training content |
