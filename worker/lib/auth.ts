// PIN-based admin gate, scoped per approver.
//
// The client sends:
//   X-Approver: <approver name>
//   Authorization: Bearer <PIN for that approver>
//
// Server validates that the PIN matches *that named approver's*
// stored PIN. Each approver can be rotated independently from Settings.

import type { Env } from "../index";
import { pinFor, readConfig } from "./configStore";

export interface AdminContext {
  approver: string;
}

/**
 * If the request is authorised, returns `{ approver }` for the caller
 * to use (e.g. to stamp Approved By). Otherwise returns a Response.
 */
export async function requireAdmin(
  request: Request,
  env: Env
): Promise<Response | AdminContext> {
  const approver = (request.headers.get("X-Approver") ?? "").trim();
  if (!approver) return err(401, "Missing X-Approver header");

  const config = await readConfig(env);
  const expected = pinFor(config, approver);
  if (expected === null) return err(401, `Unknown approver: ${approver}`);
  if (!expected) return err(500, `No PIN configured for ${approver}`);

  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (provided !== expected) return err(401, "Incorrect PIN");

  return { approver };
}

/** Convenience wrapper for routes that only need the gate (don't use
 *  the approver name afterwards). Returns `null` on success. */
export async function requireAdminGate(
  request: Request,
  env: Env
): Promise<Response | null> {
  const result = await requireAdmin(request, env);
  return result instanceof Response ? result : null;
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
