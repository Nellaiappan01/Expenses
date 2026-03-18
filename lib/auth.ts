import { getDb } from "./mongodb";
import { randomBytes } from "crypto";

const TOKEN_BYTES = 32;

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const db = await getDb();
  await db.collection("sessions").insertOne({
    token,
    userId,
    createdAt: new Date(),
  });
  return token;
}

export async function getUserIdFromToken(token: string | null): Promise<string | null> {
  if (!token?.trim()) return null;
  const db = await getDb();
  const session = await db.collection("sessions").findOne({ token });
  return session?.userId ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.collection("sessions").deleteOne({ token });
}
