/**
 * Upload: node scripts/upload-brand-banner.mjs
 */
import { v2 as cloudinary } from "cloudinary";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore
  }
}

loadEnv();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const bannerPath = resolve(__dirname, "../public/hariharan/banner.jpg");
const buffer = readFileSync(bannerPath);
const dataUri = `data:image/jpeg;base64,${buffer.toString("base64")}`;

const result = await cloudinary.uploader.upload(dataUri, {
  folder: "hariharan",
  public_id: "header-banner",
  overwrite: true,
  resource_type: "image",
  invalidate: true,
});

console.log("URL:", result.secure_url);
console.log("PUBLIC_ID:", result.public_id);
