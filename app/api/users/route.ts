import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
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
    const body = await request.json();
    const { userId, name } = body;

    const id = (userId || name || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!id) {
      return NextResponse.json(
        { error: "User ID or name is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
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
