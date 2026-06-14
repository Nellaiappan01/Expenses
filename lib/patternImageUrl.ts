import { stockHeroUrl } from "./cloudinaryUrls";

type ItemWithPhoto = {
  _id: string;
  hasPhoto?: boolean;
  photoUrl?: string;
  photoThumbUrl?: string;
};

export function getPatternImageUrl(
  item: ItemWithPhoto,
  publicUser?: string | null
): string | null {
  if (item.photoUrl) return stockHeroUrl(item.photoUrl);
  if (item.photoThumbUrl) return item.photoThumbUrl;
  if (item.hasPhoto) {
    const base = `/api/public/stock/${item._id}/photo`;
    if (publicUser?.trim()) {
      return `${base}?user=${encodeURIComponent(publicUser.trim().toLowerCase())}`;
    }
    return base;
  }
  return null;
}
