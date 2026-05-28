# Gruhome — Sample Book Tracker

> A lightweight internal web tool that replaced "the books are missing again" with a tracked, auditable dispatch ledger — for a premium Indian home-furnishings retailer with two stores and 600+ physical sample books in active circulation.

[![Deploy](https://img.shields.io/badge/deploy-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Stack](https://img.shields.io/badge/stack-React%20%7C%20TypeScript%20%7C%20Notion%20API-2D3748)](#tech-stack)
[![Bundle](https://img.shields.io/badge/bundle-53%20KB%20gzipped-success)]()

---

## The problem

Gruhome's sales team walks fabric, wallpaper, and blinds **sample books** to client homes for project presentations. These are physical, single-copy assets — and they kept going missing. Recalls were forgotten. Management had zero visibility. With 600+ books and a 6-person sales team across two Delhi NCR stores (Preet Vihar + Noida), the manual spreadsheet had stopped working.

## What this is

A phone-first internal dispatch app:

- **Staff** log a client visit in **under 30 seconds** — multi-book search across the live catalogue, category and store filters, manual add for off-catalogue items.
- **Approvers** (owner + manager) get one-tap Approve/Reject in Pumble, with race-condition safety: first tap wins, second sees *"Already actioned by X"*.
- **Notion stays the source of truth** — every action writes back automatically. No manual data entry.
- **Daily overdue cron** pings the approver channel + the responsible salesperson directly.
- **PIN-gated admin dashboard** with metrics, filter pills, and detail-modal recall actions.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | React 18 + Vite + plain CSS | Spec-mandated React; Vite for speed; plain CSS because the design vocabulary is small (sand/gold tokens, two typefaces) and Tailwind would add 10× weight for no gain |
| **Hosting + API + Cron** | Single Cloudflare Worker (Static Assets + `fetch` + `scheduled`) | One deploy, one config, one env-var dashboard. Simpler for a non-technical founder than Pages + a separate cron Worker |
| **Database** | Notion REST API via raw `fetch` (no SDK) | Cleaner on the Workers runtime, lighter bundle. The founder already lived in Notion — extending her existing 600-book catalogue rather than recreating it was a hard requirement |
| **Notifications** | Pumble incoming webhooks (Slack-compatible) | Already used internally |
| **Auth** | PIN (server-validated) + URL view toggle | Phase 1 honor system for staff, hard gate for admin actions. Phase 2 will add Cloudflare Access |
| **CI/CD** | GitHub Actions → `wrangler deploy` | Auto-deploys every push to `main` |

**Bundle size:** 167 KB raw / **53 KB gzipped** (frontend). No state-management library, no router, no UI kit.

---

## Architecture

```
┌────────────────────────┐         ┌─────────────────────────┐
│  React SPA (Vite)      │  fetch  │  Cloudflare Worker      │
│  - Staff form          │ ──────► │  - 7 /api/* endpoints   │
│  - Admin dashboard     │         │  - /approve HTML page   │
│  - In-memory cache     │         │  - scheduled() cron     │
│  - sessionStorage PIN  │         └──────────┬──────────────┘
└────────────────────────┘                    │
                                              │ Notion REST
                                              │ Pumble webhook
                                              ▼
                                  ┌─────────────────────────┐
                                  │  Notion (2 databases)   │
                                  │  - Book Inventory       │
                                  │  - Dispatch Records     │
                                  └─────────────────────────┘
```

### Key engineering decisions

#### 1. **Atomic multi-book dispatches via shared Dispatch ID**
The spec defines one dispatch = many books. Implemented by generating a single `crypto.randomUUID()` server-side and stamping it on every book row created. Approval and recall queries Notion by this ID and updates all rows together. No partial-state bugs.

#### 2. **Catalogue cache with three-layer staleness defense**
The 600-book catalogue rarely changes but a stale "currently out" flag would let staff dispatch books that are already in the field. Solution:
- 10-minute in-memory TTL (forces re-fetch)
- Manual "Refresh" button in the search header
- Auto-invalidate after a successful submit (the just-dispatched books' availability is now stale)
- Cache dropped on page reload (no localStorage persistence)

#### 3. **Race-safe approval**
Two approvers, two link sets in each Pumble notification, each carrying the approver's name in the URL. The server reads current status *before* mutating — if already actioned, it returns a branded "Already actioned by X" HTML page, no double-action possible.

#### 4. **Sequential Notion fan-out**
Notion's REST API averages 3 req/s. A 10-book dispatch with `Promise.all` would burst over the limit and 429. All fan-outs use `await` in a `for` loop instead — slower but reliable. For a 6-person team, ~2s end-to-end is well within UX budget.

#### 5. **Dark + gold theme**
The founder's brand is premium and calm. Started with a sand/terracotta palette (matching the brand site), then iterated to dark/antique-gold per founder preference. Implemented as CSS custom properties so a future theme swap is a single file edit.

#### 6. **Demo mode**
A `DEMO_MODE=1` env flag short-circuits every endpoint with realistic fixtures — anyone can clone the repo and `npm run dev` to see the full UI without touching Notion. Useful for development, useful for evaluating the project from this README.

---

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in your secrets, or just set DEMO_MODE=1
npm run dev
# → React app on http://localhost:5173
# → Worker on http://localhost:8787
```

Try the demo without Notion: leave `DEMO_MODE=1` in `.dev.vars`, open http://localhost:5173 (staff) and http://localhost:5173/?view=admin (PIN: `4729`).

---

## Production deploy

See [SETUP.md](./SETUP.md) for the founder-facing walkthrough: Notion database setup, Pumble webhooks, Cloudflare deploy, env vars, salesperson list, end-to-end test.

For the CI/CD pipeline: a push to `main` triggers [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) which runs `wrangler deploy`. Required GitHub Actions secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

---

## Project structure

```
.
├── src/                 React + TypeScript frontend
│   ├── views/           StaffView, AdminView, DispatchForm, IdentityGate, AdminPinGate
│   ├── components/      Design-system primitives (Button, Pill, StatusBadge, Modal, ...)
│   ├── lib/             api client, catalogue cache, session, config loader
│   └── styles/          Global CSS with design tokens (dark + gold)
├── worker/              Cloudflare Worker
│   ├── routes/          7 endpoints + scheduled cron handler
│   └── lib/             Notion client, Pumble client, HTML templates, schema, auth
├── wrangler.toml        Cloudflare Worker config (committed, no secrets)
├── SETUP.md             Step-by-step founder deployment guide
└── README.md            ← you are here
```

---

## License

MIT — see [LICENSE](./LICENSE).

Built collaboratively as a real production system for [Gruhome](https://gruhome.in/). The architecture and code are open-source; the brand, copy, and any client data shown in screenshots are property of Gruhome.
