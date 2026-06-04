import { apiFetch } from "@/lib/api";

export async function uploadStockPhoto(
  stockId: string,
  dataUrl: string
): Promise<{ photoUrl?: string; photoThumbUrl?: string } | null> {
  const res = await apiFetch(`/api/stock/${stockId}/photo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo: dataUrl }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { photoUrl: data.photoUrl, photoThumbUrl: data.photoThumbUrl };
}
