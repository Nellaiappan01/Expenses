import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

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
