import { stockHeroUrl } from "./cloudinaryUrls";

type ItemWithPhoto = {
  _id: string;
  hasPhoto?: boolean;
  photoUrl?: string;
  photoThumbUrl?: string;
};

export function getPatternImageUrl(item: ItemWithPhoto): string | null {
  if (item.photoUrl) return stockHeroUrl(item.photoUrl);
  if (item.photoThumbUrl) return item.photoThumbUrl;
  if (item.hasPhoto) return `/api/public/stock/${item._id}/photo`;
  return null;
}
