import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function GET(request: NextRequest) {
  try {
    const adminId = await getUserId(request);
    const db = await getDb();

    const admin = await db.collection("users").findOne({ userId: adminId });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const users = await db
      .collection("users")
      .find({})
      .project({ _id: 0, userId: 1, name: 1, username: 1, isAdmin: 1 })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(users);
  } catch (error) {
    console.error("Admin users GET error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
