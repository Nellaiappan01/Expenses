"use client";

import { useCallback, useRef, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api";
import { compressImageFile } from "@/lib/stockTypes";

type Props = {
  attachmentUrl: string | null;
  attachmentPublicId: string | null;
  onChange: (url: string | null, publicId: string | null, driveUrl?: string | null) => void;
  onError?: (message: string) => void;
  compact?: boolean;
  variant?: "default" | "icon";
  entryDate?: string;
};

type Phase = "idle" | "compress" | "upload";

export default function AttachmentUploader({
  attachmentUrl,
  attachmentPublicId,
  onChange,
  onError,
  compact = false,
  variant = "default",
  entryDate,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const openPicker = () => {
    if (busy) return;
    setPickerOpen(true);
  };

  const openCamera = () => {
    setPickerOpen(false);
    cameraInputRef.current?.click();
  };

  const openGallery = () => {
    setPickerOpen(false);
    galleryInputRef.current?.click();
  };

  const uploadImageData = useCallback(
    async (imageData: string) => {
      setPhase("upload");
      const res = await apiFetch("/api/entries/attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, date: entryDate }),
      });
      const data = await readApiJson<{
        error?: string;
        url?: string;
        publicId?: string;
        driveUrl?: string;
        driveError?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url || null, data.publicId || null, data.driveUrl || null);
      if (data.driveError) {
        onError?.(data.driveError);
      }
    },
    [entryDate, onChange, onError]
  );

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/") && file.type !== "") {
        onError?.("Please choose an image file");
        return;
      }
      setBusy(true);
      setPhase("compress");
      try {
        const dataUrl = await compressImageFile(file, { maxSide: 800, quality: 0.7 });
        await uploadImageData(dataUrl);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Could not process image");
      } finally {
        setBusy(false);
        setPhase("idle");
        if (cameraInputRef.current) cameraInputRef.current.value = "";
        if (galleryInputRef.current) galleryInputRef.current.value = "";
      }
    },
    [onError, uploadImageData]
  );

  const fileInputs = (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void processFile(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void processFile(e.target.files?.[0])}
      />
    </>
  );

  const pickerSheet = pickerOpen ? (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close photo options"
        onClick={() => setPickerOpen(false)}
      />
      <div
        role="dialog"
        aria-label="Add photo"
        className="relative z-10 w-full max-w-sm rounded-t-3xl bg-white p-4 shadow-xl sm:rounded-2xl"
      >
        <p className="mb-1 text-sm font-bold text-[#0B4A8C]">Add photo</p>
        <p className="mb-3 text-xs text-[#7A9BB8]">Take a picture or pick one from your gallery</p>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center gap-3 rounded-xl bg-[#0B4A8C] px-4 py-3.5 text-left text-sm font-semibold text-white"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Open camera
          </button>
          <button
            type="button"
            onClick={openGallery}
            className="flex items-center gap-3 rounded-xl bg-[#E8F2FA] px-4 py-3.5 text-left text-sm font-semibold text-[#0B4A8C]"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Choose from gallery
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const manageSheet =
    manageOpen && attachmentUrl ? (
      <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Close attachment"
          onClick={() => setManageOpen(false)}
        />
        <div role="dialog" aria-label="Attachment" className="relative z-10 w-full max-w-sm rounded-t-3xl bg-white p-4 shadow-xl sm:rounded-2xl">
          <p className="mb-3 text-sm font-bold text-[#0B4A8C]">Attachment</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachmentUrl} alt="Attachment preview" className="mx-auto max-h-48 rounded-lg object-contain" />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setManageOpen(false);
                openPicker();
              }}
              className="flex-1 rounded-xl bg-[#E8F2FA] py-3 text-sm font-semibold text-[#0B4A8C]"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(null, attachmentPublicId, null);
                setManageOpen(false);
              }}
              className="flex-1 rounded-xl bg-red-50 py-3 text-sm font-semibold text-red-600"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const busyOverlay = (compactArea: boolean) =>
    busy ? (
      <div
        className={
          compactArea
            ? "absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/90"
            : "absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/80"
        }
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0B4A8C] border-t-transparent" />
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#0B4A8C]">
          {phase === "compress" ? "Shrinking…" : "Uploading…"}
        </span>
      </div>
    ) : null;

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (attachmentUrl) {
              setManageOpen(true);
              return;
            }
            openPicker();
          }}
          aria-label={attachmentUrl ? "Attachment added — tap to manage" : "Add photo from camera or gallery"}
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition-colors ${
            attachmentUrl
              ? "border-[rgba(11,74,140,0.22)] bg-[#E8F2FA] text-[#0B4A8C]"
              : "border-transparent bg-[#f1f5f9] text-[#7A9BB8] hover:bg-[#E8F2FA] hover:text-[#0B4A8C]"
          }`}
        >
          {busy ? (
            <div className="flex flex-col items-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0B4A8C] border-t-transparent" />
            </div>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          )}
          {attachmentUrl && !busy ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden />
          ) : null}
        </button>
        {busy ? (
          <span className="sr-only">{phase === "compress" ? "Preparing photo" : "Uploading photo"}</span>
        ) : null}

        {fileInputs}
        {pickerSheet}
        {manageSheet}
      </>
    );
  }

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
        aria-label="Add photo from camera or gallery"
        onKeyDown={(e) => e.key === "Enter" && openPicker()}
        onClick={() => !attachmentUrl && openPicker()}
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
          dragOver ? "border-[#0B4A8C] bg-[#EEF5FC]" : "border-[#B8CDE3] bg-[#F8FBFE] hover:border-[#7BA8D4]"
        }`}
      >
        {attachmentUrl ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachmentUrl} alt="Attachment preview" className="mx-auto max-h-40 rounded-lg object-contain" />
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openPicker();
                }}
                className="rounded-lg bg-[#EEF5FC] px-3 py-1.5 text-xs font-semibold text-[#0B4A8C]"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null, attachmentPublicId, null);
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
              <svg className={compact ? "h-4 w-4" : "h-5 w-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </div>
            <p className={`font-semibold text-[#0B4A8C] ${compact ? "text-xs" : "text-sm"}`}>
              {compact ? "Camera or gallery" : "Take photo or choose from gallery"}
            </p>
            {!compact && <p className="text-xs text-[#7A9BB8]">Receipt, bill, or screenshot</p>}
          </>
        )}

        {busyOverlay(false)}
      </div>

      {fileInputs}
      {pickerSheet}
    </div>
  );
}
