"use client";

import type { SheetsSyncStatus } from "@/lib/types";

export function resolveSyncStatus(entry: {
  sheetsSyncStatus?: SheetsSyncStatus;
  sheetsSyncedAt?: string | Date;
}): SheetsSyncStatus | null {
  if (entry.sheetsSyncStatus) return entry.sheetsSyncStatus;
  if (entry.sheetsSyncedAt) return "synced";
  return null;
}

const STYLES: Record<SheetsSyncStatus, string> = {
  synced: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

const LABELS: Record<SheetsSyncStatus, string> = {
  synced: "Synced",
  pending: "Pending",
  failed: "Failed",
};

export default function SyncStatusBadge({
  status,
  compact = false,
}: {
  status: SheetsSyncStatus | null;
  compact?: boolean;
}) {
  if (!status) return null;

  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${STYLES[status]} ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      {LABELS[status]}
    </span>
  );
}
