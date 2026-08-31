"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";

export function entryAttachmentViewUrl(entry: Pick<Entry, "attachmentUrl" | "attachmentDriveUrl">): string {
  return entry.attachmentUrl?.trim() || entry.attachmentDriveUrl?.trim() || "";
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

export function AttachmentLightbox({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close photo" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Uploaded photo"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-[#0B4A8C]">Uploaded photo</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#5A7FA5] hover:bg-slate-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="bg-slate-50 p-3">
          {failed ? (
            <div className="px-2 py-8 text-center text-sm text-[#5A7FA5]">
              <p>This file cannot be previewed here.</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block font-semibold text-[#0B4A8C] underline"
              >
                Open in new tab
              </a>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Uploaded attachment"
              className="mx-auto max-h-[70vh] w-full rounded-lg object-contain"
              onError={() => setFailed(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AttachmentViewButton({
  entry,
  className = "",
}: {
  entry: Pick<Entry, "attachmentUrl" | "attachmentDriveUrl">;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const url = entryAttachmentViewUrl(entry);
  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#0B4A8C] ring-1 ring-[#C5D9EC] ${className}`}
        aria-label="View uploaded photo"
        title="View uploaded photo"
      >
        <EyeIcon className="h-3.5 w-3.5" />
      </button>
      {open ? <AttachmentLightbox url={url} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
