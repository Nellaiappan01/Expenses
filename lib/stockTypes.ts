export type StockItem = {
  _id: string;
  name: string;
  count: number;
  valuePerUnit: number;
  lastCheckAt: string | null;
  sku?: string;
  brand?: string;
  size?: string;
  category?: string;
  location?: string;
  notes?: string;
  minStock?: number;
  hasPhoto?: boolean;
  photoUrl?: string;
  photoThumbUrl?: string;
};

export type StockFilter = "all" | "in_stock" | "empty" | "low" | "stale";
export type StockSort = "name" | "count_desc" | "value_desc" | "last_check";

export function stockPhotoUrl(id: string, cacheBust?: number): string {
  return cacheBust
    ? `/api/stock/${id}/photo?t=${cacheBust}`
    : `/api/stock/${id}/photo`;
}

export async function compressImageFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 960;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
