// POST /api/admin/update-config — PIN-gated. Body: partial config patch.
//
// `myPin` (optional): the active approver's new PIN. The server resolves
// which slot to update from the X-Approver header — an approver can only
// rotate their *own* PIN, never the other approver's.
//
// `salespeople`, `approver1`, `approver2` (optional): editable by either
// approver. If an approver renames themselves, they're signed out (their
// X-Approver header no longer matches anyone in config) and just need
// to re-pick + re-PIN. Rare enough not to optimise for.

import type { Env } from "../index";
import { requireAdmin } from "../lib/auth";
import {
  approverSlot,
  readConfig,
  writeConfig,
  type AppConfigRecord,
} from "../lib/configStore";

interface UpdateBody {
  salespeople?: string[];
  approver1?: string;
  approver2?: string;
  myPin?: string;
}

export async function handleUpdateConfig(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const { approver } = auth;

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

  if (typeof body.myPin === "string") {
    const current = await readConfig(env);
    const slot = approverSlot(current, approver);
    if (slot === 1) patch.approver1Pin = body.myPin;
    else if (slot === 2) patch.approver2Pin = body.myPin;
    else return json(401, { error: `Unknown approver: ${approver}` });
  }

  try {
    const next = await writeConfig(env, patch);
    return json(200, {
      salespeople: next.salespeople,
      approvers: [next.approver1, next.approver2],
      ...(body.myPin !== undefined ? { newPin: body.myPin } : {}),
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
