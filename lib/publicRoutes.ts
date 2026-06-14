const PUBLIC_PREFIXES = ["/view"];

/** Matches /view and /:username/view public stock pages */
export function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  return /^\/[^/]+\/view(\/|$)/.test(pathname);
}
