import { NextRequest } from "next/server";
import { getUserIdFromToken } from "./auth";

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Sign in required");
    this.name = "UnauthorizedError";
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof UnauthorizedError || (error instanceof Error && error.name === "UnauthorizedError");
}

/** Session token only. A missing or unknown token does not fall back to another account. */
export async function getUserId(request: NextRequest): Promise<string> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token) {
    const userId = await getUserIdFromToken(token);
    if (userId) return userId;
  }
  throw new UnauthorizedError();
}
