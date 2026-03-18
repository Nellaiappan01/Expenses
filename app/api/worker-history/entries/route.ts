import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";
import type { Entry } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nameLower = searchParams.get("nameLower");

    if (!nameLower || !nameLower.trim()) {
      return NextResponse.json(
        { error: "nameLower query parameter is required" },
        { status: 400 }
      );
    }

    const userId = getUserId(request);
    const db = await getDb();
    const entries = await db
      .collection<Entry>("entries")
      .find({
        businessId: userId,
        nameLower: nameLower.trim().toLowerCase(),
      })
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    const serialized = entries.map((e) => ({
      ...e,
      _id: e._id?.toString(),
      createdAt: e.createdAt?.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error fetching entries by name:", error);
    return NextResponse.json(
      { error: "Failed to fetch entries" },
      { status: 500 }
    );
  }
}
