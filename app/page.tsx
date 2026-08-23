"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EntryList from "./components/EntryList";
import SheetsSyncBanner from "./components/SheetsSyncBanner";
import ExpenseEntryForm from "./components/salt/ExpenseEntryForm";
import StickyOpeningBalance from "./components/salt/StickyOpeningBalance";
import SaltWorksHeader from "./components/salt/SaltWorksHeader";
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
    <div className="min-h-screen bg-[#F4F8FC] pb-24">
      <SaltWorksHeader />

      <StickyOpeningBalance refreshTrigger={refreshTrigger} />

      <div className="mx-auto w-full max-w-md space-y-4 px-3 sm:px-4">
        <SheetsSyncBanner
          refreshTrigger={refreshTrigger}
          onRefresh={() => setRefreshTrigger((n) => n + 1)}
        />

        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-[#5A7FA5]">
            Today Entry
          </h2>
          <ExpenseEntryForm
            onSuccess={() => setRefreshTrigger((n) => n + 1)}
            refreshTrigger={refreshTrigger}
          />
        </section>

        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-[#5A7FA5]">
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
  );
}
