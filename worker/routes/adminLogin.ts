// POST /api/admin-login
// Body: { pin: string }
// Returns 200 if the PIN matches ADMIN_PIN; 401 otherwise.
//
// On success the client stores the PIN in sessionStorage and sends it
// as a bearer token on every protected call. The server never issues a
// session token — we keep it dead simple: the PIN itself is the secret.

import type { Env } from "../index";

export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  let body: { pin?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const expected = (env.ADMIN_PIN ?? "").trim();
  if (!expected) {
    return json(500, { error: "ADMIN_PIN not configured on the server" });
  }
  if (typeof body.pin !== "string" || body.pin.trim() !== expected) {
    // Small fixed delay slows brute-force on a 4-digit PIN. Worker CPU
    // time during the wait is free (it's a setTimeout, not a busy loop).
    await new Promise((r) => setTimeout(r, 400));
    return json(401, { error: "Incorrect PIN" });
  }
  return json(200, { ok: true });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
