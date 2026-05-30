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
  approver1Pin: string;
  approver2Pin: string;
}

/** Legacy shape — KV records written before per-approver PINs were
 *  added. We migrate these on first read. */
interface LegacyConfigRecord extends Partial<AppConfigRecord> {
  adminPin?: string;
}

function parseSalespeople(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

function defaultsFromEnv(env: Env): AppConfigRecord {
  const seedPin = env.ADMIN_PIN || "";
  return {
    salespeople: parseSalespeople(env.SALESPEOPLE),
    approver1: env.APPROVER_1_NAME || "Owner",
    approver2: env.APPROVER_2_NAME || "Manager",
    approver1Pin: seedPin,
    approver2Pin: seedPin,
  };
}

/**
 * Promote a stored record to the current shape:
 *   - if both approver-pins are present, return as-is
 *   - if a legacy `adminPin` is present and approver-pins are not,
 *     copy it into both slots so neither approver is locked out
 *   - missing fields fall back to env defaults
 */
function migrate(stored: LegacyConfigRecord, env: Env): AppConfigRecord {
  const defaults = defaultsFromEnv(env);
  const seedPin = stored.adminPin ?? defaults.approver1Pin;
  return {
    salespeople: stored.salespeople ?? defaults.salespeople,
    approver1: stored.approver1 ?? defaults.approver1,
    approver2: stored.approver2 ?? defaults.approver2,
    approver1Pin: stored.approver1Pin ?? seedPin,
    approver2Pin: stored.approver2Pin ?? seedPin,
  };
}

export async function readConfig(env: Env): Promise<AppConfigRecord> {
  // If KV isn't bound yet (e.g. running locally before namespace exists),
  // fall back to env-only.
  if (!env.CONFIG_KV) return defaultsFromEnv(env);

  const stored = (await env.CONFIG_KV.get(KEY, "json")) as LegacyConfigRecord | null;
  if (stored && typeof stored === "object") {
    const promoted = migrate(stored, env);
    // Persist the migrated shape so subsequent reads are fast and
    // the legacy adminPin field stops floating around.
    const needsRewrite =
      stored.approver1Pin !== promoted.approver1Pin ||
      stored.approver2Pin !== promoted.approver2Pin ||
      "adminPin" in stored;
    if (needsRewrite) await env.CONFIG_KV.put(KEY, JSON.stringify(promoted));
    return promoted;
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
  if (next.approver1.trim() === next.approver2.trim()) {
    throw new Error("approver1 and approver2 cannot have the same name");
  }
  if (typeof next.approver1Pin !== "string" || !next.approver1Pin.trim()) {
    throw new Error("approver1Pin cannot be empty");
  }
  if (typeof next.approver2Pin !== "string" || !next.approver2Pin.trim()) {
    throw new Error("approver2Pin cannot be empty");
  }
  next.salespeople = next.salespeople
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  await env.CONFIG_KV.put(KEY, JSON.stringify(next));
  return next;
}

/** Resolve which slot an approver name occupies. Used by auth + Settings
 *  so callers don't have to know about "approver1" vs "approver2". */
export function approverSlot(
  config: AppConfigRecord,
  approver: string
): 1 | 2 | null {
  if (approver === config.approver1) return 1;
  if (approver === config.approver2) return 2;
  return null;
}

export function pinFor(config: AppConfigRecord, approver: string): string | null {
  const slot = approverSlot(config, approver);
  if (slot === 1) return config.approver1Pin;
  if (slot === 2) return config.approver2Pin;
  return null;
}
