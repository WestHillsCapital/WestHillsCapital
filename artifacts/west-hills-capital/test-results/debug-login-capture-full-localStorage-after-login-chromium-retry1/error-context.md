# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: debug-login.spec.ts >> capture full localStorage after login
- Location: e2e/debug-login.spec.ts:3:1

# Error details

```
TimeoutError: page.waitForURL: Timeout 20000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "https://www.westhillscapital.com/app/sign-in/factor-two"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - paragraph [ref=e6]: Docuplete
      - paragraph [ref=e7]: Guided paperwork, handled.
    - generic [ref=e9]:
      - generic [ref=e10]:
        - generic [ref=e12]:
          - heading "Check your email" [level=1] [ref=e13]
          - paragraph [ref=e14]: to continue to My Application
          - paragraph [ref=e16]: successdripsclues@gmail.com
        - generic [ref=e17]:
          - generic [ref=e18]:
            - generic [ref=e20]:
              - generic:
                - group
                - textbox "Enter verification code" [active] [ref=e21]
            - button "Didn't receive a code? Resend (10)" [disabled]
          - paragraph [ref=e24]: You're signing in from a new device. We're asking for verification to keep your account secure.
          - generic [ref=e25]:
            - button "Continue" [ref=e26] [cursor=pointer]:
              - generic [ref=e27]:
                - text: Continue
                - img [ref=e28]
            - link "Use another method" [ref=e31] [cursor=pointer]:
              - /url: https://www.westhillscapital.com/app/sign-in/factor-two
      - generic [ref=e36]:
        - paragraph [ref=e37]: Secured by
        - link "Clerk logo" [ref=e38] [cursor=pointer]:
          - /url: https://go.clerk.com/components
          - img [ref=e39]
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1  | import { test } from "@playwright/test";
  2  | 
  3  | test("capture full localStorage after login", async ({ browser }) => {
  4  |   // Fresh context — no saved state — do a real login and inspect what's stored
  5  |   const context = await browser.newContext({ baseURL: "https://www.westhillscapital.com" });
  6  |   const page = await context.newPage();
  7  | 
  8  |   await page.goto("https://www.westhillscapital.com/app/sign-in", { waitUntil: "domcontentloaded" });
  9  | 
  10 |   const emailInput = page.locator("input[name='identifier']").first();
  11 |   await emailInput.waitFor({ state: "visible", timeout: 15_000 });
  12 |   await emailInput.fill(process.env.E2E_EMAIL!);
  13 |   await emailInput.press("Enter");
  14 | 
  15 |   await page.waitForURL(/sign-in\/factor-one/, { timeout: 15_000 });
  16 |   const passwordInput = page.locator("input[name='password']").first();
  17 |   await passwordInput.waitFor({ state: "visible", timeout: 10_000 });
  18 |   await passwordInput.fill(process.env.E2E_TEST_PASSWORD!);
  19 |   await passwordInput.press("Enter");
  20 | 
> 21 |   await page.waitForURL((url) => !url.pathname.startsWith("/app/sign-in"), { timeout: 20_000 });
     |              ^ TimeoutError: page.waitForURL: Timeout 20000ms exceeded.
  22 |   await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  23 |   console.log("LANDED_AT:", page.url());
  24 | 
  25 |   // Dump all localStorage keys from both origins
  26 |   const ls = await page.evaluate(() => {
  27 |     const out: Record<string, string> = {};
  28 |     for (let i = 0; i < localStorage.length; i++) {
  29 |       const k = localStorage.key(i)!;
  30 |       out[k] = localStorage.getItem(k)?.slice(0, 80) ?? "";
  31 |     }
  32 |     return out;
  33 |   });
  34 |   console.log("LOCALSTORAGE:", JSON.stringify(ls, null, 2));
  35 | 
  36 |   // Dump cookies
  37 |   const cookies = await context.cookies();
  38 |   console.log("COOKIES:", cookies.map(c => `${c.name}@${c.domain}`).join(", "));
  39 | 
  40 |   await context.close();
  41 | });
  42 | 
```