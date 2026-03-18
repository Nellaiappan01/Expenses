import { NextRequest } from "next/server";

export function getUserId(request: NextRequest): string {
  const userId = request.headers.get("x-user-id")?.trim();
  return userId || "default";
}
