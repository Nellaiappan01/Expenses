"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AddEntryForm from "./components/AddEntryForm";
import EntryList from "./components/EntryList";
import NetAmountCard from "./components/NetAmountCard";
import { useConfig } from "./context/ConfigContext";

export default function Home() {
  const router = useRouter();
  const { config } = useConfig() ?? {};
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto max-w-md px-4 py-6 pb-12 sm:px-5">
        <div className="space-y-8">
          <NetAmountCard refreshTrigger={refreshTrigger} />
          <AddEntryForm
            onSuccess={() => setRefreshTrigger((n) => n + 1)}
            refreshTrigger={refreshTrigger}
          />
          <section>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Entries
            </h2>
            <EntryList
            refreshTrigger={refreshTrigger}
            limit={10}
            todayOnly
            onRefresh={() => setRefreshTrigger((n) => n + 1)}
          />
          </section>
        </div>
      </div>
    </div>
  );
}
