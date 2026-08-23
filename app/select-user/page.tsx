"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import { APP_NAME } from "@/lib/brandAssets";
import { SHEET_COLUMN_PATTERN } from "@/lib/userSettings";

type AuthJson = {
  error?: string;
  token?: string;
  userId?: string;
  username?: string;
  name?: string;
  isAdmin?: boolean;
};

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
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
    >
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      {copied ? "Copied" : label}
    </button>
  );
}

async function parseJsonResponse(res: Response): Promise<AuthJson> {
  const text = await res.text();
  try {
    return JSON.parse(text) as AuthJson;
  } catch {
    throw new Error(
      res.ok
        ? "Invalid server response"
        : "Server error. Restart the dev server (npm run dev) and try again."
    );
  }
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, clearUser } = useUser();

  useEffect(() => {
    clearUser();
  }, [clearUser]);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [appsScriptWebhookUrl, setAppsScriptWebhookUrl] = useState("");
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerImageData, setBannerImageData] = useState<string | null>(null);
  const [appsScriptSource, setAppsScriptSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    if (mode === "register") loadAppsScript();
  }, [mode, loadAppsScript]);

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "Login failed");
      if (!data.token || !data.userId) throw new Error("Invalid server response");
      setUser({
        token: data.token,
        userId: data.userId,
        userName: data.name ?? data.userId,
        username: data.username ?? username.trim().toLowerCase(),
        isAdmin: data.isAdmin,
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          name: name.trim() || businessName.trim() || username.trim(),
          businessName: businessName.trim(),
          googleSheetUrl: googleSheetUrl.trim(),
          appsScriptWebhookUrl: appsScriptWebhookUrl.trim(),
          ...(bannerImageData ? { bannerImageData } : {}),
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "Registration failed");
      if (!data.token || !data.userId) throw new Error("Invalid server response");
      setUser({
        token: data.token,
        userId: data.userId,
        userName: data.name ?? data.userId,
        username: data.username ?? username.trim().toLowerCase(),
        isAdmin: data.isAdmin,
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-8 dark:bg-zinc-950">
      <div className={`w-full space-y-6 ${mode === "register" ? "max-w-lg" : "max-w-sm"}`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{APP_NAME}</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {mode === "login"
              ? "Sign in to your account"
              : "Create your business account with your own Google Sheet"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                mode === "login"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                mode === "register"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              Register
            </button>
          </div>

          <form
            onSubmit={mode === "login" ? handleLogin : handleRegister}
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email / Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@business.com"
                required
                autoComplete="username"
                className={inputClass}
              />
            </div>

            {mode === "register" && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Business name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Your Business Name"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Your name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Display name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Banner image
                  </label>
                  {bannerPreview && (
                    <img
                      src={bannerPreview}
                      alt="Banner preview"
                      className="mb-2 h-20 w-full rounded-lg object-cover"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onBannerChange}
                    className="w-full text-xs text-zinc-600"
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">Saved to Cloudinary — shown on your home page.</p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Google Sheet setup</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                    Create a sheet with Row 1 headers in this exact order:
                  </p>
                  <div className="mt-2 flex flex-wrap items-start gap-2">
                    <code className="flex-1 rounded bg-white px-2 py-1 text-[9px] leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                      {SHEET_COLUMN_PATTERN}
                    </code>
                    <CopyButton text={SHEET_COLUMN_PATTERN} label="Copy" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <input
                      type="url"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      placeholder="Google Sheet URL"
                      className={inputClass}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={appsScriptWebhookUrl}
                        onChange={(e) => setAppsScriptWebhookUrl(e.target.value)}
                        placeholder="Apps Script Web App URL (…/exec)"
                        className={inputClass}
                      />
                      {appsScriptSource && (
                        <CopyButton text={appsScriptSource} label="Script" />
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Paste the script into Extensions → Apps Script, deploy as Web App, then paste the URL here.
                    </p>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Min 6 characters" : "Password"}
                required
                minLength={mode === "register" ? 6 : 1}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={
                loading ||
                !username.trim() ||
                !password ||
                (mode === "register" && !businessName.trim())
              }
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        {mode === "login" && (
          <p className="text-center text-xs text-zinc-500">
            Hariharan account: use <span className="font-medium">hariharan@gmail.com</span> with your existing password.
          </p>
        )}
      </div>
    </div>
  );
}
