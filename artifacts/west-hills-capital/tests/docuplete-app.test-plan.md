# Docuplete App — Playwright Test Plan

Target: `/app` (westhillscapital.com/app)  
Auth: Clerk programmatic sign-in (`testClerkAuth: true`)  
API base: `/api/v1/product/docuplete`

---

## T01 — Unauthenticated redirect

**Goal:** Visiting `/app` without a session redirects to sign-in.

```
1. [New Context] Create a new browser context (no auth)
2. [Browser] Navigate to /app
3. [Verify]
   - URL becomes /app/sign-in (within 3 s)
   - Sign-in page is visible (Clerk UI or branded sign-in component)
```

---

## T02 — New user onboarding flow

**Goal:** A brand-new Clerk user who has no account is redirected through onboarding, completes it, and lands on the main builder.

```
1. [New Context] Create a new browser context
2. [Clerk Auth] Sign in as {firstName: "Test", lastName: "Firm", email: `docuplete-onboard-${nanoid(6)}@example.com`}
3. [Browser] Navigate to /app
4. [Verify]
   - Onboarding screen is shown (heading contains "Get started" or "Welcome")
   - Step 1 asks for a company/firm name
5. [Browser] Enter a company name (e.g. "Acme Lending ${nanoid(4)}")
6. [Browser] Click the Continue / Next button
7. [Verify]
   - Step 2 shows industry options: Financial Services, Insurance, Real Estate, Legal, Healthcare, Other
8. [Browser] Click "Financial Services"
9. [Browser] Click the Finish / Complete button
10. [Verify]
    - Onboarding disappears; main Docuplete builder is shown
    - Tab bar includes Packages, Sessions, Batch, Library
    - URL is /app or /app/
```

---

## T03 — Authenticated user lands on builder

**Goal:** A returning user signs in and sees the Docuplete builder with its tab bar and empty-state prompt.

```
1. [New Context] Create a new browser context
2. [Clerk Auth] Sign in as an existing test account (reuse onboarded account from T02 or any seeded account)
3. [Browser] Navigate to /app
4. [Verify]
   - AppLayout renders: "Docuplete" logo/link in header
   - Sidebar/nav contains links: (root), Sessions, Settings
   - Main content shows the Packages tab as active
   - Either a package selector dropdown is visible OR an empty-state prompt ("Load sample package" / "New Package") is shown
```

---

## T04 — Load sample package

**Goal:** Clicking "Load sample package" populates the package selector with a pre-built package and shows the builder UI.

```
1. [New Context] Create a new browser context
2. [Clerk Auth] Sign in as a fresh onboarded account
3. [Browser] Navigate to /app
4. [Verify] "Load sample package" button is visible
5. [Browser] Click "Load sample package"
6. [Verify]
   - A spinner or loading state appears briefly
   - Package selector dropdown becomes populated (shows a package name)
   - Builder content loads (tabs: Packages, Sessions, Batch, Library are all visible)
   - No error message appears
```

---

## T05 — Library tab — Fields subtab

**Goal:** The Library > Fields subtab loads correctly and shows the two-pane layout.

```
1. [New Context] Create a new browser context
2. [Clerk Auth] Sign in
3. [Browser] Navigate to /app
4. [Browser] Click the "Library" tab
5. [Verify]
   - Library panel renders inside a centered card (max-w-4xl)
   - Subtabs visible: Fields, Field Groups, Types, Groups, Compliance
   - "Fields" is the active subtab
6. [Verify]
   - A search bar is visible above the two-pane layout
   - Left pane shows a list of fields (or "No shared fields yet" if empty)
   - Right pane shows "Select a field to edit" placeholder when nothing is selected
7. [Browser] Click on any field in the left list (or "+ Add" to create one)
8. [Verify]
   - Right pane shows the field detail form: Label, Category, Prefill source, Sort order, Field type buttons, Validation rule buttons, Active/Required/Sensitive checkboxes, Save button
```

---

## T06 — Library tab — Types subtab

**Goal:** The Types subtab shows the two-pane layout matching Fields.

```
1. [New Context] Create a new browser context
2. [Clerk Auth] Sign in
3. [Browser] Navigate to /app
4. [Browser] Click "Library" tab
5. [Browser] Click "Types" subtab
6. [Verify]
   - Search bar is visible above the two-pane layout
   - Left pane shows a list of transaction types (or "No types yet")
   - Right pane shows "Select a type to edit" when nothing is selected
7. [Browser] Click on any type in the left list (or "+ Add" to create one)
8. [Verify]
   - Right pane shows: Label input, Sort order input, Active checkbox, Save button
   - Scope ID is displayed in small text at the bottom
```

---

## T07 — Sessions page loads

**Goal:** Navigating to /app/sessions renders the sessions page.

```
1. [New Context] Create a new browser context
2. [Clerk Auth] Sign in
3. [Browser] Navigate to /app/sessions (or click "Sessions" in the nav)
4. [Verify]
   - URL is /app/sessions
   - Sessions page renders (heading or empty state related to sessions/interviews)
   - No JavaScript errors in console
```

---

## T08 — Settings page — Billing section

**Goal:** /app/settings loads and shows the Billing section with plan info.

```
1. [New Context] Create a new browser context
2. [Clerk Auth] Sign in
3. [Browser] Navigate to /app/settings (or click "Settings" in the nav)
4. [Verify]
   - URL is /app/settings
   - Billing section is visible with a heading "Billing"
   - Plan tier badge is shown (e.g. "Starter", "Pro", "Trialing", or "Free")
   - Usage meters are rendered (packages used / limit, submissions used / limit)
   - No error banner is shown
```

---

## T09 — Sign out

**Goal:** Clicking "Sign out" in the nav clears the session and redirects to sign-in.

```
1. [New Context] Create a new browser context
2. [Clerk Auth] Sign in
3. [Browser] Navigate to /app
4. [Browser] Click the "Sign out" button in the sidebar/header
5. [Verify]
   - User is redirected to /app/sign-in
   - Navigating back to /app redirects to /app/sign-in again (session is cleared)
```

---

## T10 — Responsive / mobile layout (400 px)

**Goal:** The app renders usably at mobile width.

```
defaultScreenWidth: 400
defaultScreenHeight: 720

1. [New Context] Create a new browser context
2. [Clerk Auth] Sign in
3. [Browser] Navigate to /app
4. [Verify]
   - Page renders without horizontal overflow
   - Nav/sidebar is either collapsed or shown as a mobile menu
   - Library tab card (max-w-4xl) fills available width and does not clip
   - Two-pane layout in Library toggles between list and detail view on small screens
```

---

## Run order & priority

| # | Test | Priority | Notes |
|---|------|----------|-------|
| T01 | Unauthenticated redirect | P0 | Must pass before all others |
| T02 | Onboarding | P0 | Gate for all authenticated flows |
| T03 | Builder landing | P0 | Core shell |
| T04 | Load sample package | P1 | Most common first action |
| T05 | Library — Fields | P1 | Recently redesigned |
| T06 | Library — Types | P1 | Recently redesigned |
| T07 | Sessions page | P1 | |
| T08 | Settings / Billing | P2 | Read-only verification |
| T09 | Sign out | P2 | |
| T10 | Mobile layout | P3 | |

---

## Technical context for the test runner

- **App base path:** `/app`
- **Clerk auth:** programmatic — use `testClerkAuth: true`; no need to interact with Clerk UI
- **API base:** `/api/v1/product/docuplete` (app users) and `/api/v1/product/settings` (settings)
- **Onboarding trigger:** new Clerk users with no existing account row are shown `AppOnboard`; existing accounts skip it
- **Layout component:** `AppLayout` — contains logo at top-left ("Docuplete" link → `/app`), nav links for Sessions and Settings, Sign out button
- **Library card:** `<section className="bg-white border border-[#DDD5C4] rounded-lg max-w-4xl mx-auto overflow-hidden mt-4">` — tabs: Fields, Field Groups, Types, Groups, Compliance
- **Fields panel search:** full-width input above the two-pane `<div style="height:520px">`
- **Types panel search:** same pattern, `<div style="height:400px">`
- **Empty state (no packages):** buttons "Load sample package" and "+ New Package"
