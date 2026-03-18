"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const USER_KEY = "ledger_user_id";

export default function SelectUserPage() {
  const router = useRouter();
  const [users, setUsers] = useState<{ userId: string; name: string }[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  function selectUser(userId: string, name: string) {
    localStorage.setItem(USER_KEY, JSON.stringify({ userId, userName: name || userId }));
    router.push("/");
    router.refresh();
  }

  async function createUser() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        selectUser(data.userId, data.name);
      } else {
        const userId = name.toLowerCase().replace(/\s+/g, "_");
        selectUser(userId, name);
      }
    } catch (err) {
      const userId = name.toLowerCase().replace(/\s+/g, "_");
      selectUser(userId, name);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Cash Flow Ledger
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Same app, your own data. Each user tracks their own expenses.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Select User
          </h2>
          {loading ? (
            <div className="py-4 text-center text-sm text-zinc-500">Loading…</div>
          ) : users.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">
              No users yet. Create one below.
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => selectUser(u.userId, u.name)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                >
                  {u.name || u.userId}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Create New User
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createUser()}
              placeholder="Enter name"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            <button
              type="button"
              onClick={createUser}
              disabled={creating || !newName.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {creating ? "…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
