"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AddEntryForm from "./components/AddEntryForm";
import EntryList from "./components/EntryList";
import LedgerActionButtons from "./components/LedgerActionButtons";
import NetAmountCard from "./components/NetAmountCard";
import SheetsSyncBanner from "./components/SheetsSyncBanner";
import { useConfig } from "./context/ConfigContext";

export default function Home() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    const features = config?.features ?? { expenses: false, workers: false, stock: false };
    const hasLedger = features.expenses || features.workers;
    if (config && !hasLedger && features.stock) {
      router.replace("/stock");
    }
  }, [config, router]);

  const features = config?.features ?? { expenses: false, workers: false, stock: false };
  const hasLedger = features.expenses || features.workers;
  if (config && !hasLedger) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 bg-zinc-100/95 backdrop-blur-sm">
        <div className="mx-auto max-w-md space-y-2 px-3 py-2 sm:px-4">
          <NetAmountCard
            refreshTrigger={refreshTrigger}
            showActions={showActions}
            onToggleActions={() => setShowActions((v) => !v)}
          />
          {showActions ? <LedgerActionButtons /> : null}
        </div>
      </div>

      <div className="mx-auto max-w-md px-3 pb-12 pt-1 sm:px-4">
        <div className="space-y-3">
          <SheetsSyncBanner
            refreshTrigger={refreshTrigger}
            onRefresh={() => setRefreshTrigger((n) => n + 1)}
          />
          <AddEntryForm
            onSuccess={() => setRefreshTrigger((n) => n + 1)}
            refreshTrigger={refreshTrigger}
          />
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Today
            </h2>
            <EntryList
              refreshTrigger={refreshTrigger}
              limit={10}
              todayOnly
              readOnly
              onRefresh={() => setRefreshTrigger((n) => n + 1)}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
