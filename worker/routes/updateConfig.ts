// POST /api/admin/update-config — PIN-gated. Body: partial config patch.
// Validates, writes to KV, returns the new full config.

import type { Env } from "../index";
import { requireAdmin } from "../lib/auth";
import { writeConfig, type AppConfigRecord } from "../lib/configStore";

interface UpdateBody {
  salespeople?: string[];
  approver1?: string;
  approver2?: string;
  /** If present, also returns this as `newPin` in the response so the
   *  active admin session can keep the bearer in sync. */
  adminPin?: string;
}

export async function handleUpdateConfig(
  request: Request,
  env: Env
): Promise<Response> {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  let body: UpdateBody;
  try {
    body = await request.json<UpdateBody>();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const patch: Partial<AppConfigRecord> = {};
  if (Array.isArray(body.salespeople)) patch.salespeople = body.salespeople;
  if (typeof body.approver1 === "string") patch.approver1 = body.approver1;
  if (typeof body.approver2 === "string") patch.approver2 = body.approver2;
  if (typeof body.adminPin === "string") patch.adminPin = body.adminPin;

  try {
    const next = await writeConfig(env, patch);
    return json(200, {
      salespeople: next.salespeople,
      approvers: [next.approver1, next.approver2],
      // Echo back the PIN only if it was just set, so the client can
      // update its sessionStorage and keep its bearer in sync. Never
      // returned otherwise.
      ...(patch.adminPin !== undefined ? { newPin: next.adminPin } : {}),
    });
  } catch (e) {
    return json(400, { error: (e as Error).message });
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
