import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (userId === "default") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const db = await getDb();
    const users = await db
      .collection("users")
      .find({})
      .project({ _id: 0, userId: 1, name: 1 })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (userId === "default") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const db = await getDb();
    const user = await db.collection("users").findOne({ userId });
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { userId: targetId, name } = body;

    const id = (targetId || name || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!id) {
      return NextResponse.json(
        { error: "User ID or name is required" },
        { status: 400 }
      );
    }

    await db.collection("users").updateOne(
      { userId: id },
      { $set: { userId: id, name: (name || id).trim(), updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ userId: id, name: (name || id).trim() });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
