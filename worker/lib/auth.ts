// PIN-based admin gate. The PIN is sent as a bearer token on every
// privileged request. We compare against the live PIN in KV (falling
// back to the ADMIN_PIN env var until KV is seeded).
//
// This is Basic-Auth-grade security: fine for a private-URL internal
// tool over HTTPS, not fine for a public endpoint.

import type { Env } from "../index";
import { readConfig } from "./configStore";

/** Returns null if the request is authorised, or a 401 Response otherwise. */
export async function requireAdmin(
  request: Request,
  env: Env
): Promise<Response | null> {
  const config = await readConfig(env);
  const expected = config.adminPin.trim();
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
