---
name: Analytics privacy
description: Privacy boundaries for marketing analytics in a shared marketing and document-signing frontend.
---

Marketing analytics must respect the existing visitor cookie-consent choice. Keep private app routes and document-signing sessions outside marketing tracking. Do not deliberately send form answers, signing tokens, or query parameters to analytics.

**Why:** Marketing and sensitive document-signing experiences share a frontend. Adding a global analytics snippet without scope restrictions could expose customer information.

**How to apply:** Preserve these boundaries when adding analytics events, routes, or changing consent handling. Do not treat marketing page tracking as authorization to track private workflows.
