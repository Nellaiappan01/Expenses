import { v2 as cloudinary } from "cloudinary";

export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function getCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured. Add CLOUDINARY_* to .env.local");
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export { stockHeroUrl, stockThumbUrl } from "./cloudinaryUrls";

export async function uploadStockImage(
  userId: string,
  stockId: string,
  imageData: string | Buffer
): Promise<{ url: string; publicId: string }> {
  const cld = getCloudinary();
  const publicId = `stock/${userId}/${stockId}`;

  const result = await cld.uploader.upload(
    typeof imageData === "string" ? imageData : `data:image/jpeg;base64,${imageData.toString("base64")}`,
    {
      folder: `stock/${userId}`,
      public_id: stockId,
      overwrite: true,
      resource_type: "image",
      invalidate: true,
    }
  );

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function uploadExpenseAttachment(
  userId: string,
  imageData: string | Buffer,
  entryId?: string
): Promise<{ url: string; publicId: string }> {
  const cld = getCloudinary();
  const suffix = entryId ?? `${Date.now()}`;

  const result = await cld.uploader.upload(
    typeof imageData === "string" ? imageData : `data:image/jpeg;base64,${imageData.toString("base64")}`,
    {
      folder: `expenses/${userId}`,
      public_id: suffix,
      overwrite: true,
      resource_type: "image",
      timeout: 60_000,
      invalidate: true,
    }
  );

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function uploadFromRemoteUrl(
  userId: string,
  remoteUrl: string,
  entryId?: string
): Promise<{ url: string; publicId: string }> {
  const cld = getCloudinary();
  const suffix = entryId ?? `${Date.now()}`;
  const result = await cld.uploader.upload(remoteUrl, {
    folder: `expenses/${userId}`,
    public_id: suffix,
    overwrite: true,
    resource_type: "image",
    invalidate: true,
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function uploadUserBanner(
  userId: string,
  imageData: string | Buffer
): Promise<{ url: string; publicId: string }> {
  const cld = getCloudinary();
  const result = await cld.uploader.upload(
    typeof imageData === "string" ? imageData : `data:image/jpeg;base64,${imageData.toString("base64")}`,
    {
      folder: `branding/${userId}`,
      public_id: "header-banner",
      overwrite: true,
      resource_type: "image",
      invalidate: true,
    }
  );
  return { url: result.secure_url, publicId: result.public_id };
}

export async function uploadBrandAsset(
  filePath: string,
  publicId: string
): Promise<{ url: string; publicId: string }> {
  const cld = getCloudinary();
  const result = await cld.uploader.upload(filePath, {
    folder: "hariharan",
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
    invalidate: true,
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteStockImage(publicId: string | undefined): Promise<void> {
  if (!publicId || !isCloudinaryConfigured()) return;
  const cld = getCloudinary();
  try {
    await cld.uploader.destroy(publicId, { invalidate: true });
  } catch {
    // ignore if already removed
  }
}
