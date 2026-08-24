import { apiFetch } from "./api";
import { clearBalanceCache } from "./balanceClient";

type CacheEntry = {
  data: unknown;
  expires: number;
};

const memory = new Map<string, CacheEntry>();
const USER_KEY = "ledger_user_id";

function currentUserTag() {
  if (typeof window === "undefined") return "anon";
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return "anon";
    const data = JSON.parse(stored) as { userId?: string };
    return data.userId || "anon";
  } catch {
    return "anon";
  }
}

export function cacheKey(url: string, method = "GET") {
  return `${currentUserTag()}:${method}:${url}`;
}

/** Drop every in-memory/session ledger cache. Call on login, logout, and user switch. */
export function resetSessionCaches() {
  memory.clear();
  clearBalanceCache();
}

export function readClientCache<T>(key: string): T | null {
  const hit = memory.get(key);
  if (!hit || hit.expires <= Date.now()) {
    if (hit) memory.delete(key);
    return null;
  }
  return hit.data as T;
}

export function writeClientCache(key: string, data: unknown, ttlMs: number) {
  memory.set(key, { data, expires: Date.now() + ttlMs });
}

export function invalidateClientCache(prefix?: string) {
  if (!prefix) {
    memory.clear();
    return;
  }
  for (const key of memory.keys()) {
    if (key.includes(prefix)) memory.delete(key);
  }
}

/** GET JSON with in-memory TTL cache. Returns stale data immediately when revalidating. */
export async function cachedApiJson<T>(
  url: string,
  ttlMs = 45_000
): Promise<{ data: T | null; fromCache: boolean }> {
  const key = cacheKey(url);
  const cached = readClientCache<T>(key);
  if (cached !== null) {
    void revalidateJson<T>(url, key, ttlMs);
    return { data: cached, fromCache: true };
  }

  const fresh = await revalidateJson<T>(url, key, ttlMs);
  return { data: fresh, fromCache: false };
}

async function revalidateJson<T>(url: string, key: string, ttlMs: number): Promise<T | null> {
  try {
    const res = await apiFetch(url);
    if (!res.ok) return readClientCache<T>(key);
    const data = (await res.json()) as T;
    writeClientCache(key, data, ttlMs);
    return data;
  } catch {
    return readClientCache<T>(key);
  }
}

export const LEDGER_DATA_CHANGED = "ledger-data-changed";

export function notifyLedgerDataChanged() {
  if (typeof window === "undefined") return;
  invalidateClientCache("/api/");
  window.dispatchEvent(new Event(LEDGER_DATA_CHANGED));
}
