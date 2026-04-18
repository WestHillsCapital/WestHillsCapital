# Overview

West Hills Capital is a physical gold and silver allocation company. This project is a production-ready website designed to facilitate their operations, featuring live precious metal pricing, a 2-step appointment scheduling system, an IRA allocation section, and an educational content hub. The primary goal is to drive "Schedule Allocation Call" actions, supported by robust backend services for pricing, scheduling, lead capture, and deal execution. The business vision is to provide a seamless and informative platform for clients interested in gold and silver allocation, with ambitions to streamline internal processes through automated deal execution and record-keeping.

# User Preferences

I prefer iterative development. I want to be asked before making major changes.

# System Architecture

The project is structured as a pnpm monorepo using TypeScript, with separate `api-server` (Express) and `west-hills-capital` (React + Vite + Tailwind + shadcn) packages. Data validation is handled by Zod. The UI/UX emphasizes a professional aesthetic with an off-white, navy, and gold color scheme, featuring a fixed header with a live spot ticker.

**Frontend (React + Vite + Tailwind + shadcn):**
- **Pages:** Home, Live Pricing, Schedule Allocation Call, IRA Allocation, About, Disclosures, Terms, Insights Hub, and individual Insight Article pages.
- **Components:** Reusable UI components from shadcn-ui, `react-hook-form` for forms.
- **Routing:** Handled by React Router, with dynamic slug-based routing for articles.
- **Design:** Consistent theming across the site, using Tailwind CSS for utility-first styling.

**Backend (Express 5 + PostgreSQL):**
- **API:** RESTful API mounted at `/api` providing endpoints for pricing (spot, products, buyback), scheduling (slots, booking), and lead capture.
- **Database:** PostgreSQL used for storing leads and appointments.
- **Pricing Logic:** Spreads for gold (+2%), silver (+5%), and buyback prices (gold -1%, silver -3%) are applied server-side.
- **Deal Builder Workflow:** A server-side pipeline for "Lock & Execute" functionality, involving:
    1.  Database save of deal details.
    2.  Dillon Gage `LockPrices` and `ExecuteTrade` calls.
    3.  PDF invoice generation with wire instructions.
    4.  Google Drive upload of the invoice.
    5.  Client recap email via Resend.
    6.  Admin notification and Sheets sync.

**Key Features:**
-   **Live Pricing:** Integration with Dillon Gage Fiztrade API for real-time gold and silver spot prices.
-   **Appointment Scheduling:** A 2-step form to schedule allocation calls, with available slots generated deterministically (Mon-Fri, 9 am-5 pm CT, 14 days ahead) and booked slots excluded.
-   **Insights Hub:** A content management system for educational articles, with metadata and content managed in `insights.ts`.
-   **Deal Builder:** An internal tool to manage and execute client deals, automating pricing, trade execution, invoicing, and record-keeping.
-   **FedEx Location Search:** Integration to find nearest FedEx locations for shipping.

**Deployment:**
-   The monorepo is deployed to Railway (API server) and Vercel (frontend), both configured to watch the GitHub `main` branch.
-   Vercel handles API rewrites to proxy requests to the Railway-hosted API.

# External Dependencies

-   **Dillon Gage Fiztrade API:** Used for live gold/silver spot prices and wholesale trade execution (`LockPrices`, `ExecuteTrade`).
-   **PostgreSQL:** Replit's built-in PostgreSQL for `leads` and `appointments` data.
-   **Resend:** For sending client recap emails with invoice attachments.
-   **Google Drive API:** For uploading generated PDF invoices to a structured folder hierarchy.
-   **FedEx API:** For searching and retrieving nearby FedEx shipping locations.
-   **pnpm workspaces:** Monorepo management.
-   **TypeScript:** Language.
-   **Express:** Backend API framework.
-   **React, Vite, Tailwind CSS, shadcn/ui:** Frontend stack.
-   **Zod:** Data validation.
-   **pdfkit:** PDF generation library.