import { apiFetch, readApiJson } from "./api";
import { flushOfflineQueue } from "./offlineEntryQueue";
import { sheetsEtaLabel } from "./sheetsSyncCopy";

export type SyncAllResult = {
  ok: boolean;
  offlineUploaded: number;
  offlineRemaining: number;
  sheetsSucceeded: number;
  sheetsFailed: number;
  message: string;
  counts?: { pending: number; failed: number; total: number };
};

let syncInFlight: Promise<SyncAllResult> | null = null;

/** One tap: upload offline entries + retry Google Sheets sync (batched, no double-run). */
export async function syncEverything(): Promise<SyncAllResult> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const offline = await flushOfflineQueue();

    let sheetsSucceeded = 0;
    let sheetsFailed = 0;
    let counts = { pending: 0, failed: 0, total: 0 };
    let hasMore = true;
    let batches = 0;
    const maxBatches = 8;

    try {
      while (hasMore && batches < maxBatches) {
        batches += 1;
        const res = await apiFetch("/api/sheets/sync-all", { method: "POST" });
        const data = await readApiJson<{
          succeeded?: number;
          failed?: number;
          hasMore?: boolean;
          counts?: { pending: number; failed: number; total: number; removing?: number };
        }>(res);

        if (!res.ok) break;

        const batchSucceeded = data.succeeded ?? 0;
        sheetsSucceeded += batchSucceeded;
        sheetsFailed += data.failed ?? 0;
        counts = data.counts ?? counts;
        hasMore = Boolean(data.hasMore);

        if (!hasMore) break;
        // Same failed rows will not succeed by hammering the sheet.
        if (batchSucceeded === 0) break;
        await new Promise((r) => setTimeout(r, 250));
      }
    } catch {
      /* server unreachable — offline flush may still have worked */
    }

    const ok = offline.failed === 0 && counts.total === 0;
    const message = ok
      ? "Sheet is up to date."
      : `${counts.pending} waiting · ${counts.failed} failed · ${sheetsEtaLabel(counts.total)}`;

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
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}
