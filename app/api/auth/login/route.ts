import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const userInput = (username || "").trim().toLowerCase();
    if (!userInput || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({
      $or: [{ userId: userInput }, { username: userInput }, { email: userInput }],
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    let isAdmin = !!user.isAdmin;
    if (!isAdmin) {
      const count = await db.collection("users").countDocuments();
      if (count === 1) {
        await db.collection("users").updateOne(
          { userId: user.userId },
          { $set: { isAdmin: true, updatedAt: new Date() } }
        );
        isAdmin = true;
      }
    }

    const token = await createSession(user.userId);

    return NextResponse.json({
      token,
      userId: user.userId,
      name: user.name || user.userId,
      isAdmin,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
