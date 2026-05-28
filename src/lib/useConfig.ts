// Singleton config loader. Config (salespeople, approver names) is read
// once per page load from the Worker — values come from env vars on the
// server side so the founder can update without a code deploy.

import { useEffect, useState } from "react";
import type { AppConfig } from "../types";
import { api } from "./api";

let cached: AppConfig | null = null;
let inflight: Promise<AppConfig> | null = null;

function load(): Promise<AppConfig> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = api.getConfig().then((c) => {
    cached = c;
    inflight = null;
    return c;
  });
  return inflight;
}

export function useConfig(): {
  config: AppConfig | null;
  error: string | null;
} {
  const [config, setConfig] = useState<AppConfig | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config) return;
    load()
      .then(setConfig)
      .catch((e) => setError((e as Error).message));
  }, [config]);

  return { config, error };
}
