import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const OPEN_PREFIXES = ["/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/public/"];

function isOpenApi(pathname: string): boolean {
  return OPEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/") || isOpenApi(pathname)) {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
