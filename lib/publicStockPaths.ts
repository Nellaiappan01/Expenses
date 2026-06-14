/** Public stock catalogue path for a godown login slug. */
export function publicStockViewPath(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return "/view";
  return `/${encodeURIComponent(normalized)}/view`;
}

export function publicStockViewUrl(slug: string, origin?: string): string {
  const path = publicStockViewPath(slug);
  if (origin) return `${origin.replace(/\/$/, "")}${path}`;
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return path;
}

export function publicViewSlug(
  username: string | null | undefined,
  userId: string | null | undefined
): string | null {
  const slug = (username || userId)?.trim().toLowerCase();
  return slug || null;
}

/** Decode slug from a /{slug}/view pathname segment. */
export function decodePublicSlugParam(segment: string): string {
  return normalizePublicSlugInput(segment);
}

function normalizePublicSlugInput(slug: string): string {
  try {
    return decodeURIComponent(slug).trim().toLowerCase();
  } catch {
    return slug.trim().toLowerCase();
  }
}
