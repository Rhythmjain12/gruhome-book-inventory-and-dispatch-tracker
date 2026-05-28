// Identity is stored in localStorage so staff/admins don't re-select on
// every visit. Phase 2 will replace this with real auth.

import { useEffect, useState } from "react";

const KEYS = {
  salesperson: "gruhome:salesperson",
  approver: "gruhome:approver",
  adminPin: "gruhome:admin-pin",
} as const;

/** The admin PIN lives in *sessionStorage* (not localStorage) so it
 *  clears when the tab closes. The api client reads it on every call;
 *  on a 401 we clear it and the AdminPinGate re-renders. */
export function getAdminPin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(KEYS.adminPin);
  } catch {
    return null;
  }
}
export function setAdminPin(pin: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (pin === null) window.sessionStorage.removeItem(KEYS.adminPin);
    else window.sessionStorage.setItem(KEYS.adminPin, pin);
  } catch { /* ignore */ }
  // Notify subscribers — sessionStorage events don't fire same-tab.
  for (const l of pinListeners) l();
}

const pinListeners = new Set<() => void>();
export function subscribePin(cb: () => void): () => void {
  pinListeners.add(cb);
  return () => { pinListeners.delete(cb); };
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — fall back to in-memory only */
  }
}

/** Stateful hook for one localStorage-backed identity field. */
function useStored(key: string): [string | null, (next: string | null) => void] {
  const [value, setValue] = useState<string | null>(() => read(key));
  const set = (next: string | null) => {
    write(key, next);
    setValue(next);
  };
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  return [value, set];
}

export const useSalesperson = () => useStored(KEYS.salesperson);
export const useApprover = () => useStored(KEYS.approver);
