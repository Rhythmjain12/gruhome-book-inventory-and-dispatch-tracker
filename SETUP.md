# Gruhome — Setup Guide

A step-by-step walkthrough for getting this app live on Cloudflare. Written for a non-technical reader. If something doesn't work, jump to **Troubleshooting** at the bottom.

Total time: ~45 minutes for first deploy, ~5 minutes for redeploys.

---

## 0. What you need

Sign up / install these once. All free for our scale.

| | Why | Link |
|---|---|---|
| **Notion account** | Database for books and dispatches | https://notion.so |
| **Pumble workspace** | Notifications | https://pumble.com |
| **Cloudflare account** | Hosts the app | https://dash.cloudflare.com/sign-up |
| **Node.js 20+** | To build and deploy from your laptop | https://nodejs.org |
| **A folder of this code on your laptop** | What you'll deploy | (you have it) |

> 💡 If you already have Node.js, check with `node --version` in Terminal. Anything `v20.*` or higher is fine.

---

## 1. Set up Notion

### 1a. Find your existing Book Catalogue database ID

1. Open your Book Catalogue in Notion in a browser.
2. Click the **`...`** menu (top right) → **Copy link to view**.
3. Paste the link somewhere. It looks like:
   `https://www.notion.so/yourworkspace/12345abcdef0987654321fedcba0/Book-Catalogue?v=...`
4. The **32 characters** before the `?v=` (no dashes counted) is your **`NOTION_CATALOGUE_DB_ID`**. Save it.

### 1b. Add four columns to the catalogue

Open the catalogue, then add these columns. Use the exact names shown.

| Column name | Type |
|---|---|
| `Home Store` | **Select** — add two options: `Preet Vihar` and `Noida` |
| `Currently Out` | Optional — you can skip this (the app computes it live) |
| `Dispatches` | **Relation** — link to the *Dispatch Records* database (you'll create it in 1c, then come back) |

Make sure each book row has its `Home Store` filled in. Books with no `Home Store` will default to `Preet Vihar`.

### 1c. Create the Dispatch Records database

In Notion, create a new **full-page database** called `Dispatch Records`. Add these columns **with exactly these names** (the app expects them):

| Column name | Type | Options / notes |
|---|---|---|
| `Book Name` | **Title** | The default title column — just rename it |
| `Dispatch ID` | **Text** | |
| `Book` | **Relation** | Link to your **Book Catalogue** database. Disable "Show on Book Catalogue" or leave on — your choice. |
| `Category` | **Select** | Options: `Fabric`, `Wallpaper`, `Leather`, `Blinds`, `Carpet`, `Flooring`, `Upholstery`, `Other` |
| `Salesperson` | **Select** | Add one option per salesperson (must match the `SALESPEOPLE` env var later — see step 4) |
| `Store` | **Select** | Options: `Preet Vihar`, `Noida` |
| `Client Name` | **Text** | |
| `Client Phone` | **Text** | |
| `Client Address` | **Text** | |
| `Return By` | **Date** | |
| `Date Sent` | **Date** | |
| `Purpose` | **Text** | |
| `Status` | **Select** | Options: `Pending Approval`, `Out in Field`, `Rejected`, `Recalled` |
| `Approved By` | **Text** | |
| `Approved At` | **Date** | |
| `Recalled At` | **Date** | |

Then **copy the database ID** the same way you did for the catalogue. This is your **`NOTION_DISPATCH_DB_ID`**.

> 💡 If you spelled any column name differently, the app will fail with a "property does not exist" error from Notion. Renaming the column is enough — no redeploy needed.

### 1d. Create a Notion integration

The app talks to Notion using a secret token tied to a custom **integration**.

1. Go to https://www.notion.so/my-integrations
2. Click **New integration** → name it `Gruhome App`.
3. Pick your workspace. Capability level: **Read content** + **Update content** + **Insert content**. (User capabilities can stay off.)
4. Click **Submit**. Copy the **Internal Integration Secret** (starts with `secret_…`). This is your **`NOTION_TOKEN`**.

### 1e. Share the databases with the integration

The integration only sees databases that are explicitly shared with it.

1. Open your **Book Catalogue** in Notion.
2. Click the **`...`** menu (top right) → **Connections** → **Add connections** → pick `Gruhome App`.
3. Repeat for the **Dispatch Records** database.

---

## 2. Set up Pumble

You need two webhooks — one for the approver channel, one for the staff channel.

### 2a. Approver channel webhook (`PUMBLE_WEBHOOK_URL`)

1. Create or open the channel where the **owner and manager** both read messages (e.g. `#sample-books-approvals`).
2. Click the channel name → **Apps & Integrations** → **Incoming Webhooks** → **Add**.
3. Name it `Gruhome App — Approvals`. Copy the webhook URL.

### 2b. Staff channel webhook (`PUMBLE_WEBHOOK_URL_STAFF`)

1. Open the channel where all salespeople read (e.g. `#sample-books-staff`).
2. Repeat the same steps to add an incoming webhook. Name it `Gruhome App — Staff`.
3. Copy the second URL.

### 2c. ⚠ Display names must match exactly

When the daily overdue reminder mentions a salesperson, the app types `@Neha` (or whatever name is in `SALESPEOPLE`). Pumble only turns that into a real ping if **`Neha` matches the salesperson's display name in Pumble exactly** — case, spaces, everything.

Walk each salesperson's Pumble profile → **Display name** → make sure it equals what you'll put in `SALESPEOPLE` in step 4.

---

## 3. Deploy to Cloudflare

### 3a. Open Terminal in the project folder

```bash
cd /path/to/Gruhome
```

### 3b. Install dependencies (one time)

```bash
npm install
```

### 3c. Log in to Cloudflare

```bash
npx wrangler login
```

A browser window opens — approve the login. The token gets saved on your laptop; you won't need to do this again.

### 3d. First deploy

```bash
npm run deploy
```

Cloudflare will create the Worker on its end and print a URL like:

```
https://gruhome.your-subdomain.workers.dev
```

**Copy this URL.** This is your `APP_BASE_URL` for step 4. (You can also bind a custom domain later — see Cloudflare's docs.)

---

## 4. Configure environment variables

The Worker needs nine values to do its job. **Secrets** (Notion token, Pumble webhooks) go in via `wrangler secret`. **Non-secrets** (names, base URL) go in `wrangler.toml`.

### 4a. Add the secrets (one command each)

Paste the value when prompted.

```bash
npx wrangler secret put NOTION_TOKEN
npx wrangler secret put NOTION_CATALOGUE_DB_ID
npx wrangler secret put NOTION_DISPATCH_DB_ID
npx wrangler secret put PUMBLE_WEBHOOK_URL
npx wrangler secret put PUMBLE_WEBHOOK_URL_STAFF
npx wrangler secret put ADMIN_PIN
```

> 💡 `ADMIN_PIN` is the password approvers will type to open the admin dashboard. Pick 4–8 digits or any short phrase — share it only with the two approvers. To change it later, re-run the same command with a new value.

### 4b. Add the non-secret values

Open `wrangler.toml` in any text editor. Find the commented `[vars]` block near the bottom and uncomment it, replacing the placeholder values:

```toml
[vars]
APP_BASE_URL = "https://gruhome.your-subdomain.workers.dev"
SALESPEOPLE = "Neha,Amit,Ravi"
APPROVER_1_NAME = "Sunita Gupta"
APPROVER_2_NAME = "Rohan Gupta"
```

Notes:
- `SALESPEOPLE` is **comma-separated**, no spaces around the commas, exact spellings.
- `APPROVER_1_NAME` and `APPROVER_2_NAME` are how Notion will record the "Approved By" field, and how the dashboard greets the user.

### 4c. Deploy again with the new values

```bash
npm run deploy
```

Done. Open `APP_BASE_URL` in a browser to see it live.

---

## 5. Test the full flow

Walk through it once before letting staff use it.

1. Visit `https://gruhome.your-subdomain.workers.dev` — you should see the staff identity gate with the names from `SALESPEOPLE`. Pick a name.
2. Submit a test dispatch with 1–2 books, a real return-by date, your own phone as the client phone.
3. Check the approver Pumble channel — you should see a message with all the details and two link sets ("Approve as Sunita Gupta", etc).
4. Tap **Approve** on either link. A confirmation page opens.
5. Visit `https://gruhome.your-subdomain.workers.dev/?view=admin` — pick yourself as approver. The dispatch should show as **Out in Field**.
6. Open the dispatch in the dashboard → **Mark all books recalled**. Confirm the staff Pumble channel got the recall message with the salesperson `@mention`.
7. In Notion, verify the dispatch rows are marked `Recalled` with a `Recalled At` timestamp.

---

## 6. Day-to-day operations

### Add or remove a salesperson

1. Edit `wrangler.toml` → update the `SALESPEOPLE` value.
2. Run `npm run deploy`.
3. Tell the salesperson to clear their browser data or tap "Not you?" on the app — they'll see the updated list.

> Notion auto-creates the new name as a Select option in the Dispatch Records DB the first time that person submits a dispatch — you don't need to add it manually. If you removed a salesperson, leave their option in Notion so historical rows still render.

### Change an approver

1. Edit `wrangler.toml` → update `APPROVER_1_NAME` or `APPROVER_2_NAME`.
2. `npm run deploy`.
3. The new approver should refresh `?view=admin` and tap "Not you?" to re-pick identity.

### Add new books to the catalogue

Just add them in Notion (existing workflow). The app picks them up within 10 minutes, or the staff member can tap **Refresh** in the book-search header to fetch immediately.

### Daily overdue reminder

Runs automatically at **09:00 IST** via Cloudflare Cron (configured in `wrangler.toml`). You don't need to do anything.

To run it manually (e.g. to test):

```bash
npx wrangler cron trigger gruhome --cron "30 3 * * *"
```

---

## 7. Privacy & security

- **Admin dashboard is PIN-locked.** Approvers type `ADMIN_PIN` once per browser session to view the dashboard or action any dispatch. The PIN is stored in the browser's session storage and clears when the tab closes (or when an approver taps **Lock**).
- **Staff side has no login.** Anyone with the URL can submit a dispatch — Phase 1 honors the salesperson identity at face value. Treat the Worker URL as a shared internal secret; don't post it on a public site.
- **Approvers are identified by URL.** The approve/reject links in Pumble include the approver's name. Phase 1 trusts whoever taps the link (the Pumble channel itself is the perimeter).
- **Changing the PIN:** re-run `npx wrangler secret put ADMIN_PIN` and `npm run deploy`. Any session that has the old PIN cached will be kicked back to the PIN screen on the next action.
- For Phase 2 we'll add Cloudflare Access (Google SSO) to replace the PIN gate and to authenticate staff too.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| App loads but shows "Couldn't load config" | Worker can't reach Cloudflare environment — try `npm run deploy` again |
| Dispatch form's "Search books" shows "Catalogue failed to load" | Either `NOTION_TOKEN` is wrong, the integration isn't shared with the catalogue DB (see 1e), or the catalogue DB ID is wrong |
| Notion error: "Property X does not exist" | A column in the Dispatch Records database has a wrong name. Compare against the table in step 1c |
| Notion error: "Option Y is not a valid select option" | Rare — Notion usually auto-creates new Select options. If it fails, open the column → property settings → add the value as an option manually |
| Pumble messages don't arrive | Webhook URL wrong, or the webhook was deleted in Pumble — recreate it and re-set the secret |
| Pumble `@mention` doesn't ping the salesperson | The display name in Pumble doesn't exactly match the name in `SALESPEOPLE`. Update the Pumble profile or the env var |
| "Already actioned by X" page | Not a bug. The other approver tapped first |
| Salesperson sees old book availability | Tap **Refresh** in the search header, or wait 10 minutes |
| Cron didn't fire at 09:00 IST | Check Cloudflare dashboard → Workers → gruhome → **Triggers** tab. Verify the cron schedule and recent executions |

If you're stuck and the table above doesn't help, the Worker's logs are the best diagnostic. View them with:

```bash
npx wrangler tail
```

Run that command in Terminal, then reproduce the issue in the browser — logs will print as it happens.

---

## Quick command reference

| Task | Command |
|---|---|
| First-time deps install | `npm install` |
| Local dev (frontend at :5173) | `npm run dev` |
| Production deploy | `npm run deploy` |
| Set a secret | `npx wrangler secret put NAME` |
| Tail live logs | `npx wrangler tail` |
| Trigger cron manually | `npx wrangler cron trigger gruhome --cron "30 3 * * *"` |
