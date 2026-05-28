// In-memory catalogue cache with a TTL + manual + mutation-triggered
// invalidation. Lives at module scope so it survives view switches but is
// dropped on full page reload (deliberate — keeps stale data out of the
// long-running tab).
//
// Staleness guards:
//   1. TTL_MS — forces a refresh after 10 minutes
//   2. invalidate() — called on submit / manual book add
//   3. Page reload always re-fetches

import { useCallback, useEffect, useState } from "react";
import type { Book } from "../types";
import { api, ApiError } from "./api";

const TTL_MS = 10 * 60 * 1000;

interface CacheState {
  books: Book[];
  loadedAt: number;
}

let cache: CacheState | null = null;
let inflight: Promise<Book[]> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function isFresh(state: CacheState | null): state is CacheState {
  return state !== null && Date.now() - state.loadedAt < TTL_MS;
}

async function load(force: boolean): Promise<Book[]> {
  if (!force && isFresh(cache)) return cache.books;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const books = await api.getCatalogue();
      cache = { books, loadedAt: Date.now() };
      notify();
      return books;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function invalidateCatalogue() {
  cache = null;
  notify();
}

export interface CatalogueState {
  books: Book[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  loadedAt: number | null;
}

export function useCatalogue(): CatalogueState {
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!cache);

  useEffect(() => {
    const sub = () => force((n) => n + 1);
    listeners.add(sub);
    return () => {
      listeners.delete(sub);
    };
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    load(true)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (cache) return;
    setLoading(true);
    load(false)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return {
    books: cache?.books ?? null,
    loading,
    error,
    refresh,
    loadedAt: cache?.loadedAt ?? null,
  };
}
