"use client";

import { useState } from "react";
import Link from "next/link";
import AddEntryForm from "./components/AddEntryForm";
import DashboardSummary from "./components/DashboardSummary";
import EntryList from "./components/EntryList";

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto max-w-md px-4 py-6 pb-12 sm:px-5">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
              Cash Flow Ledger
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Track expenses and payments
            </p>
          </div>
          <Link
            href="/select-user"
            className="shrink-0 rounded-lg bg-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
          >
            Switch User
          </Link>
        </header>

        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Summary
            </h2>
            <DashboardSummary refreshTrigger={refreshTrigger} />
          </section>
          <AddEntryForm
            onSuccess={() => setRefreshTrigger((n) => n + 1)}
            refreshTrigger={refreshTrigger}
          />
          <section>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Entries
            </h2>
            <EntryList refreshTrigger={refreshTrigger} limit={10} />
          </section>
        </div>
      </div>
    </div>
  );
}
