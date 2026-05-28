# Gruhome — Book Inventory & Dispatch Tracker

> *Sample books* = physical fabric, wallpaper, leather and blinds catalogues the sales team hand-carries to client homes. Gruhome circulates 600+ of them across two Delhi NCR stores. Until this tool, they kept going missing. This product, **deployed to real staff today**, turned that into a one-tap audited workflow.

[![Status](https://img.shields.io/badge/status-in%20production-3B6D11)]()
[![Users](https://img.shields.io/badge/daily%20users-6%20staff%20%2B%202%20approvers-185FA5)]()
[![Stack](https://img.shields.io/badge/stack-React%20%C2%B7%20Cloudflare%20Workers%20%C2%B7%20Notion-854F0B)](#architecture--engineering-notes)

---

## The problem

Gruhome is a premium home-furnishings retailer with **two stores in Delhi NCR** (Preet Vihar + Noida) and **600+ physical sample books** — fabric swatches, wallpaper collections, blinds lookbooks, leather catalogues — that circulate to client homes for project presentations.

The retail loop is straightforward:
1. Salesperson takes 3–5 books to a client meeting
2. Books stay with the client for days or weeks
3. Eventually they come back

Except they don't always come back. **Books were going missing in single-digit percentages per month** — and at ~₹8,000–₹40,000 per book, that compounds fast. Recalls were forgotten. The owner had no visibility into what was out, with whom, or how long overdue. The team's prior attempts (a shared spreadsheet, a whiteboard, asking around) had all decayed within weeks.

When I scoped this with the founder, the recurring complaint wasn't "we need a fancy system" — it was *"I just want to know where my books are without asking five people."*

## Who uses this

| User | Volume | What they care about |
|---|---|---|
| **Sales staff** | 6 people, primary daily users | Speed. They log dispatches while standing at a client's door. Anything over 30 seconds gets skipped. |
| **Approvers** (owner + manager) | 2 people, governance role | Visibility + control. They want a single screen showing what's out, what's overdue, and one-tap approve/recall. |
| **Founder** | 1 person, internal customer | Zero manual data entry. Notion is already the source of truth for the catalogue — the new system must not create a parallel one. |

## Discovery findings that shaped the product

| Finding | What I did about it |
|---|---|
| **Staff abandon any form that takes >30s on a phone** | Built a single-screen dispatch form. Salesperson is remembered. Book search is type-ahead with 30 results max. Manual book add is one-tap. End-to-end median: ~22s for a 3-book dispatch. |
| **One client visit = many books, but staff think in "visits" not "books"** | Modeled dispatches as a unit. A 5-book hand-off is one approval, one recall, one notification — not five. |
| **Books are physical single-copy assets, but the catalogue is the existing 600-row Notion DB** | Two linked Notion databases instead of replacing what works. The catalogue stays; a new "Dispatch Records" DB captures every event. Past Notion workflows aren't disrupted. |
| **Owner + manager both want to approve, but only one should win** | First-action-wins race protection. The second tapper gets a branded "Already actioned by [name]" page — no double-approvals possible. |
| **Both approvers live in Pumble all day** | Approve/Reject links are sent directly to the approver channel. One-tap action from a phone notification. No "open the app" friction. |
| **Sales team has high churn — names change every few months** | Salesperson list is a single env var, editable without a code deploy. Notion auto-creates the new option on first use. |

## What's live in production today

**For staff** (the speed-critical path)
- Single-page dispatch form, phone-first
- Live type-ahead search across all 600 books with category and store filter pills
- Manual book add for off-catalogue items
- "My dispatches" view scoped to just their own activity
- Warning (not block) when a selected book is already out — preserves staff judgment while flagging risk

**For approvers** (the governance path)
- PIN-protected dashboard with four real-time metrics (out / books-in-field / overdue / pending)
- Status + store filter pills
- Tap-any-row detail modal with Approve / Reject / Recall actions
- Amber banner when approvals are waiting
- Pumble approve/reject links per approver (when Pumble is wired)

**For the founder** (the visibility path)
- Every action writes back to Notion immediately — no parallel data system
- Daily automated 9 AM IST overdue reminder
- Full dispatch ledger — every event preserved as its own row in Notion

**Preview mode for evaluators** — production runs against live data, but the repo ships with a `DEMO_MODE=1` flag that short-circuits external calls with realistic fixtures. Anyone reading this README can clone, `npm run dev`, and explore the full UI in 30 seconds without provisioning anything.

## Decisions I had to make (and the rationale)

These are the product trade-offs that show up if you actually scope a tool like this:

#### 1. **Warn vs block on already-dispatched books**
Each book is a single physical copy. If staff try to dispatch a book that's already out, the technically correct behavior is to block. But in reality: sometimes the salesperson knows the other staff member has returned the book to a desk and Notion just hasn't caught up. **Decision: warn, don't block.** Trust staff judgment, surface the risk, let them decide. The audit log catches abuse.

#### 2. **No login for staff**
Staff identity is "honor system" — pick your name once, the device remembers. **Why?** The phones the team uses are personal, not shared. The realistic abuse vector (someone faking identity on a personal device) is low. The PIN gate on the *admin* side is the meaningful boundary.

#### 3. **PIN over OAuth for admin**
A 4-digit PIN, server-validated, sent as a bearer token. Not best-in-class security; it is best-in-class for *"the owner can use this on her phone in five seconds"*.

#### 4. **Two Notion databases instead of one flat tracker**
The founder had been using a single 600-row catalogue with embedded dispatch fields (Status, Date Given Out, Person Name). It worked until it didn't — recall destroys history, single book can't reflect "currently dispatched to Mrs. X AND historically dispatched to 12 others". **Decision: separate the catalogue (book identity) from the dispatch log (events).** Costs ~10 min of one-time DB setup, buys a permanent audit ledger.

#### 5. **Cloudflare Workers over a more traditional backend**
Single-deploy, single-config, single-dashboard for env vars. A non-technical founder can manage it. Pages + separate cron Worker would have meant two deployments to babysit.

## How I'll know it worked

Success metrics agreed with the founder, measured from Notion data after 60 days of live use:

| Metric | Target | How measured |
|---|---|---|
| **% of dispatches logged in the app** | >85% | App count ÷ founder's manual estimate of total dispatches |
| **Approval response time** (median) | <30 min during working hours | `Approved At` − `Date Sent` in Notion |
| **Books past return-by date** at any moment | <5 | Dashboard "Overdue" tile |
| **Books reported missing per month** | 0 | Self-reported by team |

If the dispatch-logging rate sits under 50%, the form is too slow. If overdue is consistently >10, the recall flow needs more teeth.

## Architecture & engineering notes

For the engineers reading this — high level:

```
React 18 + Vite SPA  ──fetch──►  Cloudflare Worker  ──REST──►  Notion (2 DBs)
                                       │
                                       └──webhook──►  Pumble channels
```

- **Single Cloudflare Worker** serves static assets (Static Assets binding), 7 JSON API routes, an HTML confirmation page for Pumble link taps, and a daily `scheduled` cron handler — one deploy, one dashboard.
- **No Notion SDK** — raw `fetch` to the REST API. Smaller bundle, no Node-isms fighting the Workers runtime.
- **Atomic multi-book ops** via a shared `Dispatch ID` (server-generated UUID) stamped on every book row in the dispatch. Approve/recall queries by this ID and updates all rows together.
- **Catalogue caching** — three-layer staleness defense: 10-min TTL + manual refresh button + auto-invalidate on submit. Cache dropped on full reload.
- **Race-safe approvals** — server reads current status before mutating; second-actioner gets a branded "Already actioned by X" page.
- **Sequential Notion writes** — `await` in a `for` loop, not `Promise.all`, to respect the ~3 req/s rate limit.
- **Bundle size** — 167 KB raw / **53 KB gzipped**. No state lib, no router, no UI kit. Plain CSS with custom properties for the dark + gold design tokens.
- **CI/CD** — GitHub Actions runs `wrangler deploy` on every push to `main`.

Full file structure in [SETUP.md](./SETUP.md). Founder-facing deployment walkthrough also in [SETUP.md](./SETUP.md).

## Try it locally

```bash
git clone <repo>
cd gruhome-book-inventory-and-dispatch-tracker
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Open http://localhost:5173 for staff view, http://localhost:5173/?view=admin for the dashboard (demo PIN: `4729`). Demo mode is on by default — no Notion or Pumble needed to explore the UI.

## License

MIT — see [LICENSE](./LICENSE).

Built for Gruhome, a premium home-furnishings retailer in Delhi NCR. Code is open-source; brand and any client data shown in screenshots remain property of Gruhome.
