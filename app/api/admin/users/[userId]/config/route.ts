import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

const DEFAULT_FEATURES = {
  expenses: true,
  workers: true,
  stock: false,
};

export async function GET(
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

    const config = await db.collection("config").findOne({ businessId: targetUserId });
    const features = {
      ...DEFAULT_FEATURES,
      ...config?.config?.features,
    };
    return NextResponse.json({ features });
  } catch (error) {
    console.error("Get user config error:", error);
    return NextResponse.json({ error: "Failed to get user config" }, { status: 500 });
  }
}

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

    const body = await request.json();
    const { features } = body;

    if (!features || typeof features !== "object") {
      return NextResponse.json({ error: "Features object required" }, { status: 400 });
    }

    const existing = await db.collection("config").findOne({ businessId: targetUserId });
    const current = existing?.config ?? { appMode: "expenses", features: {} };

    const newFeatures = {
      expenses: typeof features.expenses === "boolean" ? features.expenses : current.features?.expenses ?? true,
      workers: typeof features.workers === "boolean" ? features.workers : current.features?.workers ?? true,
      stock: typeof features.stock === "boolean" ? features.stock : current.features?.stock ?? false,
    };

    const newConfig = {
      ...current,
      features: newFeatures,
    };

    await db.collection("config").updateOne(
      { businessId: targetUserId },
      { $set: { config: newConfig, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ features: newFeatures });
  } catch (error) {
    console.error("Set user config error:", error);
    return NextResponse.json({ error: "Failed to set user config" }, { status: 500 });
  }
}
