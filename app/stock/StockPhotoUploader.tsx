"use client";

import { useRef, useState, useCallback } from "react";
import { compressImageFile } from "@/lib/stockTypes";

type Props = {
  preview: string | null;
  onPreviewChange: (url: string | null) => void;
  existingThumbUrl?: string;
  existingHeroUrl?: string;
  label?: string;
  variant?: "card" | "hero";
};

export function StockPhotoUploader({
  preview,
  onPreviewChange,
  existingThumbUrl,
  existingHeroUrl,
  label = "Product photo",
  variant = "card",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const displaySrc = preview || (variant === "hero" ? existingHeroUrl : existingThumbUrl);

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file?.type.startsWith("image/")) return;
      setBusy(true);
      try {
        const dataUrl = await compressImageFile(file);
        onPreviewChange(dataUrl);
      } finally {
        setBusy(false);
      }
    },
    [onPreviewChange]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void processFile(e.dataTransfer.files[0]);
  };

  const isHero = variant === "hero";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {displaySrc && (
          <button
            type="button"
            onClick={() => onPreviewChange(null)}
            className="text-xs font-medium text-red-500 hover:text-red-600"
          >
            Clear
          </button>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`group relative overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
          isHero ? "aspect-[16/10] w-full" : "aspect-square w-full max-w-[140px]"
        } ${
          dragOver
            ? "border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/40"
            : "border-zinc-200/80 bg-gradient-to-br from-zinc-50 to-white hover:border-emerald-300 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-800"
        }`}
      >
        {displaySrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displaySrc}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/60 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-zinc-900">
                Tap to replace
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {isHero ? "Add tyre / product photo" : "Add photo"}
            </p>
            <p className="text-[11px] text-zinc-400">Camera, gallery, or drag & drop</p>
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-zinc-900/70">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void processFile(e.target.files?.[0])}
      />
    </div>
  );
}
