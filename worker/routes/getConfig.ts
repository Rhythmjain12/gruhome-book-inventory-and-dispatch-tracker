// GET /api/get-config — returns the salesperson list and approver names.
// Reads from KV (which auto-seeds from env vars on first call).

import type { Env } from "../index";
import { readConfig } from "../lib/configStore";

export async function handleGetConfig(env: Env): Promise<Response> {
  const config = await readConfig(env);
  const body = {
    salespeople: config.salespeople,
    approvers: [config.approver1, config.approver2] as [string, string],
  };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
