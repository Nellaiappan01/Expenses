"use client";

import { useState, useEffect } from "react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
  }

  if (!showPrompt || isInstalled || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-lg dark:border-emerald-800 dark:bg-emerald-950/50 nav-sheet">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            Install Ledger
          </p>
          <p className="mt-0.5 text-sm text-emerald-700 dark:text-emerald-300">
            Add to home screen for quick access
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => setShowPrompt(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
