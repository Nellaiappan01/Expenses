export function friendlySheetsError(raw: string): string {
  const text = raw.toLowerCase();
  if (text.includes("row not found")) {
    return "Missing on the sheet — Sync All will add these rows.";
  }
  if (text.includes("timeout") || text.includes("timed out") || text.includes("aborted")) {
    return "The sheet was slow. Tap Sync All once more.";
  }
  if (text.includes("webhook") || text.includes("not configured")) {
    return "Add the Apps Script Web App URL in Account & Sheet.";
  }
  if (text.includes("already running")) {
    return "A write is already running. Wait a few seconds.";
  }
  return "Tap Sync All to retry.";
}

/** About 6 seconds per Google Sheet row. */
export function sheetsEtaLabel(rows: number): string {
  if (rows <= 0) return "";
  const sec = Math.max(6, rows * 6);
  if (sec < 60) return `~${sec} sec`;
  return `~${Math.ceil(sec / 60)} min`;
}
