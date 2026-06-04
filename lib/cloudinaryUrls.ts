export function cloudinaryTransform(url: string, transform: string): string {
  if (!url?.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  const after = url.slice(idx + marker.length);
  if (after.startsWith(transform.split(",")[0])) return url;
  return `${url.slice(0, idx + marker.length)}${transform}/${after}`;
}

export function stockThumbUrl(url: string): string {
  return cloudinaryTransform(url, "c_fill,w_160,h_160,f_auto,q_auto");
}

export function stockHeroUrl(url: string): string {
  return cloudinaryTransform(url, "c_limit,w_900,f_auto,q_auto");
}
