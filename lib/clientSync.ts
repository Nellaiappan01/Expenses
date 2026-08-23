import { apiFetch } from "./api";
import { flushOfflineQueue } from "./offlineEntryQueue";

export type SyncAllResult = {
  ok: boolean;
  offlineUploaded: number;
  offlineRemaining: number;
  sheetsSucceeded: number;
  sheetsFailed: number;
  message: string;
  counts?: { pending: number; failed: number; total: number };
};

/** One tap: upload offline entries + retry all Google Sheets sync. */
export async function syncEverything(): Promise<SyncAllResult> {
  const offline = await flushOfflineQueue();

  let sheetsSucceeded = 0;
  let sheetsFailed = 0;
  let counts = { pending: 0, failed: 0, total: 0 };

  try {
    const res = await apiFetch("/api/sheets/sync-all", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      sheetsSucceeded = data.succeeded ?? 0;
      sheetsFailed = data.failed ?? 0;
      counts = data.counts ?? counts;
    }
  } catch {
    /* server unreachable — offline flush may still have worked */
  }

  const parts: string[] = [];
  if (offline.uploaded > 0) {
    parts.push(`${offline.uploaded} offline ${offline.uploaded === 1 ? "entry" : "entries"} uploaded`);
  }
  if (sheetsSucceeded > 0) {
    parts.push(`${sheetsSucceeded} sheet ${sheetsSucceeded === 1 ? "row" : "rows"} synced`);
  }
  if (offline.failed > 0) {
    parts.push(`${offline.failed} still waiting (offline)`);
  }
  if (sheetsFailed > 0) {
    parts.push(`${sheetsFailed} sheet sync still failed`);
  }

  const ok = offline.failed === 0 && sheetsFailed === 0 && counts.total === 0;
  const message =
    parts.length > 0 ? parts.join(". ") + "." : "Everything is up to date.";

  window.dispatchEvent(new Event("sync-all-complete"));

  return {
    ok,
    offlineUploaded: offline.uploaded,
    offlineRemaining: offline.failed,
    sheetsSucceeded,
    sheetsFailed,
    message,
    counts,
  };
}
