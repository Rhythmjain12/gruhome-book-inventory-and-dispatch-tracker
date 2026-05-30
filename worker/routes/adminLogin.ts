// POST /api/admin-login
// Body: { approver: string, pin: string }
// Returns 200 if `pin` matches `approver`'s stored PIN; 401 otherwise.

import type { Env } from "../index";
import { pinFor, readConfig } from "../lib/configStore";

export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  let body: { approver?: string; pin?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (typeof body.approver !== "string" || !body.approver.trim()) {
    return json(400, { error: "approver required" });
  }
  if (typeof body.pin !== "string") {
    return json(400, { error: "pin required" });
  }

  const config = await readConfig(env);
  const expected = pinFor(config, body.approver.trim());
  if (expected === null) {
    return json(401, { error: `Unknown approver: ${body.approver}` });
  }
  if (!expected) {
    return json(500, { error: "PIN not configured" });
  }
  if (body.pin.trim() !== expected) {
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
