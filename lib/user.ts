import { NextRequest } from "next/server";
import { getUserIdFromToken } from "./auth";

export async function getUserId(request: NextRequest): Promise<string> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    const userId = await getUserIdFromToken(token);
    if (userId) return userId;
  }
  const userId = request.headers.get("x-user-id")?.trim();
  return userId || "default";
}
