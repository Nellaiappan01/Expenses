"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useConfig } from "../context/ConfigContext";
import { SHEET_COLUMN_PATTERN } from "@/lib/userSettings";

function CopyButton({ text, label }: { text: string; label: string }) {
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

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      {copied ? "Copied!" : label}
    </button>
  );
}

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
      setMessage("Settings saved — header updated.");
      setBannerImageData(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto max-w-md px-4 py-6 pb-24 sm:px-5">
        <header className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Account &amp; Sheet</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Banner, Google Sheet &amp; Apps Script</p>
          </div>
        </header>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Branding</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Business name</label>
                <p className="mb-1.5 text-[10px] text-zinc-500">
                  Shown in the top header on every page (one name only).
                </p>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Banner image</label>
                {bannerPreview && (
                  <img
                    src={bannerPreview}
                    alt="Banner preview"
                    className="mb-2 h-24 w-full rounded-lg object-cover"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onBannerChange}
                  className="w-full text-sm text-zinc-600"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Google Sheet</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Each account uses its own sheet. Row 1 must match this column order:
            </p>
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <code className="flex-1 rounded-lg bg-zinc-100 px-2 py-1.5 text-[10px] leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {SHEET_COLUMN_PATTERN}
              </code>
              <CopyButton text={SHEET_COLUMN_PATTERN} label="Copy columns" />
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Google Sheet URL</label>
                <input
                  type="url"
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-zinc-600">Apps Script Web App URL</label>
                  {appsScriptSource && (
                    <CopyButton text={appsScriptSource} label="Copy script" />
                  )}
                </div>
                <input
                  type="url"
                  value={appsScriptWebhookUrl}
                  onChange={(e) => setAppsScriptWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
                <p className="mt-1 text-[10px] text-zinc-500">
                  Deploy the copied script in your sheet → paste the Web App URL here.
                </p>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
