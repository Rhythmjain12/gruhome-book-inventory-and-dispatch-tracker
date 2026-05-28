// Runtime-editable config layer.
//
// On the first read after deploy, KV is empty — we seed it from env
// vars so the existing secrets keep working with zero migration. After
// the seed, KV is the source of truth; env vars remain inert defaults
// (used only as a safety net if a KV key is somehow missing).
//
// Stored as a single JSON blob under one key to keep writes atomic.

import type { Env } from "../index";

const KEY = "app-config";

export interface AppConfigRecord {
  salespeople: string[];
  approver1: string;
  approver2: string;
  adminPin: string;
}

function parseSalespeople(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

function defaultsFromEnv(env: Env): AppConfigRecord {
  return {
    salespeople: parseSalespeople(env.SALESPEOPLE),
    approver1: env.APPROVER_1_NAME || "Owner",
    approver2: env.APPROVER_2_NAME || "Manager",
    adminPin: env.ADMIN_PIN || "",
  };
}

export async function readConfig(env: Env): Promise<AppConfigRecord> {
  // If KV isn't bound yet (e.g. running locally before namespace exists),
  // fall back to env-only.
  if (!env.CONFIG_KV) return defaultsFromEnv(env);

  const stored = await env.CONFIG_KV.get(KEY, "json");
  if (stored && typeof stored === "object") {
    // Merge with env defaults so a partially-written record still works.
    return { ...defaultsFromEnv(env), ...(stored as Partial<AppConfigRecord>) };
  }

  // First-time seed.
  const seed = defaultsFromEnv(env);
  await env.CONFIG_KV.put(KEY, JSON.stringify(seed));
  return seed;
}

export async function writeConfig(
  env: Env,
  patch: Partial<AppConfigRecord>
): Promise<AppConfigRecord> {
  if (!env.CONFIG_KV) {
    throw new Error("CONFIG_KV binding is missing — wrangler.toml not deployed yet");
  }
  const current = await readConfig(env);
  const next: AppConfigRecord = { ...current, ...patch };
  // Light validation — prevents accidental empty-list / empty-PIN lockouts.
  if (!Array.isArray(next.salespeople)) {
    throw new Error("salespeople must be an array");
  }
  if (typeof next.approver1 !== "string" || !next.approver1.trim()) {
    throw new Error("approver1 cannot be empty");
  }
  if (typeof next.approver2 !== "string" || !next.approver2.trim()) {
    throw new Error("approver2 cannot be empty");
  }
  if (typeof next.adminPin !== "string" || !next.adminPin.trim()) {
    throw new Error("adminPin cannot be empty");
  }
  next.salespeople = next.salespeople
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  await env.CONFIG_KV.put(KEY, JSON.stringify(next));
  return next;
}
