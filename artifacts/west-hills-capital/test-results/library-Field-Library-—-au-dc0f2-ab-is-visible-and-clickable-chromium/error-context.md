# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: library.spec.ts >> Field Library — authenticated >> Library tab is visible and clickable
- Location: e2e/library.spec.ts:40:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button, [role=\'tab\']').filter({ hasText: /^library$/i }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('button, [role=\'tab\']').filter({ hasText: /^library$/i }).first()

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
          - heading "Sign in to West Hills Capital" [level=1] [ref=e13]
          - paragraph [ref=e14]: Welcome back! Please sign in to continue
        - generic [ref=e15]:
          - button "Sign in with Google Continue with Google" [ref=e18] [cursor=pointer]:
            - generic [ref=e19]:
              - generic "Sign in with Google" [ref=e21]
              - generic [ref=e22]: Continue with Google
          - paragraph [ref=e25]: or
          - generic [ref=e27]:
            - generic [ref=e28]:
              - generic [ref=e31]:
                - generic [ref=e33]: Email address
                - textbox "Email address" [ref=e34]:
                  - /placeholder: Enter your email address
              - generic:
                - generic:
                  - generic:
                    - generic:
                      - generic: Password
                    - generic:
                      - textbox "Password":
                        - /placeholder: Enter your password
                      - button "Show password":
                        - img
            - button "Continue" [ref=e37] [cursor=pointer]:
              - generic [ref=e38]:
                - text: Continue
                - img [ref=e39]
      - generic [ref=e41]:
        - generic [ref=e42]:
          - generic [ref=e43]: Don’t have an account?
          - link "Sign up" [ref=e44] [cursor=pointer]:
            - /url: http://localhost:23904/app/sign-up
        - paragraph [ref=e47]: Development mode
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * Field Library tab smoke tests — /app (Library tab within Docuplete)
  5   |  *
  6   |  * Unauthenticated: /app redirects to sign-in (no crash).
  7   |  * Authenticated: Library tab renders Fields/Types/Groups subtabs,
  8   |  *   card grid appears, search filters cards, hints toggle shows labels.
  9   |  *
  10  |  * Auth-gated tests skip automatically when CLERK_SECRET_KEY is not set.
  11  |  */
  12  | 
  13  | const APP = "/app";
  14  | const SIGN_IN = "/app/sign-in";
  15  | 
  16  | test.describe("Field Library — unauthenticated", () => {
  17  |   test.use({ storageState: { cookies: [], origins: [] } });
  18  | 
  19  |   test("unauthenticated /app redirects to sign-in without crash", async ({ page }) => {
  20  |     await page.goto(APP, { waitUntil: "domcontentloaded" });
  21  |     await page.waitForTimeout(5_000);
  22  |     await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  23  | 
  24  |     const url = page.url();
  25  |     const body = await page.locator("body").textContent({ timeout: 6_000 });
  26  | 
  27  |     const redirected = url.includes(SIGN_IN);
  28  |     const showsSignIn = body?.toLowerCase().includes("sign") ?? false;
  29  |     expect(redirected || showsSignIn).toBe(true);
  30  | 
  31  |     await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
  32  |   });
  33  | });
  34  | 
  35  | test.describe("Field Library — authenticated", () => {
  36  |   test.beforeEach(() => {
  37  |     if (!process.env.CLERK_SECRET_KEY && !process.env.E2E_EMAIL) test.skip();
  38  |   });
  39  | 
  40  |   test("Library tab is visible and clickable", async ({ page }) => {
  41  |     await page.goto(APP, { waitUntil: "domcontentloaded" });
  42  |     await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  43  | 
  44  |     await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  45  | 
  46  |     const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
> 47  |     await expect(libraryTab).toBeVisible({ timeout: 10_000 });
      |                              ^ Error: expect(locator).toBeVisible() failed
  48  | 
  49  |     await libraryTab.click();
  50  |     await page.waitForTimeout(1_000);
  51  | 
  52  |     await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  53  |   });
  54  | 
  55  |   test("Library shows Fields, Types, Groups, Compliance, Tags subtabs", async ({ page }) => {
  56  |     await page.goto(APP, { waitUntil: "domcontentloaded" });
  57  |     await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  58  | 
  59  |     const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
  60  |     const hasLib = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
  61  |     if (!hasLib) { test.skip(); return; }
  62  | 
  63  |     await libraryTab.click();
  64  |     await page.waitForTimeout(1_000);
  65  | 
  66  |     const fieldsSubtab     = page.locator("button, [role='tab']").filter({ hasText: /^fields$/i }).first();
  67  |     const typesSubtab      = page.locator("button, [role='tab']").filter({ hasText: /^types$/i }).first();
  68  |     const groupsSubtab     = page.locator("button, [role='tab']").filter({ hasText: /^groups$/i }).first();
  69  |     const complianceSubtab = page.locator("button, [role='tab']").filter({ hasText: /^compliance$/i }).first();
  70  |     const tagsSubtab       = page.locator("button, [role='tab']").filter({ hasText: /^tags$/i }).first();
  71  | 
  72  |     await expect(fieldsSubtab).toBeVisible({ timeout: 6_000 });
  73  |     await expect(typesSubtab).toBeVisible({ timeout: 6_000 });
  74  |     await expect(groupsSubtab).toBeVisible({ timeout: 6_000 });
  75  |     await expect(complianceSubtab).toBeVisible({ timeout: 6_000 });
  76  |     await expect(tagsSubtab).toBeVisible({ timeout: 6_000 });
  77  |   });
  78  | 
  79  |   test("Tags subtab renders the compliance tag manager", async ({ page }) => {
  80  |     await page.goto(APP, { waitUntil: "domcontentloaded" });
  81  |     await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  82  | 
  83  |     const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
  84  |     const hasLib = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
  85  |     if (!hasLib) { test.skip(); return; }
  86  | 
  87  |     await libraryTab.click();
  88  |     await page.waitForTimeout(500);
  89  | 
  90  |     const tagsSubtab = page.locator("button, [role='tab']").filter({ hasText: /^tags$/i }).first();
  91  |     const hasTagsTab = await tagsSubtab.isVisible({ timeout: 5_000 }).catch(() => false);
  92  |     if (!hasTagsTab) { test.skip(); return; }
  93  | 
  94  |     await tagsSubtab.click();
  95  |     await page.waitForTimeout(1_000);
  96  | 
  97  |     await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  98  | 
  99  |     const newTagBtn = page.locator("button").filter({ hasText: /new tag/i }).first();
  100 |     await expect(newTagBtn).toBeVisible({ timeout: 6_000 });
  101 |   });
  102 | 
  103 |   test("Fields subtab shows card grid without crash", async ({ page }) => {
  104 |     await page.goto(APP, { waitUntil: "domcontentloaded" });
  105 |     await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  106 | 
  107 |     const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
  108 |     const hasLib = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
  109 |     if (!hasLib) { test.skip(); return; }
  110 | 
  111 |     await libraryTab.click();
  112 |     await page.waitForTimeout(500);
  113 | 
  114 |     const fieldsSubtab = page.locator("button, [role='tab']").filter({ hasText: /^fields$/i }).first();
  115 |     const hasSub = await fieldsSubtab.isVisible({ timeout: 5_000 }).catch(() => false);
  116 |     if (hasSub) await fieldsSubtab.click();
  117 | 
  118 |     await page.waitForTimeout(1_000);
  119 |     await expect(page.locator("text=Something went wrong")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  120 | 
  121 |     const hasCards = await page.locator(".rounded.bg-\\[\\#F8F6F0\\], [class*='rounded'][class*='border']").count() > 0;
  122 |     const hasEmpty = await page.locator("text=/no fields|empty|add your first/i").count() > 0;
  123 |     expect(hasCards || hasEmpty).toBe(true);
  124 |   });
  125 | 
  126 |   test("search bar in Fields tab filters the card list", async ({ page }) => {
  127 |     await page.goto(APP, { waitUntil: "domcontentloaded" });
  128 |     await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  129 | 
  130 |     const libraryTab = page.locator("button, [role='tab']").filter({ hasText: /^library$/i }).first();
  131 |     const hasLib = await libraryTab.isVisible({ timeout: 8_000 }).catch(() => false);
  132 |     if (!hasLib) { test.skip(); return; }
  133 | 
  134 |     await libraryTab.click();
  135 |     await page.waitForTimeout(500);
  136 | 
  137 |     const fieldsSubtab = page.locator("button, [role='tab']").filter({ hasText: /^fields$/i }).first();
  138 |     const hasSub = await fieldsSubtab.isVisible({ timeout: 5_000 }).catch(() => false);
  139 |     if (hasSub) await fieldsSubtab.click();
  140 | 
  141 |     await page.waitForTimeout(500);
  142 | 
  143 |     const search = page.locator("input[placeholder*='search' i], input[placeholder*='filter' i]").first();
  144 |     const hasSearch = await search.isVisible({ timeout: 5_000 }).catch(() => false);
  145 |     if (!hasSearch) { test.skip(); return; }
  146 | 
  147 |     const cardsBefore = await page.locator("[class*='rounded'][class*='border'][class*='bg']").count();
```