import type { SerializedProduction } from "@/lib/dailyProduction";

export function formatProductionTonnes(tonnes: number) {
  return tonnes.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

export function formatProductionClock(iso: string | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function productionUpdatedLabel(production: Pick<SerializedProduction, "createdAt" | "updatedAt">) {
  const updated = formatProductionClock(production.updatedAt);
  if (!updated) return "";
  const createdMs = new Date(production.createdAt).getTime();
  const updatedMs = new Date(production.updatedAt).getTime();
  const wasUpdated = Number.isFinite(createdMs) && Number.isFinite(updatedMs) && updatedMs - createdMs > 2000;
  return wasUpdated ? `Updated ${updated}` : `Saved ${updated}`;
}
