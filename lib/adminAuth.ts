import type { Db } from "mongodb";
import { getUserId } from "./user";

export async function requireAdmin(db: Db, request: Request) {
  const userId = await getUserId(request as import("next/server").NextRequest);
  const user = await db.collection("users").findOne({ userId });
  if (!user?.isAdmin) {
    return { ok: false as const, error: "Admin access required", status: 403 };
  }
  return { ok: true as const, adminId: userId, user };
}
