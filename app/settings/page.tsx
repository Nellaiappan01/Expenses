"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useConfig } from "../context/ConfigContext";
import { SHEET_COLUMNS } from "@/lib/userSettings";
import { DefaultsAccordionCard } from "../components/defaults/DefaultsAccordionCard";

function fieldClass() {
  return "ui-input !min-h-[44px]";
}

function CopyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CopyButton({
  text,
  label,
  variant = "secondary",
}: {
  text: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const className =
    variant === "primary"
      ? "ui-btn-primary inline-flex !min-h-[40px] items-center justify-center gap-2 !py-2 !text-sm"
      : "inline-flex items-center justify-center gap-2 rounded-xl border border-[#D6E6F5] bg-white px-3 py-2 text-xs font-semibold text-[#0B4A8C] hover:bg-[#F8FBFE]";

  return (
    <button type="button" onClick={handleCopy} className={className}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : label}
    </button>
  );
}

const SETUP_STEPS = [
  "Create a Google Sheet. Row 1 must use the copied column headers.",
  "Copy script → Extensions → Apps Script → paste → Save.",
  "Deploy → New deployment → Web app (Execute as: Me, Access: Anyone). Do not reuse an old deployment.",
  "Paste the new Web App URL here, then Save settings.",
  "Drive receipts need that new deployment. Folder URL alone is not enough.",
];

export default function SettingsPage() {
  const ctx = useConfig();
  const config = ctx?.config ?? null;
  const refresh = ctx?.refresh ?? (() => {});
  const [appName, setAppName] = useState("");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [appsScriptWebhookUrl, setAppsScriptWebhookUrl] = useState("");
  const [googleDriveFolderUrl, setGoogleDriveFolderUrl] = useState("");
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerImageData, setBannerImageData] = useState<string | null>(null);
  const [appsScriptSource, setAppsScriptSource] = useState("");
  const [appsScriptVersion, setAppsScriptVersion] = useState<string | null>(null);
  const [driveScriptReady, setDriveScriptReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [openCard, setOpenCard] = useState<string | null>("branding");
  const [showColumns, setShowColumns] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  function toggleCard(id: string) {
    setOpenCard((current) => (current === id ? null : id));
  }

  useEffect(() => {
    if (config?.branding) {
      setAppName(config.branding.appName || "");
      setBannerPreview(config.branding.bannerUrl || null);
    }
    if (config?.integrations) {
      setGoogleSheetUrl(config.integrations.googleSheetUrl || "");
      setAppsScriptWebhookUrl(config.integrations.appsScriptWebhookUrl || "");
      setGoogleDriveFolderUrl(config.integrations.googleDriveFolderUrl || "");
    }
  }, [config]);

  const loadAppsScript = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/apps-script");
      const data = await res.json();
      if (data.source) setAppsScriptSource(data.source);
      if (data.version) setAppsScriptVersion(data.version);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadAppsScript();
  }, [loadAppsScript]);

  useEffect(() => {
    if (!appsScriptWebhookUrl.trim()) {
      setDriveScriptReady(null);
      return;
    }
    let cancelled = false;
    apiFetch("/api/integrations/apps-script/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setDriveScriptReady(Boolean(data.supportsDriveUpload));
      })
      .catch(() => {
        if (!cancelled) setDriveScriptReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appsScriptWebhookUrl]);

  function onBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setBannerImageData(result);
      setBannerPreview(result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: appName.trim(),
          googleSheetUrl: googleSheetUrl.trim(),
          appsScriptWebhookUrl: appsScriptWebhookUrl.trim(),
          googleDriveFolderUrl: googleDriveFolderUrl.trim(),
          ...(bannerImageData ? { bannerImageData } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      if (data.branding?.appName) setAppName(data.branding.appName);
      if (data.branding?.bannerUrl) setBannerPreview(data.branding.bannerUrl);
      setMessage("Settings saved.");
      setBannerImageData(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <div className="mx-auto max-w-md px-4 py-4">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0B4A8C] shadow-sm ring-1 ring-[var(--border-soft)]"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#0B4A8C]">Account &amp; Sheet</h1>
            <p className="text-xs text-[var(--text-muted)]">Tap a card to edit</p>
          </div>
        </header>

        <form onSubmit={handleSave} className="space-y-3">
          <DefaultsAccordionCard
            title="Branding"
            icon="brand"
            meta={appName.trim() || "Business name and banner"}
            open={openCard === "branding"}
            onToggle={() => toggleCard("branding")}
          >
            <div className="space-y-3">
              <div>
                <label className="ui-label">Business name</label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className={fieldClass()}
                  required
                />
              </div>
              <div>
                <label className="ui-label">Banner image</label>
                {bannerPreview ? (
                  <img
                    src={bannerPreview}
                    alt="Banner preview"
                    className="mb-2 h-28 w-full rounded-xl object-cover ring-1 ring-[var(--border-soft)]"
                  />
                ) : null}
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#D6E6F5] bg-[#F8FBFE] px-3 py-3.5 text-sm font-medium text-[#0B4A8C] hover:bg-white">
                  <input type="file" accept="image/*" onChange={onBannerChange} className="sr-only" />
                  <svg className="h-5 w-5 text-[#7A9BB8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                    />
                  </svg>
                  {bannerPreview ? "Change banner" : "Choose banner"}
                </label>
              </div>
            </div>
          </DefaultsAccordionCard>

          <DefaultsAccordionCard
            title="Google Sheet"
            icon="sheet"
            meta={googleSheetUrl.trim() ? "Linked" : "Paste sheet URL"}
            open={openCard === "sheet"}
            onToggle={() => toggleCard("sheet")}
          >
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              Each account uses its own sheet. Copy headers into row 1, then paste the sheet URL.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={SHEET_COLUMNS.join("\t")} label="Copy headers" />
              <button
                type="button"
                onClick={() => setShowColumns((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D6E6F5] bg-white px-3 py-2 text-xs font-semibold text-[#0B4A8C]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h10" />
                </svg>
                {showColumns ? "Hide columns" : `${SHEET_COLUMNS.length} columns`}
              </button>
            </div>
            {showColumns ? (
              <ol className="mt-3 space-y-1.5 text-xs text-[#0B4A8C]">
                {SHEET_COLUMNS.map((col, i) => (
                  <li key={col} className="flex gap-2">
                    <span className="w-5 shrink-0 tabular-nums text-[#9BB5CC]">{i + 1}.</span>
                    <span>{col}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="mt-4">
              <label className="ui-label">Sheet URL</label>
              <input
                type="url"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={fieldClass()}
              />
            </div>
          </DefaultsAccordionCard>

          <DefaultsAccordionCard
            title="Google Drive"
            icon="drive"
            meta={googleDriveFolderUrl.trim() ? "Receipt folder linked" : "Paste folder URL"}
            open={openCard === "drive"}
            onToggle={() => toggleCard("drive")}
          >
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              Attachments save in a date folder such as <strong className="text-[#0B4A8C]">01 Aug 2026</strong>.
              The folder URL is not enough — Apps Script must be a <strong>New deployment</strong> after you copy the latest script.
            </p>
            {googleDriveFolderUrl.trim() && driveScriptReady === false ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium leading-relaxed text-amber-950 ring-1 ring-amber-200/80">
                This Web App cannot save receipts yet. Open Apps Script below, tap Copy script, paste, then Deploy → New
                deployment and save the new URL.
              </p>
            ) : null}
            <div className="mt-4">
              <label className="ui-label">Drive folder URL</label>
              <input
                type="url"
                value={googleDriveFolderUrl}
                onChange={(e) => setGoogleDriveFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className={fieldClass()}
              />
            </div>
          </DefaultsAccordionCard>

          <DefaultsAccordionCard
            title="Apps Script"
            icon="script"
            meta={
              appsScriptWebhookUrl.trim()
                ? appsScriptVersion || "Web app linked"
                : "Copy script, then paste Web App URL"
            }
            open={openCard === "script"}
            onToggle={() => toggleCard("script")}
          >
            <div className="flex flex-wrap gap-2">
              {appsScriptSource ? <CopyButton text={appsScriptSource} label="Copy script" variant="primary" /> : null}
              <button
                type="button"
                onClick={() => setShowSetup((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D6E6F5] bg-white px-3 py-2 text-xs font-semibold text-[#0B4A8C]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M13 16h-1v-4h-1m1-4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
                  />
                </svg>
                {showSetup ? "Hide steps" : "How to set up"}
              </button>
            </div>

            {showSetup ? (
              <ol className="mt-3 space-y-2.5">
                {SETUP_STEPS.map((step, i) => (
                  <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-[var(--text-muted)]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EEF5FC] text-[10px] font-bold text-[#0B4A8C]">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            ) : null}

            {appsScriptVersion ? (
              <p className="mt-3 text-[11px] text-[#5A7FA5]">
                Script version <span className="font-semibold text-[#0B4A8C]">{appsScriptVersion}</span>
              </p>
            ) : null}

            <div className="mt-4">
              <label className="ui-label">Web App URL</label>
              <input
                type="url"
                value={appsScriptWebhookUrl}
                onChange={(e) => setAppsScriptWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className={fieldClass()}
              />
            </div>
          </DefaultsAccordionCard>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {message ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          ) : null}

          <button type="submit" disabled={loading} className="ui-btn-primary disabled:opacity-60">
            {loading ? "Saving…" : "Save settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
