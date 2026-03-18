import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export async function POST(request: NextRequest) {
  try {
    const adminId = await getUserId(request);
    const db = await getDb();

    const admin = await db.collection("users").findOne({ userId: adminId });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { username, newPassword } = body;

    const userInput = (username || "").trim().toLowerCase();
    if (!userInput || !newPassword) {
      return NextResponse.json(
        { error: "Username and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = await db.collection("users").findOne({
      $or: [{ userId: userInput }, { username: userInput }],
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.collection("users").updateOne(
      { userId: user.userId },
      { $set: { passwordHash, updatedAt: new Date() } }
    );

    await db.collection("sessions").deleteMany({ userId: user.userId });

    return NextResponse.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
