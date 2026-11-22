# ThirdEye

Thirdeye keeps a check on all the data that slips through the gaps in the process.

A web app that is the **single source of truth** for leads, quotes, bookings, change requests, margins, GST/TDS, vendor payables and follow-ups. Founders and senior management can rely on it because every number is **calculated from records, never typed in**, and every change is **audited**.

> **Status:** front-end prototype (v0.1). Data is stored in the browser (localStorage). A database and real login are planned next (see [Roadmap](#roadmap)).

---

## 1. Problems this solves

| # | Problem | How the app handles it |
|---|---------|------------------------|
| 1 | Quote count, booking value, margin, GST, TDS and vendor payable aren't tracked properly | Quotes are their own records (several per request). Bookings come from an accepted quote. GST, TDS, payable and margin are calculated from line items and recorded transactions (`lib/finance.ts`). |
| 2 | The booking lifecycle and customer change requests aren't tracked | Bookings follow a fixed status flow with a timestamp and user on every step. Customer edits are **change requests** with their own approval. Approving one creates a new booking version (v1, v2, …) and records the value and margin change. |
| 3 | Leads arrive from several CRMs; no-OTP intake is counted as leads | One intake for every source. **Only OTP-verified intake is a Lead**; the rest are **Enquiries**, tracked separately. Duplicates (same phone number) are merged and flagged. |
| 4 | Follow-ups, first confirmation and payments are manual and get missed | Deadline-based follow-up tasks are **generated from the data** and close themselves once the step is done (`lib/workflow.ts`). Overdue tasks show on the dashboard and in the sidebar. |
| 5 | Both sellers and sales route requests to pre-sales | One-way routing: **exactly one configurable role** (default: Sales) can route. Anyone else is blocked and the attempt is logged. |
| 6 | Quotes from unrecognised vendors are used to inflate margin | A vendor master with an approval step (GSTIN and PAN required, Finance/Admin only). Quotes from non-approved vendors are **blocked** unless an Admin overrides with a reason. That margin is always reported separately as **flagged**. |
| 7 | Margin is recorded but can't be tied to an order | Every line item carries vendor, vendor quote reference, cost and price. Each booking has three margins: **Quoted, Booked and Realised**. Vendor invoices above the vendor's quote show up as **leakage**. |

---

## 2. Key decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Requested. Deploys to Vercel with no extra setup; leaves room for API routes when the database is added. |
| Styling | **Tailwind CSS v4 + shadcn/ui** (new-york style, zinc base) | Requested. Component source lives in `components/ui/` and is ours to change. |
| Storage (v0.1) | **Browser localStorage**, one versioned key `mahaansh:db:v1` | Requested for now. Every read and write goes through `lib/store.ts`, so moving to a database only changes that one file. |
| State management | Small external store + `useSyncExternalStore` | No extra dependency. Safe with server rendering (shows a loading state on the server, then loads data in the browser). Syncs across open tabs. |
| Numbers are calculated | Margin, GST, TDS, payable and receivable come from line items and transactions | Removes manual entry, which was the root cause of untrustworthy figures. |
| Records are locked once committed | Accepted quotes and confirmed bookings can't be edited. Changes go through change requests, which create new versions | Full history, and the margin impact of each change is known. |
| Rules are enforced in the data layer | Every action checks permissions and business rules; violations throw `Blocked` and are written to the audit log | The UI can't get around rules. Founders can see who tried what. |
| Follow-ups are generated from data | `syncTasks()` runs after every change and reconciles tasks with current data | No one has to remember to create follow-ups. Completed steps close their tasks automatically. |
| Leads and Bookings page | One page, one row per customer (unique lead/enquiry), tagged with the furthest stage reached (Enquiry, Lead, Request raised, Quoted, Booked, Fully paid, Lost, Duplicate). Funnel steps are cumulative. | The **dashboard funnel graph reads the same rows** (`lib/funnel.ts`), so the page chips and the dashboard bars always match. Clicking a dashboard bar opens the page filtered to that step. |
| No separate Requests page | Requests, quotes and pre-sales routing live in a panel opened from a customer on Leads and Bookings. Old `/requests` links redirect there. | One place for the customer journey. Accepting a quote still creates the booking. |
| Ongoing Bookings visibility | Hides bookings whose customer is marked lost on Leads and Bookings; a footnote shows how many and lets you reveal them. | Keeps the list to live business. Money already received on a hidden booking is still counted in Finance and the dashboard. |
| Original booking value | Booking page shows Original value (v1), approved changes and Current value (all incl. GST) at the top; each change request shows "booking value X → Y". | The starting value is stated outright instead of having to be inferred from the Versions list. |
| Motion | Charts grow from zero when a page opens (funnel bars, margin bars, donuts, meters, staggered). Pages rise in block by block, and a slim progress bar runs at the top while a page is opening. All of it is switched off for people who set "reduce motion" in their system. | Pure CSS transitions, no animation library. |
| Change request guards | A change request cannot bring in a vendor that is not approved (unless they are already on the booking). Approving a request fails if the booking's value changed since it was raised, so two pending requests cannot overwrite each other; reject and raise a fresh one. | Closes the two loopholes flagged earlier. |
| UI refresh | Soft purple brand palette with soft cards, dark mode (toggle in sidebar, remembered per browser, follows system on first visit), page transitions, toasts after saved actions, loading skeletons, Ctrl+K search that only returns what the current role may open, dashboard charts (funnel with step conversion, quoted/booked/realised margin bars, cash and obligations donuts) built as plain SVG, redesigned booking page header with a collected-so-far meter. | Charts are dependency-free so the bundle stays small; colours come from theme tokens (`--chart-1..5`) so dark mode works everywhere. |
| Role-based views | Switching the user shows only that role's pages and sends them to their home page; opening any other page shows "No access". The Founder (admin) sees everything. Follow-ups are limited to your own tasks for non-founders. Config in `lib/access.ts`. | Front-end only for now (a person could still switch user). Real enforcement comes with login and the database. |
| Finance Desk | New home page for Finance: money to collect, invoices to record, payouts due, vendors awaiting approval, margin alerts, bookings ready to close. Each row opens the right tab of the booking. | Finance works from queues, not by hunting through bookings. |
| Responsive lists | List pages use `components/data-list.tsx`: a wrapping table on wide screens and one card per row on smaller ones, so nothing scrolls sideways. | Works on laptops, tablets and phones. Pages with many numbers group related figures into one cell (e.g. value / received). |
| Lead definition | OTP-verified **and** not a duplicate | Matches the business definition. Enquiries keep their own conversion figures. |
| Duplicate detection | Same 10-digit phone number = duplicate of the first record | Simple and predictable. Can be extended with email or fuzzy name matching. |
| Three margins per booking | **Quoted** (accepted quote) → **Booked** (after approved changes) → **Realised** (booked sell − actual vendor invoices) | Splits "margin promised" from "margin earned". The gap shows where inflated numbers are. |
| GST treatment (assumption) | GST charged on the full pre-GST sell price at each line's rate | **Confirm with your CA.** Some businesses (e.g. tour operators) use a margin scheme or composite rates; change `totals()` in `lib/finance.ts`. |
| TDS treatment (assumption) | Deducted at the vendor's TDS rate on gross vendor payouts | Matches the common 194C/194J pattern. Rates are set per vendor. |
| Advance payment | Configurable % (default 30%) of booking value incl. GST | Booking status moves to Advance paid / Fully paid automatically as payments are recorded. |
| Authentication (v0.1) | Demo "Acting as" user switcher in the sidebar | So role rules can be tested without a backend. Real login comes with the database. |
| Currency and locale | INR, `en-IN` formatting, IST in the browser | Indian business. |

### Roles and permissions

**Pages by role** (change in `lib/access.ts`): Founder: all. Finance: Finance Desk, Finance & Margins, Ongoing Bookings, Vendors, Change Requests, Follow-ups. Sales: Leads and Bookings, Ongoing Bookings, Change Requests, Follow-ups. Pre-sales: Leads and Bookings, Follow-ups. Seller: Ongoing Bookings, Follow-ups.

| Action | Allowed roles |
|---|---|
| Route request to pre-sales | The configured role (Sales by default) + Admin |
| Mark "Seller accepted" | Seller, Admin |
| Approve or reject vendors | Finance, Admin |
| Override a non-approved vendor on a quote | Admin (reason required) |
| Approve or reject change requests | Admin |
| Record vendor invoices and payouts | Finance, Admin |
| Close a booking | Finance, Admin |
| Change rules and settings | Admin |

---

## 3. Data model

```
Lead (OTP? duplicate?) ──► BookingRequest ──► Quote #1..n (LineItems → Vendor + vendor quote ref)
                                 │                    │ accepted
                                 │                    ▼
                         presales routing        Booking (versions v1..vn, status history)
                                                      ├── ChangeRequest (pending/approved/rejected, Δ value, Δ margin)
                                                      ├── CustomerPayment (amount, mode, reference)
                                                      ├── VendorInvoice (actual cost)
                                                      └── VendorPayment (gross, TDS, net)
Task (auto rule or manual) ─► any record        AuditEntry (info / warning / blocked) ─► any record
```

All types are in `lib/types.ts`.

### Booking lifecycle

`Awaiting seller → Seller accepted → Confirmed to customer → Advance paid → Fully paid → Fulfilled → Vendor settled → Closed` (can be **Cancelled** before fulfilment)

- Payment statuses are set automatically when payments are recorded.
- **Vendor settled** is set automatically when every vendor's invoices are fully paid.

### Automatic follow-up rules (deadlines are configurable)

| Rule | Starts when | Default deadline |
|---|---|---|
| First contact | New verified lead | 2 h |
| Send first quote | Request has no quote sent | 24 h |
| Follow up on quote | Quote sent, no decision | 48 h |
| Chase seller acceptance | Booking awaiting seller | 12 h |
| Send confirmation | Seller accepted | 6 h |
| Collect advance | Confirmed, advance not received | 48 h |
| Collect balance | Advance paid | 144 h |
| Decide change request | Change request pending | 24 h |

---

## 4. Project structure

```
app/
  page.tsx                 Founder dashboard
  leads/                   Leads and Bookings: customers tagged by furthest stage, filters, intake + verify; click a customer for requests, quotes, pre-sales routing
  bookings/                Ongoing Bookings list: owner, pre-sales assignee, live stage + time in stage
  bookings/ [id]/          Lifecycle, payments, change requests, vendor invoices/payouts, history
  change-requests/         Raise change requests (linked to an existing booking) + list of all of them
  vendors/                 Vendor master and approvals
  finance-desk/            Finance team home: work queues
  finance/                 Per-booking ledger: 3 margins, GST, TDS, payables
  tasks/                   Follow-ups (auto + manual)
  audit/                   Audit log (info / overrides / blocked)
  settings/                Routing role, deadlines, advance %, JSON export
components/
  ui/                      shadcn/ui components
  data-list.tsx            Responsive list (table on wide screens, cards on narrow)
  app-shell.tsx            Sidebar, user switcher, demo reset
  common.tsx               Shared page building blocks
  line-items-editor.tsx    Line item editor + read-only table
lib/
  types.ts                 Domain model
  store.ts                 localStorage store + all actions and business rules
  finance.ts               All money calculations
  workflow.ts              Lifecycle + follow-up automation
  metrics.ts               Dashboard calculations
  seed.ts                  Demo dataset
```

---

## 5. Running locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (also type-checks)
```

The app loads with demo data. Use **Reset demo data** in the sidebar to restore it, and **Acting as** to switch roles and test permission rules. Use **Settings → Export** to download all data as JSON.

### Try these flows
1. **Leads and Bookings →** capture an intake without OTP → it is tagged *Enquiry*. Try raising a request (blocked), then *Mark OTP verified*.
2. **Leads and Bookings →** click a customer → *Requests & quotes* panel: act as *Meera (Seller)* and route to pre-sales → blocked and logged. Switch to *Asha (Sales)* → allowed.
3. **New quote** using *QuickDeals (unverified)* → blocked unless you're Admin and give a reason.
4. **Accept a quote →** booking created → act as Seller to accept → confirm → record payments → status updates automatically.
5. **Change request →** go to **Change Requests → Raise change request**, pick an existing booking, edit the lines → open the booking's *Change requests* tab (read-only) → approve as Admin → booking moves to v2 with value and margin change. The Change Requests page lists every change; full details are viewable only inside the booking and can't be edited.
6. **Vendor invoices →** record an invoice above the vendor quote → leakage and a warning appear on the dashboard.

---

## 6. Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repo. The framework is detected as Next.js; no environment variables needed for v0.1.
3. Every push to `main` deploys to production; other branches get preview URLs.

> Data lives in each user's browser, so every person and device sees their own copy until the database is added.

---

## 7. Roadmap

1. **Database + auth:** Postgres (e.g. Neon/Supabase) behind Next.js route handlers or server actions, plus real login with roles. Re-implement `lib/store.ts` actions as API calls. The rest of the app stays the same.
2. **CRM integrations:** webhooks from LeadSquared, Zoho, website forms etc. into a `/api/intake` endpoint, with OTP status from the source.
3. **Messaging and payments:** WhatsApp/email for follow-ups and confirmations; Razorpay/Cashfree payment links with automatic matching of payments.
4. **Accounting sync:** Tally / Zoho Books export for GST and TDS returns.
5. **Alerts:** daily founder digest; alerts for margin outliers, repeated vendor overrides and overdue tasks.

## 8. Open questions (to confirm with the business)

- What exactly is a "seller": internal staff or the vendor/supplier who accepts the booking?
- GST treatment per service category (full value vs. margin scheme).
- Which CRMs are in use, and how each one reports OTP status.
- Who besides Admin may approve change requests (e.g. a team lead up to a value limit)?
