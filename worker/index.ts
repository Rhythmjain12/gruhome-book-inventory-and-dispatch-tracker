// Cloudflare Worker entry point. Single Worker handles:
//   - /api/*           — JSON endpoints called by the React app
//   - /approve         — HTML confirmation after a Pumble link tap
//   - everything else  — Served from the React SPA build (via ASSETS)
//   - scheduled()      — Daily overdue Pumble reminder (09:00 IST)

import { handleGetConfig } from "./routes/getConfig";
import { handleGetCatalogue } from "./routes/getCatalogue";
import { handleGetBooks } from "./routes/getBooks";
import { handleLogBook } from "./routes/logBook";
import { handleApproveLink, handleApprovePost } from "./routes/approveBook";
import { handleRecallBook } from "./routes/recallBook";
import { handleAdminLogin } from "./routes/adminLogin";
import { runOverdueCheck } from "./routes/overdueCheck";

export interface Env {
  ASSETS: Fetcher;

  NOTION_TOKEN: string;
  NOTION_CATALOGUE_DB_ID: string;
  NOTION_DISPATCH_DB_ID: string;
  PUMBLE_WEBHOOK_URL: string;
  PUMBLE_WEBHOOK_URL_STAFF: string;
  APP_BASE_URL: string;
  SALESPEOPLE: string;
  APPROVER_1_NAME: string;
  APPROVER_2_NAME: string;
  /** PIN / password protecting the admin dashboard and all mutations.
   *  Sent by the client as `Authorization: Bearer <PIN>`. */
  ADMIN_PIN: string;
  /** When "1", reads return canned data and writes succeed without
   *  touching Notion/Pumble. Visual-preview only — never set in prod. */
  DEMO_MODE?: string;
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function methodNotAllowed(): Response {
  return jsonError(405, "Method not allowed");
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // ---------- Pumble link landing page ----------
      if (url.pathname === "/approve") {
        if (method !== "GET") return methodNotAllowed();
        return await handleApproveLink(env, url);
      }

      // ---------- JSON API ----------
      if (url.pathname === "/api/get-config") {
        if (method !== "GET") return methodNotAllowed();
        return handleGetConfig(env);
      }
      if (url.pathname === "/api/get-catalogue") {
        if (method !== "GET") return methodNotAllowed();
        return await handleGetCatalogue(env);
      }
      if (url.pathname === "/api/get-books") {
        if (method !== "GET") return methodNotAllowed();
        return await handleGetBooks(request, env, url);
      }
      if (url.pathname === "/api/admin-login") {
        if (method !== "POST") return methodNotAllowed();
        return await handleAdminLogin(request, env);
      }
      if (url.pathname === "/api/log-book") {
        if (method !== "POST") return methodNotAllowed();
        return await handleLogBook(request, env);
      }
      if (url.pathname === "/api/approve-book") {
        if (method !== "POST") return methodNotAllowed();
        return await handleApprovePost(request, env);
      }
      if (url.pathname === "/api/recall-book") {
        if (method !== "POST") return methodNotAllowed();
        return await handleRecallBook(request, env);
      }

      // Unknown /api path
      if (url.pathname.startsWith("/api/")) {
        return jsonError(404, `No route for ${url.pathname}`);
      }
    } catch (err) {
      console.error("Worker error:", err);
      return jsonError(500, (err as Error).message ?? "Internal error");
    }

    // Static asset / SPA fallback
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runOverdueCheck(env).catch((err) => {
        console.error("Overdue check failed:", err);
      })
    );
  },
};
