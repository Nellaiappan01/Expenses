import { cloudinaryTransform } from "./cloudinaryUrls";

/** Site Ledger — default app branding (per-user overrides in config). */
export const APP_NAME = "Site Ledger";
export const APP_SHORT_NAME = "Site Ledger";

export const SALT_HEADER_BANNER_URL =
  process.env.NEXT_PUBLIC_SALT_BANNER_URL ??
  "https://res.cloudinary.com/dmr7ytrly/image/upload/v1787474857/hariharan/header-banner.jpg";

/** Max content width — banner matches entry form column. */
export const SALT_CONTENT_MAX_PX = 448;

/** Display heights (px) per breakpoint for the header banner. */
export const SALT_BANNER_HEIGHT = { mobile: 144, tablet: 160, desktop: 176 } as const;

/**
 * Cloudinary banner URL cropped to exact display size.
 * Uses dpr_auto so retina devices get sharper images without oversizing layout.
 */
export function headerBannerUrl(bannerUrl: string, width: number, height: number): string {
  if (!bannerUrl.includes("res.cloudinary.com")) {
    return bannerUrl;
  }
  return cloudinaryTransform(
    bannerUrl,
    `c_fill,w_${width},h_${height},g_center,f_auto,q_auto,dpr_auto`
  );
}

export function saltHeaderBannerUrl(width: number, height: number): string {
  return headerBannerUrl(SALT_HEADER_BANNER_URL, width, height);
}

/** Responsive srcset for the header banner (1x and 2x container widths). */
export function headerBannerSrcSet(bannerUrl: string, height: number): string {
  const widths = [SALT_CONTENT_MAX_PX, SALT_CONTENT_MAX_PX * 2];
  return widths.map((w) => `${headerBannerUrl(bannerUrl, w, height)} ${w}w`).join(", ");
}

export function saltHeaderBannerSrcSet(height: number): string {
  return headerBannerSrcSet(SALT_HEADER_BANNER_URL, height);
}

/** Pick Cloudinary width/height from viewport (client-side). */
export function headerBannerForViewport(
  bannerUrl: string,
  viewportWidth: number
): { src: string; height: number } {
  const displayWidth = Math.min(viewportWidth, SALT_CONTENT_MAX_PX);
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const cloudWidth = Math.round(displayWidth * dpr);

  let displayHeight: number = SALT_BANNER_HEIGHT.mobile;
  if (viewportWidth >= 640) displayHeight = SALT_BANNER_HEIGHT.tablet;
  if (viewportWidth >= 1024) displayHeight = SALT_BANNER_HEIGHT.desktop;

  const cloudHeight = Math.round(displayHeight * dpr);

  return {
    src: headerBannerUrl(bannerUrl, cloudWidth, cloudHeight),
    height: displayHeight,
  };
}

export function saltHeaderBannerForViewport(viewportWidth: number): {
  src: string;
  height: number;
} {
  return headerBannerForViewport(SALT_HEADER_BANNER_URL, viewportWidth);
}
