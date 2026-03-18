import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

const DEFAULT_CONFIG = {
  appMode: "expenses" as const,
  features: {
    expenses: true,
    workers: true,
    stock: false,
    user_delete: false,
  },
};

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();
    const config = await db.collection("config").findOne({ businessId: userId });
    const merged = {
      ...DEFAULT_CONFIG,
      ...config?.config,
      features: { ...DEFAULT_CONFIG.features, ...config?.config?.features },
    };
    return NextResponse.json(merged);
  } catch (error) {
    console.error("Config GET error:", error);
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const db = await getDb();

    const user = await db.collection("users").findOne({ userId });
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { appMode, features } = body;

    const existing = await db.collection("config").findOne({ businessId: userId });
    const current = existing?.config ?? DEFAULT_CONFIG;

    const newConfig = {
      appMode: appMode && ["expenses", "workers", "stock", "user_base"].includes(appMode)
        ? appMode
        : current.appMode,
      features:
        features && typeof features === "object"
          ? { ...DEFAULT_CONFIG.features, ...current.features, ...features }
          : current.features,
    };

    await db.collection("config").updateOne(
      { businessId: userId },
      { $set: { config: newConfig, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json(newConfig);
  } catch (error) {
    console.error("Config PATCH error:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
