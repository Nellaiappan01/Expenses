import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

/** Return current user profile (refreshes isAdmin from database). */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId || userId === "default") {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({
      $or: [{ userId }, { username: userId }, { email: userId }],
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      userId: user.userId as string,
      username: (user.username as string) || (user.userId as string),
      name: (user.name as string) || (user.userId as string),
      isAdmin: !!user.isAdmin,
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
