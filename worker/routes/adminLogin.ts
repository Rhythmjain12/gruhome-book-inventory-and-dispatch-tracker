// POST /api/admin-login
// Body: { pin: string }
// Returns 200 if the PIN matches the live config; 401 otherwise.

import type { Env } from "../index";
import { readConfig } from "../lib/configStore";

export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  let body: { pin?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const config = await readConfig(env);
  const expected = config.adminPin.trim();
  if (!expected) {
    return json(500, { error: "ADMIN_PIN not configured on the server" });
  }
  if (typeof body.pin !== "string" || body.pin.trim() !== expected) {
    // Small fixed delay slows brute-force on a short PIN.
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
