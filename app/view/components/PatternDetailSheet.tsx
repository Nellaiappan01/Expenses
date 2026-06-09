"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getPatternImageUrl } from "@/lib/patternImageUrl";
import { shareStockOnWhatsApp } from "@/lib/shareStockWhatsApp";
import type { StockViewStatus } from "@/lib/publicStock";

export type ViewStockItem = {
  _id: string;
  name: string;
  count: number;
  valuePerUnit?: number;
  brand: string;
  size: string;
  subtitle: string;
  status: StockViewStatus;
  hasPhoto?: boolean;
  photoUrl?: string;
  photoThumbUrl?: string;
};

function safeFilename(name: string): string {
  return name.replace(/[^\w\s-]/g, "").trim().slice(0, 48) || "tyre-pattern";
}

type Props = {
  item: ViewStockItem | null;
  shopName?: string;
  onClose: () => void;
};

export function PatternDetailSheet({ item, shopName, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!item) return;
    setImgFailed(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [item, onClose]);

  if (!mounted || !item) return null;

  const imageUrl = getPatternImageUrl(item);
  const hasImage = !!imageUrl && !imgFailed;

  async function handleDownload() {
    if (!imageUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${safeFilename(item!.name)}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  async function handleWhatsApp() {
    if (sharing) return;
    setSharing(true);
    try {
      await shareStockOnWhatsApp({
        shopName,
        name: item!.name,
        count: item!.count,
        brand: item!.brand,
        size: item!.size,
        photoUrl: item!.photoUrl || imageUrl || undefined,
      });
    } finally {
      setSharing(false);
    }
  }

  return createPortal(
    <>
      <button
        type="button"
        className="nav-sheet-backdrop fixed inset-0 z-[80] bg-black/55 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="nav-sheet fixed inset-x-0 bottom-0 z-[81] mx-auto max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Tyre pattern</p>
            <h2 className="mt-0.5 text-base font-bold leading-snug text-slate-900 sm:text-lg">
              {item.name}
            </h2>
            {(item.brand || item.size) && (
              <p className="mt-0.5 text-sm text-slate-500">
                {[item.brand, item.size].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-sm font-bold text-emerald-600">{item.count} PCS in godown</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl!}
                alt={item.name}
                className="h-full w-full object-cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                  <circle cx="12" cy="12" r="5" strokeWidth={1.5} />
                  <path strokeLinecap="round" strokeWidth={1.5} d="M12 3v18M3 12h18" />
                </svg>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!hasImage || downloading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg
                className={`h-5 w-5 ${downloading ? "animate-pulse" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {downloading ? "Saving…" : "Download"}
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={sharing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-[#25D366]/30 transition hover:bg-[#20bd5a] active:scale-[0.98] disabled:opacity-60"
            >
              <WhatsAppIcon className={`h-5 w-5 ${sharing ? "opacity-60" : ""}`} />
              {sharing ? "Opening…" : "WhatsApp"}
            </button>
          </div>

          {!hasImage && (
            <p className="mt-3 text-center text-xs text-slate-400">No photo available to download</p>
          )}
        </div>

        <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
      </div>
    </>,
    document.body
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
