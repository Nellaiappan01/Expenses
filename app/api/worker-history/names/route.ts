import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserId } from "@/lib/user";

export interface NameWithTotal {
  name: string;
  nameLower: string;
  total: number;
  count: number;
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const db = await getDb();
    const result = await db
      .collection("entries")
      .aggregate<NameWithTotal>([
        { $match: { businessId: userId } },
        {
          $group: {
            _id: "$nameLower",
            name: { $first: "$name" },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            name: 1,
            nameLower: "$_id",
            total: 1,
            count: 1,
          },
        },
        { $sort: { nameLower: 1 } },
      ])
      .toArray();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching names:", error);
    return NextResponse.json([]);
  }
}
