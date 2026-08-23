"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useConfig } from "../context/ConfigContext";
import { SHEET_COLUMNS } from "@/lib/userSettings";

function fieldClass() {
  return "ui-input !min-h-[44px]";
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
      ? "ui-btn-primary !min-h-[40px] !py-2 !text-sm"
      : "rounded-xl border border-[#D6E6F5] bg-white px-3 py-2 text-xs font-semibold text-[#0B4A8C] hover:bg-[#F8FBFE]";

  return (
    <button type="button" onClick={handleCopy} className={className}>
      {copied ? "Copied!" : label}
    </button>
  );
}

const SETUP_STEPS = [
  "Create a Google Sheet — row 1 must use the column headers below.",
  "Tap Copy script → Extensions → Apps Script → paste → Save.",
  "Deploy → New deployment → Web app (Execute as: Me, Access: Anyone).",
  "Copy the Web App URL and paste it below, then Save settings.",
];

export default function SettingsPage() {
  const ctx = useConfig();
  const config = ctx?.config ?? null;
  const refresh = ctx?.refresh ?? (() => {});
  const [appName, setAppName] = useState("");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [appsScriptWebhookUrl, setAppsScriptWebhookUrl] = useState("");
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerImageData, setBannerImageData] = useState<string | null>(null);
  const [appsScriptSource, setAppsScriptSource] = useState("");
  const [appsScriptVersion, setAppsScriptVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (config?.branding) {
      setAppName(config.branding.appName || "");
      setBannerPreview(config.branding.bannerUrl || null);
    }
    if (config?.integrations) {
      setGoogleSheetUrl(config.integrations.googleSheetUrl || "");
      setAppsScriptWebhookUrl(config.integrations.appsScriptWebhookUrl || "");
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
            <p className="text-xs text-[var(--text-muted)]">Branding and Google Sheets sync</p>
          </div>
        </header>

        <form onSubmit={handleSave} className="space-y-4">
          <section className="ui-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7A9BB8]">Branding</p>
            <div className="mt-3 space-y-3">
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
                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#D6E6F5] bg-[#F8FBFE] px-3 py-4 text-sm text-[#5A7FA5] hover:bg-white">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onBannerChange}
                    className="sr-only"
                  />
                  Choose banner image
                </label>
              </div>
            </div>
          </section>

          <section className="ui-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7A9BB8]">
              Google Sheet
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              Each account uses its own sheet. Row 1 must match these columns:
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {SHEET_COLUMNS.map((col, i) => (
                <span
                  key={col}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F8FBFE] px-2 py-1 text-[10px] font-medium text-[#0B4A8C] ring-1 ring-[#D6E6F5]"
                >
                  <span className="text-[#9BB5CC]">{i + 1}.</span>
                  {col}
                </span>
              ))}
            </div>

            <div className="mt-3">
              <CopyButton
                text={SHEET_COLUMNS.join("\t")}
                label="Copy column headers"
                variant="secondary"
              />
            </div>

            <div className="mt-4">
              <label className="ui-label">Google Sheet URL</label>
              <input
                type="url"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={fieldClass()}
              />
            </div>
          </section>

          <section className="ui-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7A9BB8]">
                  Apps Script
                </p>
                {appsScriptVersion ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    Latest script: <span className="font-semibold">{appsScriptVersion}</span>
                  </p>
                ) : null}
              </div>
              {appsScriptSource ? (
                <CopyButton text={appsScriptSource} label="Copy script" variant="primary" />
              ) : null}
            </div>

            <ol className="mt-3 space-y-2">
              {SETUP_STEPS.map((step, i) => (
                <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EEF5FC] text-[10px] font-bold text-[#0B4A8C]">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-900">
              After pasting, confirm the script header shows{" "}
              <strong>Version: {appsScriptVersion || "2026-08-24"}</strong>. Redeploy if you had
              an older version.
            </div>

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
          </section>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
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
