import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const adminId = await getUserId(request);
    const db = await getDb();

    const admin = await db.collection("users").findOne({ userId: adminId });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (!targetUserId?.trim()) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : undefined;

    if (!name && !username) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const target = await db.collection("users").findOne({ userId: targetUserId });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (username && username !== target.username) {
      const taken = await db.collection("users").findOne({ username, userId: { $ne: targetUserId } });
      if (taken) {
        return NextResponse.json({ error: "Username already in use" }, { status: 409 });
      }
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (name) update.name = name;
    if (username) update.username = username;

    await db.collection("users").updateOne({ userId: targetUserId }, { $set: update });

    const updated = await db.collection("users").findOne({ userId: targetUserId });
    return NextResponse.json({
      userId: updated?.userId,
      name: updated?.name,
      username: updated?.username,
      isAdmin: updated?.isAdmin,
    });
  } catch (error) {
    console.error("Admin user PATCH error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const adminId = await getUserId(request);
    const db = await getDb();

    const admin = await db.collection("users").findOne({ userId: adminId });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (!targetUserId?.trim()) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    if (targetUserId === adminId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const target = await db.collection("users").findOne({ userId: targetUserId });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.collection("sessions").deleteMany({ userId: targetUserId });
    await db.collection("entries").deleteMany({ businessId: targetUserId });
    await db.collection("users").deleteOne({ userId: targetUserId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
