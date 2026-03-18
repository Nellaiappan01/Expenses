"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useUser } from "../context/UserContext";

type AdminUser = { userId: string; name?: string; username?: string; isAdmin?: boolean };

type UserFeatures = { expenses: boolean; workers: boolean; stock: boolean };

type Entry = {
  _id: string;
  type: string;
  name: string;
  amount: number;
  method: string;
  date: string;
  note?: string;
  typeLabel?: string;
};

export default function AdminPage() {
  const { userId, isAdmin } = useUser();
  const [config, setConfig] = useState<{
    appMode: string;
    features: { expenses: boolean; workers: boolean; stock: boolean; user_delete?: boolean };
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserForFeatures, setSelectedUserForFeatures] = useState("");
  const [userFeatures, setUserFeatures] = useState<UserFeatures>({ expenses: true, workers: true, stock: false });
  const [userFeaturesSaving, setUserFeaturesSaving] = useState(false);
  const [userFeaturesStatus, setUserFeaturesStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetStatus, setResetStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [viewUserDashboard, setViewUserDashboard] = useState("");
  const [dashboardFrom, setDashboardFrom] = useState("");
  const [dashboardTo, setDashboardTo] = useState("");
  const [dashboardData, setDashboardData] = useState<{
    received: number;
    paid: number;
    net: number;
    expense: number;
    workerPayment: number;
    rotationCash: number;
    adjustment: number;
  } | null>(null);
  const [dashboardEntries, setDashboardEntries] = useState<Entry[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    apiFetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (!selectedUserForFeatures.trim()) return;
    apiFetch(`/api/admin/users/${encodeURIComponent(selectedUserForFeatures)}/config`)
      .then((r) => (r.ok ? r.json() : { features: { expenses: true, workers: true, stock: false } }))
      .then((d) => setUserFeatures(d.features ?? { expenses: true, workers: true, stock: false }))
      .catch(() => setUserFeatures({ expenses: true, workers: true, stock: false }));
  }, [selectedUserForFeatures]);

  useEffect(() => {
    if (!viewUserDashboard.trim()) {
      setDashboardData(null);
      setDashboardEntries([]);
      return;
    }
    setDashboardLoading(true);
    const params = new URLSearchParams();
    if (dashboardFrom) params.set("from", dashboardFrom);
    if (dashboardTo) params.set("to", dashboardTo);
    params.set("limit", "30");
    Promise.all([
      apiFetch(`/api/admin/users/${encodeURIComponent(viewUserDashboard)}/dashboard?${params}`),
      apiFetch(`/api/admin/users/${encodeURIComponent(viewUserDashboard)}/entries?${params}`),
    ])
      .then(async ([resDashboard, resEntries]) => {
        const totals = resDashboard.ok ? await resDashboard.json() : null;
        const entries = resEntries.ok ? await resEntries.json() : [];
        setDashboardData(totals);
        setDashboardEntries(entries);
      })
      .catch(() => {
        setDashboardData(null);
        setDashboardEntries([]);
      })
      .finally(() => setDashboardLoading(false));
  }, [viewUserDashboard, dashboardFrom, dashboardTo]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!resetUsername.trim() || !resetPassword.trim()) return;
    setResetStatus(null);
    try {
      const res = await apiFetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: resetUsername.trim(), newPassword: resetPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetStatus({ ok: true, msg: "Password reset successfully." });
        setResetUsername("");
        setResetPassword("");
      } else {
        setResetStatus({ ok: false, msg: data.error || "Failed to reset password." });
      }
    } catch {
      setResetStatus({ ok: false, msg: "Failed to reset password." });
    }
  }

  async function handleSaveUserFeatures() {
    if (!selectedUserForFeatures.trim()) return;
    setUserFeaturesStatus(null);
    setUserFeaturesSaving(true);
    try {
      const res = await apiFetch(`/api/admin/users/${encodeURIComponent(selectedUserForFeatures)}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: userFeatures }),
      });
      const data = await res.json();
      if (res.ok) {
        setUserFeaturesStatus({ ok: true, msg: "Features saved." });
      } else {
        setUserFeaturesStatus({ ok: false, msg: data.error || "Failed to save." });
      }
    } catch {
      setUserFeaturesStatus({ ok: false, msg: "Failed to save." });
    } finally {
      setUserFeaturesSaving(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserId.trim()) return;
    setDeleteStatus(null);
    if (!confirm(`Delete user "${users.find((u) => u.userId === deleteUserId)?.name || deleteUserId}"? This will remove their account and all entries.`)) return;
    try {
      const res = await apiFetch(`/api/admin/users/${encodeURIComponent(deleteUserId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setDeleteStatus({ ok: true, msg: "User deleted." });
        setDeleteUserId("");
        setUsers((prev) => prev.filter((u) => u.userId !== deleteUserId));
      } else {
        setDeleteStatus({ ok: false, msg: data.error || "Failed to delete user." });
      }
    } catch {
      setDeleteStatus({ ok: false, msg: "Failed to delete user." });
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Access Denied
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Admin access required.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-emerald-600 dark:text-emerald-400"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto max-w-md px-4 py-6 pb-24 sm:px-5">
        <header className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Admin
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Configure app features
            </p>
          </div>
        </header>

        {!config ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Set User Features
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Choose which features each user can access. Example: one user expenses only, another expenses+workers, another workers only.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    User
                  </label>
                  <select
                    value={selectedUserForFeatures}
                    onChange={(e) => setSelectedUserForFeatures(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Select user…</option>
                    {users.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.name || u.username || u.userId}
                        {u.isAdmin ? " (admin)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedUserForFeatures && (
                  <>
                    <div className="space-y-2">
                      {[
                        { key: "expenses" as const, label: "Expenses" },
                        { key: "workers" as const, label: "Workers" },
                        { key: "stock" as const, label: "Stock" },
                      ].map(({ key, label }) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700"
                        >
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {label}
                          </span>
                          <input
                            type="checkbox"
                            checked={userFeatures[key]}
                            onChange={(e) =>
                              setUserFeatures({ ...userFeatures, [key]: e.target.checked })
                            }
                            className="h-4 w-4 rounded"
                          />
                        </label>
                      ))}
                    </div>
                    {userFeaturesStatus && (
                      <p
                        className={`text-sm ${userFeaturesStatus.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {userFeaturesStatus.msg}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveUserFeatures}
                      disabled={userFeaturesSaving}
                      className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {userFeaturesSaving ? "Saving…" : "Save Features"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                View User Dashboard
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                View another user&apos;s expenses, totals, and recent entries.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    User
                  </label>
                  <select
                    value={viewUserDashboard}
                    onChange={(e) => setViewUserDashboard(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Select user…</option>
                    {users.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.name || u.username || u.userId}
                        {u.isAdmin ? " (admin)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {viewUserDashboard && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">From</label>
                        <input
                          type="date"
                          value={dashboardFrom}
                          onChange={(e) => setDashboardFrom(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs text-zinc-500 dark:text-zinc-400">To</label>
                        <input
                          type="date"
                          value={dashboardTo}
                          onChange={(e) => setDashboardTo(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                    {dashboardLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                      </div>
                    ) : dashboardData ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/30">
                            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Received</p>
                            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                              ₹{dashboardData.received.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950/30">
                            <p className="text-[10px] font-medium text-red-700 dark:text-red-400">Paid</p>
                            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                              ₹{dashboardData.paid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
                            <p className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Net</p>
                            <p className={`text-sm font-semibold ${dashboardData.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              ₹{dashboardData.net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Recent entries ({dashboardEntries.length})</p>
                          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
                            {dashboardEntries.length === 0 ? (
                              <p className="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">No entries</p>
                            ) : (
                              dashboardEntries.map((e) => (
                                <div key={e._id} className="flex justify-between text-xs">
                                  <span className="truncate text-zinc-700 dark:text-zinc-300">
                                    {e.date} · {e.name}
                                    <span className="ml-1 text-zinc-500">
                                      ({e.type === "expense" ? "Exp" : e.type === "worker_payment" ? "Worker" : e.type === "rotation_cash" ? "Wallet" : "Adj"})
                                    </span>
                                  </span>
                                  <span className={`shrink-0 font-medium ${e.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                    {e.amount >= 0 ? "+" : ""}₹{e.amount.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Admin Features
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Enable or disable admin-only features.
              </p>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    User delete
                  </span>
                  <input
                    type="checkbox"
                    checked={config.features.user_delete ?? false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        features: { ...config.features, user_delete: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Delete User
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Remove a user and all their entries. Cannot delete yourself.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    User
                  </label>
                  <select
                    value={deleteUserId}
                    onChange={(e) => setDeleteUserId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Select user…</option>
                    {users.filter((u) => u.userId !== userId).map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.name || u.username || u.userId}
                        {u.isAdmin ? " (admin)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {deleteStatus && (
                  <p
                    className={`text-sm ${deleteStatus.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {deleteStatus.msg}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={!deleteUserId.trim()}
                  className="w-full rounded-lg border border-red-300 bg-red-50 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  Delete User
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Reset User Password
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                When a user forgets their password, select them and set a new one.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    User
                  </label>
                  <select
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Select user…</option>
                    {users.map((u) => (
                      <option key={u.userId} value={u.username ?? u.userId}>
                        {u.name || u.username || u.userId}
                        {u.isAdmin ? " (admin)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    New password
                  </label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                {resetStatus && (
                  <p
                    className={`text-sm ${resetStatus.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {resetStatus.msg}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={!resetUsername.trim() || !resetPassword.trim() || resetPassword.length < 6}
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-100 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Reset Password
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
