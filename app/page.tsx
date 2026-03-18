"use client";

import { useState } from "react";
import AddEntryForm from "./components/AddEntryForm";
import EntryList from "./components/EntryList";
import NetAmountCard from "./components/NetAmountCard";

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
            <EntryList refreshTrigger={refreshTrigger} limit={10} />
          </section>
        </div>
      </div>
    </div>
  );
}
