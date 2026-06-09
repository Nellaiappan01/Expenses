import { stockThumbUrl } from "./cloudinaryUrls";

export function serializeStockItem(i: Record<string, unknown>) {
  const photoUrl = (i.photoUrl as string) || "";
  return {
    _id: String(i._id),
    name: i.name ?? "",
    count: Number(i.count) || 0,
    valuePerUnit: Number(i.valuePerUnit) || 0,
    lastCheckAt: (i.lastCheckAt as Date)?.toISOString?.() ?? null,
    updatedAt: (i.updatedAt as Date)?.toISOString?.() ?? null,
    sku: i.sku ?? "",
    brand: i.brand ?? "",
    size: i.size ?? "",
    category: i.category ?? "",
    location: i.location ?? "",
    notes: i.notes ?? "",
    minStock: Number(i.minStock) || 0,
    hasPhoto: !!(i.hasPhoto || photoUrl),
    photoUrl: photoUrl || undefined,
    photoThumbUrl: photoUrl ? stockThumbUrl(photoUrl) : undefined,
  };
}
