import { join } from "path";
import { mkdir, readFile, writeFile, unlink, access } from "fs/promises";
import { constants } from "fs";

const UPLOAD_ROOT = join(process.cwd(), "uploads", "stock");

export function stockPhotoPath(businessId: string, stockId: string): string {
  return join(UPLOAD_ROOT, businessId, `${stockId}.jpg`);
}

export async function stockPhotoExists(
  businessId: string,
  stockId: string
): Promise<boolean> {
  try {
    await access(stockPhotoPath(businessId, stockId), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function saveStockPhoto(
  businessId: string,
  stockId: string,
  data: Buffer
): Promise<void> {
  const dir = join(UPLOAD_ROOT, businessId);
  await mkdir(dir, { recursive: true });
  await writeFile(stockPhotoPath(businessId, stockId), data);
}

export async function readStockPhoto(
  businessId: string,
  stockId: string
): Promise<Buffer | null> {
  try {
    return await readFile(stockPhotoPath(businessId, stockId));
  } catch {
    return null;
  }
}

export async function deleteStockPhoto(
  businessId: string,
  stockId: string
): Promise<void> {
  try {
    await unlink(stockPhotoPath(businessId, stockId));
  } catch {
    // ignore missing file
  }
}
