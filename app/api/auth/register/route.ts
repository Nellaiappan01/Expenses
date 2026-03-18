import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, name } = body;

    const userInput = (username || "").trim().toLowerCase();
    if (!userInput || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const userId = userInput.replace(/\s+/g, "_");
    const displayName = (name || userInput).trim();

    const db = await getDb();
    const existing = await db.collection("users").findOne({
      $or: [{ userId }, { username: userInput }],
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const isFirstUser = (await db.collection("users").countDocuments()) === 0;

    let isAdmin = isFirstUser;
    if (existing) {
      if (existing.passwordHash) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      }
      isAdmin = !!existing.isAdmin;
      await db.collection("users").updateOne(
        { userId },
        { $set: { passwordHash, username: userInput, name: displayName, updatedAt: new Date() } }
      );
    } else {
      await db.collection("users").insertOne({
      userId,
      username: userInput,
      name: displayName,
      passwordHash,
      isAdmin: isFirstUser,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    }

    const { createSession } = await import("@/lib/auth");
    const token = await createSession(userId);

    return NextResponse.json({
      token,
      userId,
      name: displayName,
      isAdmin,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
