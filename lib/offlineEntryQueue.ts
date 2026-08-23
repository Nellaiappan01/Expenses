import type { EntryInput } from "./types";
import { getApiHeaders, apiFetch } from "./api";

const OFFLINE_QUEUE_PREFIX = "ledger_offline_entries";

export type OfflineQueuedEntry = EntryInput & {
  clientId: string;
  queuedAt: string;
};

function queueKey(): string {
  if (typeof window === "undefined") return `${OFFLINE_QUEUE_PREFIX}:default`;
  const headers = getApiHeaders();
  const userId = headers["X-User-Id"] || "default";
  return `${OFFLINE_QUEUE_PREFIX}:${userId}`;
}

function readQueue(): OfflineQueuedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(queueKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueuedEntry[]) {
  if (typeof window === "undefined") return;
  if (items.length === 0) {
    localStorage.removeItem(queueKey());
    return;
  }
  localStorage.setItem(queueKey(), JSON.stringify(items));
}

export function getOfflineQueueCount(): number {
  return readQueue().length;
}

export function getOfflineQueue(): OfflineQueuedEntry[] {
  return readQueue();
}

export function queueOfflineEntry(entry: EntryInput): OfflineQueuedEntry {
  const item: OfflineQueuedEntry = {
    ...entry,
    clientId: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    queuedAt: new Date().toISOString(),
  };
  writeQueue([...readQueue(), item]);
  window.dispatchEvent(new Event("offline-queue-updated"));
  return item;
}

export function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("failed to fetch") ||
      msg.includes("network") ||
      msg.includes("load failed")
    );
  }
  return false;
}

export type FlushOfflineResult = {
  uploaded: number;
  failed: number;
  errors: string[];
};

/** Push locally queued entries to the server. */
export async function flushOfflineQueue(): Promise<FlushOfflineResult> {
  const queue = readQueue();
  if (queue.length === 0) {
    return { uploaded: 0, failed: 0, errors: [] };
  }

  const remaining: OfflineQueuedEntry[] = [];
  let uploaded = 0;
  const errors: string[] = [];

  for (const item of queue) {
    const { clientId: _c, queuedAt: _q, ...payload } = item;
    try {
      const res = await apiFetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok || res.status === 502) {
        uploaded += 1;
        continue;
      }

      const data = await res.json().catch(() => ({}));
      errors.push((data as { error?: string }).error || `Upload failed (${res.status})`);
      remaining.push(item);
    } catch (err) {
      if (isNetworkFailure(err)) {
        remaining.push(item);
        break;
      }
      errors.push(err instanceof Error ? err.message : "Upload failed");
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  window.dispatchEvent(new Event("offline-queue-updated"));
  return { uploaded, failed: remaining.length, errors };
}
