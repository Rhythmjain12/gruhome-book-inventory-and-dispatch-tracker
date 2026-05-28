// GET /api/get-config — returns the salesperson list and approver names
// so the founder can change them via Cloudflare env vars without a deploy.

import type { Env } from "../index";

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function handleGetConfig(env: Env): Response {
  const body = {
    salespeople: parseList(env.SALESPEOPLE),
    approvers: [
      env.APPROVER_1_NAME || "Owner",
      env.APPROVER_2_NAME || "Manager",
    ] as [string, string],
  };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
