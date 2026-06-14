"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/context/UserContext";
import { publicStockViewPath, publicStockViewUrl, publicViewSlug } from "@/lib/publicStockPaths";

type Props = {
  variant?: "banner" | "compact";
};

export function PublicViewLink({ variant = "banner" }: Props) {
  const { userId, username } = useUser();
  const slug = publicViewSlug(username, userId);
  const [copied, setCopied] = useState(false);

  if (!slug) return null;

  const path = publicStockViewPath(slug);
  const fullUrl = publicStockViewUrl(slug);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your public stock link:", fullUrl);
    }
  }

  const iconBtn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition active:scale-[0.96]";

  if (variant === "compact") {
    return (
      <Link
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open public stock view"
        title="Open view"
        className={`${iconBtn} bg-violet-600 text-white shadow-sm ring-1 ring-violet-500/30 hover:bg-violet-700`}
      >
        <ViewIcon className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-violet-200/70 bg-violet-50/40 px-3 py-2.5 ring-1 ring-violet-100 dark:border-violet-900/40 dark:bg-violet-950/20 dark:ring-violet-900/30">
      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
        Public stock view
      </p>
      <div className="mt-1 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {path}
        </p>
        <Link
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open public stock view"
          title="Open view"
          className={`${iconBtn} bg-violet-600 text-white hover:bg-violet-700`}
        >
          <ExternalIcon className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={copyLink}
          aria-label={copied ? "Link copied" : "Copy link"}
          title={copied ? "Copied!" : "Copy link"}
          className={`${iconBtn} bg-white text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50 dark:bg-zinc-800 dark:text-violet-300 dark:ring-violet-800 ${
            copied ? "ring-2 ring-emerald-400 text-emerald-600" : ""
          }`}
        >
          {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function ViewIcon({ className }: { className?: string }) {
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

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}
