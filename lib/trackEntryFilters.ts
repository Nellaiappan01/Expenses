export type TrackFilterParams = {
  from?: string | null;
  to?: string | null;
  category?: string | null;
  requestedBy?: string | null;
  approvedBy?: string | null;
  method?: string | null;
  tag?: string | null;
  search?: string | null;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchOr(search: string): Record<string, unknown>[] {
  const trimmed = search.trim();
  if (!trimmed) return [];

  const searchLower = trimmed.toLowerCase();
  const pattern = escapeRegex(trimmed);
  const or: Record<string, unknown>[] = [
    { name: { $regex: pattern, $options: "i" } },
    { nameLower: { $regex: searchLower, $options: "i" } },
    { approvedBy: { $regex: pattern, $options: "i" } },
    { approvedByLower: { $regex: searchLower, $options: "i" } },
    { category: { $regex: pattern, $options: "i" } },
    { note: { $regex: pattern, $options: "i" } },
    { method: { $regex: pattern, $options: "i" } },
    { tags: { $regex: pattern, $options: "i" } },
    { sender: { $regex: pattern, $options: "i" } },
    { bankName: { $regex: pattern, $options: "i" } },
    { type: { $regex: pattern, $options: "i" } },
  ];

  const numeric = Number(trimmed.replace(/[^0-9.]/g, ""));
  if (!Number.isNaN(numeric) && numeric > 0) {
    or.push({ amount: numeric });
  }

  return or;
}

/** MongoDB match for Track page list + WhatsApp summary (same filters). */
export function buildTrackEntryMatch(
  userId: string,
  filters: TrackFilterParams
): Record<string, unknown> {
  const match: Record<string, unknown> = { businessId: userId, deleted: { $ne: true } };

  const from = filters.from?.trim();
  const to = filters.to?.trim();
  if (from || to) {
    match.date = {};
    if (from) (match.date as Record<string, string>).$gte = from;
    if (to) (match.date as Record<string, string>).$lte = to;
  }

  const category = filters.category?.trim();
  if (category) {
    match.category = { $regex: `^${escapeRegex(category)}$`, $options: "i" };
  }

  const requestedBy = filters.requestedBy?.trim();
  if (requestedBy) {
    match.nameLower = requestedBy.toLowerCase();
  }

  const approvedBy = filters.approvedBy?.trim();
  if (approvedBy) {
    match.approvedByLower = approvedBy.toLowerCase();
  }

  const method = filters.method?.trim();
  if (method && ["Cash", "GPay", "Bank"].includes(method)) {
    match.method = method;
  }

  const tag = filters.tag?.trim();
  if (tag) {
    match.tags = { $regex: escapeRegex(tag), $options: "i" };
  }

  const search = filters.search?.trim();
  const searchOr = search ? buildSearchOr(search) : [];
  if (searchOr.length > 0) {
    match.$or = searchOr;
  }

  return match;
}

export function trackFiltersFromSearchParams(searchParams: URLSearchParams): TrackFilterParams {
  return {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    category: searchParams.get("category"),
    requestedBy: searchParams.get("requestedBy"),
    approvedBy: searchParams.get("approvedBy"),
    method: searchParams.get("method"),
    tag: searchParams.get("tag"),
    search: searchParams.get("search"),
  };
}
