import { stockThumbUrl } from "./cloudinaryUrls";

export function serializeStockRequest(
  r: Record<string, unknown>,
  item?: Record<string, unknown> | null
) {
  const photoUrl = (item?.photoUrl as string) || "";
  return {
    _id: (r._id as { toString: () => string }).toString(),
    stockId: r.stockId as string,
    businessId: r.businessId as string,
    qty: r.qty ?? 1,
    customerName: r.customerName ?? "Customer",
    customerPhone: r.customerPhone as string | undefined,
    note: r.note as string | undefined,
    resolutionNote: r.resolutionNote as string | undefined,
    status: r.status as string,
    createdAt: (r.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
    resolvedAt: (r.resolvedAt as Date)?.toISOString?.(),
    name: (item?.name as string) ?? r.stockId,
    godownCount: item?.count ?? 0,
    hasPhoto: !!(item?.hasPhoto || photoUrl),
    photoUrl: photoUrl || undefined,
    photoThumbUrl: photoUrl ? stockThumbUrl(photoUrl) : undefined,
    brand: item?.brand as string | undefined,
    size: item?.size as string | undefined,
  };
}
