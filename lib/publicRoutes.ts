const PUBLIC_PREFIXES = ["/view"];

export function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
