"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

function fieldClass() {
  return "w-full rounded-xl border border-[#D6E6F5] bg-[#F8FBFE] px-3 py-3 text-base text-[#0B4A8C] outline-none transition-colors placeholder:text-[#9BB5CC] focus:border-[#0B4A8C] focus:bg-white";
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#0B4A8C]">
      {children}
      {optional ? (
        <span className="rounded-full bg-[#E8F2FA] px-2 py-0.5 text-[10px] font-medium text-[#5A7FA5]">
          Optional
        </span>
      ) : null}
    </label>
  );
}

function CopyButton({
  text,
  label,
  className = "",
}: {
  text: string;
  label: string;
  className?: string;
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

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D6E6F5] bg-white px-3 py-2 text-xs font-semibold text-[#0B4A8C] transition-colors hover:bg-[#F8FBFE] ${className}`}
    >
      <CopyIcon className="h-3.5 w-3.5" />
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

export default function LoginPage() {
  const router = useRouter();
  const { setUser, clearUser } = useUser();
  const bannerInputRef = useRef<HTMLInputElement>(null);

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
  const [sheetSetupOpen, setSheetSetupOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-[100dvh] bg-[#F4F8FC] px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B4A8C] text-white shadow-md">
            <LedgerIcon className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B4A8C]">{APP_NAME}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[#5A7FA5]">
            {mode === "login"
              ? "Sign in to manage expenses & wallet"
              : "Set up your business ledger with Google Sheets sync"}
          </p>
        </header>

        <div className="rounded-2xl border border-[#D6E6F5] bg-white p-1 shadow-sm">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F8FBFE] p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setShowPassword(false);
              }}
              className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
                mode === "login"
                  ? "bg-white text-[#0B4A8C] shadow-sm"
                  : "text-[#5A7FA5]"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
                setShowPassword(false);
              }}
              className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
                mode === "register"
                  ? "bg-white text-[#0B4A8C] shadow-sm"
                  : "text-[#5A7FA5]"
              }`}
            >
              Register
            </button>
          </div>

          <form
            onSubmit={mode === "login" ? handleLogin : handleRegister}
            className="space-y-4 p-4 pt-5"
          >
            <div>
              <FieldLabel>Email / Username</FieldLabel>
              <input
                type="text"
                inputMode="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@business.com"
                required
                autoComplete="username"
                className={fieldClass()}
              />
            </div>

            {mode === "register" && (
              <>
                <div>
                  <FieldLabel>Business name</FieldLabel>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Hariharan Salt Works"
                    required
                    className={fieldClass()}
                  />
                </div>

                <div>
                  <FieldLabel optional>Your name</FieldLabel>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Display name"
                    className={fieldClass()}
                  />
                </div>

                <div>
                  <FieldLabel optional>Banner image</FieldLabel>
                  {bannerPreview ? (
                    <div className="relative mb-2 overflow-hidden rounded-xl border border-[#D6E6F5]">
                      <img
                        src={bannerPreview}
                        alt="Banner preview"
                        className="h-24 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setBannerPreview(null);
                          setBannerImageData(null);
                          if (bannerInputRef.current) bannerInputRef.current.value = "";
                        }}
                        className="absolute right-2 top-2 rounded-lg bg-black/50 px-2 py-1 text-[10px] font-medium text-white"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onBannerChange}
                    className="sr-only"
                    id="banner-upload"
                  />
                  <label
                    htmlFor="banner-upload"
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#B8CDE3] bg-[#F8FBFE] px-3 py-3 text-sm font-medium text-[#0B4A8C] transition-colors hover:border-[#0B4A8C] hover:bg-white"
                  >
                    <ImageIcon className="h-4 w-4 text-[#5A7FA5]" />
                    {bannerPreview ? "Change banner" : "Upload banner photo"}
                  </label>
                  <p className="mt-1.5 text-[11px] text-[#9BB5CC]">Shown on your home page header.</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-[#D6E6F5]">
                  <button
                    type="button"
                    onClick={() => setSheetSetupOpen((v) => !v)}
                    className="flex w-full items-center justify-between gap-3 bg-[#F8FBFE] px-3 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0B4A8C]">Google Sheet setup</p>
                      <p className="text-[11px] text-[#5A7FA5]">Optional — sync entries to your sheet</p>
                    </div>
                    <ChevronIcon
                      className={`h-5 w-5 shrink-0 text-[#7A9BB8] transition-transform ${sheetSetupOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {sheetSetupOpen && (
                    <div className="space-y-3 border-t border-[#D6E6F5] p-3">
                      <p className="text-[11px] leading-relaxed text-[#5A7FA5]">
                        Row 1 headers (exact order):
                      </p>
                      <div className="-mx-1 overflow-x-auto px-1 pb-1">
                        <code className="block min-w-max whitespace-nowrap rounded-lg bg-[#F8FBFE] px-3 py-2 text-[11px] leading-relaxed text-[#0B4A8C]">
                          {SHEET_COLUMN_PATTERN}
                        </code>
                      </div>
                      <CopyButton text={SHEET_COLUMN_PATTERN} label="Copy headers" className="w-full" />

                      <div>
                        <FieldLabel optional>Google Sheet URL</FieldLabel>
                        <input
                          type="url"
                          value={googleSheetUrl}
                          onChange={(e) => setGoogleSheetUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/..."
                          className={fieldClass()}
                        />
                      </div>

                      <div>
                        <FieldLabel optional>Apps Script webhook</FieldLabel>
                        <input
                          type="url"
                          value={appsScriptWebhookUrl}
                          onChange={(e) => setAppsScriptWebhookUrl(e.target.value)}
                          placeholder="https://script.google.com/.../exec"
                          className={fieldClass()}
                        />
                      </div>

                      {appsScriptSource ? (
                        <CopyButton text={appsScriptSource} label="Copy Apps Script code" className="w-full" />
                      ) : null}

                      <p className="text-[11px] leading-relaxed text-[#9BB5CC]">
                        Extensions → Apps Script → paste code → Deploy as Web App → paste URL above.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <FieldLabel>Password</FieldLabel>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Min 6 characters" : "Your password"}
                  required
                  minLength={mode === "register" ? 6 : 1}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={`${fieldClass()} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#7A9BB8] transition-colors hover:bg-[#E8F2FA] hover:text-[#0B4A8C]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                loading ||
                !username.trim() ||
                !password ||
                (mode === "register" && !businessName.trim())
              }
              className="w-full rounded-xl bg-[#0B4A8C] py-3.5 text-base font-bold text-white transition-colors hover:bg-[#083A6E] disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        {mode === "login" ? (
          <p className="mt-4 text-center text-xs leading-relaxed text-[#9BB5CC]">
            Demo: <span className="font-medium text-[#5A7FA5]">hariharan@gmail.com</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LedgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V9l-4-4H9z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5v4h4M8 13h8M8 17h5" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  );
}
