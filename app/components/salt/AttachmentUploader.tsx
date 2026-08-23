"use client";

import { useCallback, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { compressImageFile } from "@/lib/stockTypes";

type Props = {
  attachmentUrl: string | null;
  attachmentPublicId: string | null;
  onChange: (url: string | null, publicId: string | null) => void;
  onError?: (message: string) => void;
  compact?: boolean;
};

export default function AttachmentUploader({
  attachmentUrl,
  attachmentPublicId,
  onChange,
  onError,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadImageData = useCallback(
    async (imageData: string) => {
      setBusy(true);
      try {
        const res = await apiFetch("/api/entries/attachment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        onChange(data.url, data.publicId);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [onChange, onError]
  );

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        onError?.("Please choose an image file");
        return;
      }
      try {
        const dataUrl = await compressImageFile(file);
        await uploadImageData(dataUrl);
      } catch {
        onError?.("Could not process image");
      }
    },
    [onError, uploadImageData]
  );

  return (
    <div>
      {!compact && (
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#5A7FA5]">
          Attachment <span className="font-normal normal-case text-[#8AA8C4]">(optional)</span>
        </p>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label="Add attachment optional"
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onClick={() => !attachmentUrl && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void processFile(e.dataTransfer.files[0]);
        }}
        className={`relative rounded-xl border-2 border-dashed text-center transition-colors ${
          compact ? "px-3 py-3" : "px-4 py-5"
        } ${
          dragOver
            ? "border-[#0B4A8C] bg-[#EEF5FC]"
            : "border-[#B8CDE3] bg-[#F8FBFE] hover:border-[#7BA8D4]"
        }`}
      >
        {attachmentUrl ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachmentUrl}
              alt="Attachment preview"
              className="mx-auto max-h-40 rounded-lg object-contain"
            />
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                className="rounded-lg bg-[#EEF5FC] px-3 py-1.5 text-xs font-semibold text-[#0B4A8C]"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null, attachmentPublicId);
                }}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`mx-auto flex items-center justify-center rounded-full bg-[#EEF5FC] text-[#0B4A8C] ${compact ? "mb-1 h-8 w-8" : "mb-2 h-10 w-10"}`}
            >
              <svg
                className={compact ? "h-4 w-4" : "h-5 w-5"}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </div>
            <p className={`font-semibold text-[#0B4A8C] ${compact ? "text-xs" : "text-sm"}`}>
              {compact ? "Attachment (optional)" : "Add Attachment (optional)"}
            </p>
            {!compact && (
              <p className="text-xs text-[#7A9BB8]">Receipt, Bill, Screenshot etc.</p>
            )}
          </>
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0B4A8C] border-t-transparent" />
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
