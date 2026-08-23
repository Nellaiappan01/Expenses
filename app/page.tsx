"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EntryList from "./components/EntryList";
import SheetsSyncBanner from "./components/SheetsSyncBanner";
import ExpenseEntryForm from "./components/salt/ExpenseEntryForm";
import PaymentNotifications from "./components/payments/PaymentNotifications";
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
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <SaltWorksHeader />

      <StickyOpeningBalance refreshTrigger={refreshTrigger} />

      <div className="mx-auto w-full max-w-md space-y-4 px-3 sm:px-4">
        <SheetsSyncBanner
          refreshTrigger={refreshTrigger}
          onRefresh={() => setRefreshTrigger((n) => n + 1)}
        />

        <PaymentNotifications refreshTrigger={refreshTrigger} />

        <ExpenseEntryForm
          onSuccess={() => setRefreshTrigger((n) => n + 1)}
          refreshTrigger={refreshTrigger}
        />

        <section>
          <div className="mb-3 flex items-center justify-between px-0.5">
            <h2 className="ui-section-title">Recent entries</h2>
            <span className="text-xs font-medium text-[var(--text-faint)]">Today</span>
          </div>
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
