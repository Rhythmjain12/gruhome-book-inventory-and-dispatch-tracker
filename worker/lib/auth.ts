// PIN-based admin gate. The PIN is sent as a bearer token on every
// privileged request. The server compares against ADMIN_PIN env var.
//
// This is Basic-Auth-grade security: fine for a private-URL internal
// tool over HTTPS, not fine for a public endpoint. Phase 2 should
// replace this with Cloudflare Access (Google SSO).

import type { Env } from "../index";

/** Returns null if the request is authorised, or a 401 Response otherwise. */
export function requireAdmin(request: Request, env: Env): Response | null {
  const expected = (env.ADMIN_PIN ?? "").trim();
  if (!expected) {
    return new Response(
      JSON.stringify({ error: "ADMIN_PIN is not configured on the server" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}
