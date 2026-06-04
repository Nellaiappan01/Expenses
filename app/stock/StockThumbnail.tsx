"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { stockHeroUrl, stockThumbUrl } from "@/lib/cloudinaryUrls";

type Props = {
  stockId: string;
  hasPhoto?: boolean;
  photoThumbUrl?: string;
  photoUrl?: string;
  size?: "thumb" | "hero";
  cacheBust?: number;
  className?: string;
  onClick?: () => void;
};

export function StockThumbnail({
  stockId,
  hasPhoto,
  photoThumbUrl,
  photoUrl,
  size = "thumb",
  cacheBust,
  className = "",
  onClick,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (photoThumbUrl || photoUrl) {
      const cloudSrc =
        size === "hero"
          ? photoUrl
            ? stockHeroUrl(photoUrl)
            : photoThumbUrl
          : photoThumbUrl || (photoUrl ? stockThumbUrl(photoUrl) : undefined);
      setSrc(cloudSrc || null);
      setFailed(false);
      return;
    }

    if (!hasPhoto) {
      setSrc(null);
      setFailed(false);
      return;
    }

    let objectUrl: string | null = null;
    setFailed(false);
    const url = cacheBust
      ? `/api/stock/${stockId}/photo?t=${cacheBust}`
      : `/api/stock/${stockId}/photo`;
    apiFetch(url)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        } else {
          setSrc(null);
          setFailed(true);
        }
      })
      .catch(() => {
        setSrc(null);
        setFailed(true);
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stockId, hasPhoto, photoThumbUrl, photoUrl, size, cacheBust]);

  const wrap = (child: React.ReactNode) => {
    const base =
      "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/60 dark:bg-zinc-800 dark:ring-zinc-700/60 " +
      className;
    if (onClick) {
      return (
        <button type="button" onClick={onClick} className={base}>
          {child}
        </button>
      );
    }
    return <div className={base}>{child}</div>;
  };

  if (src) {
    return wrap(
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
        {size === "hero" && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        )}
      </>
    );
  }

  return wrap(
    <span className="text-zinc-400 dark:text-zinc-500">
      {failed || hasPhoto ? (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ) : (
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
        </svg>
      )}
    </span>
  );
}
