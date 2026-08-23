"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import {
  buildUpiPayUrl,
  formatBankDetailsText,
  paymentMethodFromPerson,
} from "@/lib/expensePeople";
import { requestLabel } from "@/lib/paymentWorkflow";
import type { Entry, ExpensePerson, PaymentVerifiedMethod } from "@/lib/types";

type PaymentFilter = "payment_pending" | "paid" | "approval_pending" | "all";

type PaymentEntry = Entry & { businessName?: string; payee?: ExpensePerson };

const PAYMENT_METHODS: PaymentVerifiedMethod[] = ["Cash", "GPay / UPI", "Bank Transfer"];

export default function PaymentManagement({ dashboard = false }: { dashboard?: boolean }) {
  const [filter, setFilter] = useState<PaymentFilter>("payment_pending");
  const [businessId, setBusinessId] = useState("");
  const [users, setUsers] = useState<{ userId: string; name: string }[]>([]);
  const [entries, setEntries] = useState<PaymentEntry[]>([]);
  const [counts, setCounts] = useState({
    approvalPending: 0,
    paymentPending: 0,
    paid: 0,
  });
  const [loading, setLoading] = useState(false);
  const [verifyEntry, setVerifyEntry] = useState<PaymentEntry | null>(null);
  const [editEntry, setEditEntry] = useState<PaymentEntry | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editApprovedBy, setEditApprovedBy] = useState("");
  const [editPaymentDueDate, setEditPaymentDueDate] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editReason, setEditReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentVerifiedMethod>("Bank Transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentPaidTo, setPaymentPaidTo] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ filter });
      if (businessId) params.set("businessId", businessId);
      const res = await apiFetch(`/api/admin/payments?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setEntries(data.entries ?? []);
      setUsers(data.users ?? []);
      if (data.counts) setCounts(data.counts);
    } catch {
      setError("Could not load payment list");
    } finally {
      setLoading(false);
    }
  }, [filter, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 3000);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => {
    if (!copyMsg) return;
    const t = setTimeout(() => setCopyMsg(""), 2000);
    return () => clearTimeout(t);
  }, [copyMsg]);

  function openVerify(entry: PaymentEntry) {
    const payee = entry.payee;
    const method = paymentMethodFromPerson(payee);
    setVerifyEntry(entry);
    setPaymentMethod(method);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentReference("");
    setPaymentPaidTo(method === "Cash" ? entry.name : "");
    setPaymentNote("");
    setError("");
    setCopyMsg("");
  }

  function openEdit(entry: PaymentEntry) {
    setEditEntry(entry);
    setEditName(entry.name);
    setEditCategory(entry.category || "");
    setEditAmount(String(Math.abs(entry.amount)));
    setEditNote(entry.note || "");
    setEditApprovedBy(entry.approvedBy || "");
    setEditPaymentDueDate(entry.paymentDueDate || "");
    setEditDate(entry.date);
    setEditReason("");
    setError("");
    setVerifyEntry(null);
  }

  async function handleEditSave() {
    if (!editEntry || saving) return;
    if (!editReason.trim()) {
      setError("Reason is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/entries/${editEntry._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: editReason.trim(),
          name: editName.trim(),
          category: editCategory.trim(),
          amount: Number(editAmount),
          note: editNote,
          approvedBy: editApprovedBy,
          paymentDueDate: editPaymentDueDate || undefined,
          date: editDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setSuccess("Entry updated");
      setEditEntry(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: PaymentEntry) {
    const label = requestLabel(entry);
    const reason = window.prompt(
      `Delete "${label}"?\n\nEnter reason (required):`,
      "Admin correction"
    );
    if (!reason?.trim()) return;

    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/entries/${entry._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setSuccess("Entry deleted");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`${label} copied`);
    } catch {
      setCopyMsg("Could not copy");
    }
  }

  async function handleVerify() {
    if (!verifyEntry || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/entries/${verifyEntry._id}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          paymentDate,
          paymentReference:
            paymentMethod === "Bank Transfer" || paymentMethod === "GPay / UPI"
              ? paymentReference
              : undefined,
          paymentPaidTo: paymentMethod === "Cash" ? paymentPaidTo : undefined,
          paymentNote: paymentNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setSuccess("Payment marked as paid & verified");
      setVerifyEntry(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSaving(false);
    }
  }

  const filters: { id: PaymentFilter; label: string }[] = [
    { id: "payment_pending", label: "Payment Pending" },
    { id: "approval_pending", label: "User — missing approver" },
    { id: "paid", label: "Paid" },
    { id: "all", label: "All" },
  ];

  const shellClass = dashboard
    ? "space-y-4"
    : "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

  const verifyAmount = verifyEntry ? Math.abs(verifyEntry.amount) : 0;
  const payee = verifyEntry?.payee;
  const upiUrl =
    payee?.upiId && verifyEntry
      ? buildUpiPayUrl({ upiId: payee.upiId, name: payee.name, amount: verifyAmount })
      : null;
  const bankDetails = payee ? formatBankDetailsText(payee) : "";

  return (
    <div className={shellClass}>
      {!dashboard && (
        <>
          <h2 className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Payment Management
          </h2>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Users set <strong>Approved by</strong> on their side. Admin only transfers &amp; verifies
            payment here.
          </p>
        </>
      )}

      {dashboard && (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setFilter("approval_pending")}
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left"
          >
            <p className="text-[10px] font-semibold uppercase text-amber-800">User pending</p>
            <p className="text-xl font-bold text-amber-900">{counts.approvalPending}</p>
          </button>
          <button
            type="button"
            onClick={() => setFilter("payment_pending")}
            className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-left"
          >
            <p className="text-[10px] font-semibold uppercase text-yellow-800">To pay</p>
            <p className="text-xl font-bold text-yellow-900">{counts.paymentPending}</p>
          </button>
          <button
            type="button"
            onClick={() => setFilter("paid")}
            className="rounded-xl border border-green-200 bg-green-50 p-3 text-left"
          >
            <p className="text-[10px] font-semibold uppercase text-green-800">Paid</p>
            <p className="text-xl font-bold text-green-900">{counts.paid}</p>
          </button>
        </div>
      )}

      <div className={`${dashboard ? "rounded-2xl border border-[#D6E6F5] bg-white p-4 shadow-sm" : ""}`}>
      <div className="mb-3 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              filter === f.id
                ? "bg-[#0B4A8C] text-white"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Account (optional)
        </label>
        <select
          value={businessId}
          onChange={(e) => setBusinessId(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">All accounts</option>
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {error && !verifyEntry && (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-2 text-sm text-green-700" role="status">
          {success}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0B4A8C] border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No entries in this filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
              <tr>
                <th className="px-2 py-2">Request</th>
                <th className="px-2 py-2">Requested by</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2">Approved by</th>
                <th className="px-2 py-2">Pay on</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {entries.map((e) => (
                <tr key={e._id} className="text-zinc-700 dark:text-zinc-300">
                  <td className="max-w-[120px] truncate px-2 py-2 font-medium">
                    {requestLabel(e)}
                    {e.businessName && (
                      <span className="mt-0.5 block text-[10px] font-normal text-zinc-400">
                        {e.businessName}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span>{e.name}</span>
                    {e.payee?.preferredMethod === "gpay" && e.payee.upiId && (
                      <span className="mt-0.5 block text-[10px] text-[#1A5FD4]">GPay</span>
                    )}
                    {e.payee?.preferredMethod === "bank" && (
                      <span className="mt-0.5 block text-[10px] text-[#0B4A8C]">Bank</span>
                    )}
                    {e.payee?.preferredMethod === "cash" && (
                      <span className="mt-0.5 block text-[10px] text-amber-700">Cash</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold">
                    ₹{Math.abs(e.amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-2 py-2">{e.approvedBy || "—"}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {e.paymentDueDate ? formatDateDDMMYYYY(e.paymentDueDate) : "—"}
                  </td>
                  <td className="px-2 py-2">
                    {e.approvalStatus === "pending" ? (
                      <span className="text-amber-700">⏳ User pending</span>
                    ) : e.paymentStatus === "paid" ? (
                      <span className="text-green-700">🟢 Paid</span>
                    ) : (
                      <span className="text-yellow-700">🟡 Payment pending</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        className="rounded border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(e)}
                        disabled={saving}
                        className="rounded border border-red-200 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                      {e.approvalStatus === "pending" ? (
                        <span className="text-[10px] text-zinc-500">User adds approver</span>
                      ) : e.paymentStatus === "pending" ? (
                        <button
                          type="button"
                          onClick={() => openVerify(e)}
                          className="rounded-lg bg-[#0B4A8C] px-2 py-1 text-[10px] font-semibold text-white"
                        >
                          Pay
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editEntry && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/50"
            onClick={() => setEditEntry(null)}
            aria-label="Close"
          />
          <div className="fixed inset-x-4 top-8 z-[71] mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-bold text-zinc-900">Edit expense</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Account: {editEntry.businessName || editEntry.businessId}
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Requested by</label>
                <input
                  value={editName}
                  onChange={(ev) => setEditName(ev.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Category</label>
                <input
                  value={editCategory}
                  onChange={(ev) => setEditCategory(ev.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Amount</label>
                <input
                  value={editAmount}
                  onChange={(ev) => setEditAmount(ev.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Note / request</label>
                <input
                  value={editNote}
                  onChange={(ev) => setEditNote(ev.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Approved by</label>
                <input
                  value={editApprovedBy}
                  onChange={(ev) => setEditApprovedBy(ev.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Expense date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(ev) => setEditDate(ev.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Pay on</label>
                  <input
                    type="date"
                    value={editPaymentDueDate}
                    onChange={(ev) => setEditPaymentDueDate(ev.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Reason *</label>
                <input
                  value={editReason}
                  onChange={(ev) => setEditReason(ev.target.value)}
                  placeholder="Why is this being changed?"
                  className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm"
                />
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              disabled={saving}
              onClick={handleEditSave}
              className="mt-4 w-full rounded-xl bg-[#0B4A8C] py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </>
      )}

      {verifyEntry && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/50"
            onClick={() => setVerifyEntry(null)}
            aria-label="Close"
          />
          <div className="fixed inset-x-4 top-8 z-[71] mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-bold text-zinc-900">Transfer &amp; Verify</h3>
            <div className="mt-2 space-y-1 rounded-lg bg-[#F4F8FC] p-3 text-sm text-[#0B4A8C]">
              <p className="font-semibold">{requestLabel(verifyEntry)}</p>
              <p>Requested by: {verifyEntry.name}</p>
              <p>Amount: ₹{verifyAmount.toLocaleString("en-IN")}</p>
              <p>Approved by: {verifyEntry.approvedBy}</p>
              {verifyEntry.paymentDueDate && (
                <p>
                  Pay on (user):{" "}
                  <strong>{formatDateDDMMYYYY(verifyEntry.paymentDueDate)}</strong>
                </p>
              )}
            </div>

            {payee && (upiUrl || bankDetails || payee.preferredMethod === "cash") && (
              <div className="mt-3 space-y-2 rounded-xl border border-[#D6E6F5] bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7A9BB8]">
                  Quick pay — {payee.name}
                </p>

                {upiUrl && (
                  <a
                    href={upiUrl}
                    onClick={() => setPaymentMethod("GPay / UPI")}
                    className="flex items-center gap-3 rounded-xl border border-[#4285F4] bg-[#E8F1FE] px-3 py-3 text-sm font-semibold text-[#1A5FD4] active:scale-[0.99]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg">
                      G
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">Pay with GPay / UPI</span>
                      <span className="block truncate text-xs font-normal text-[#5A7FA5]">
                        {payee.upiId} · ₹{verifyAmount.toLocaleString("en-IN")}
                      </span>
                    </span>
                  </a>
                )}

                {bankDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("Bank Transfer");
                      void copyText(bankDetails, "Bank details");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#0B4A8C] bg-[#EEF5FC] px-3 py-3 text-left text-sm font-semibold text-[#0B4A8C] active:scale-[0.99]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">Copy bank details</span>
                      <span className="block truncate text-xs font-normal text-[#5A7FA5]">
                        {payee.bankAccount}
                        {payee.ifsc ? ` · ${payee.ifsc}` : ""}
                      </span>
                    </span>
                  </button>
                )}

                {payee.preferredMethod === "cash" && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("Cash");
                      setPaymentPaidTo(payee.name);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-left text-sm font-semibold text-amber-900 active:scale-[0.99]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg">
                      ₹
                    </span>
                    <span>
                      Cash to {payee.name}
                      <span className="block text-xs font-normal text-amber-800">
                        ₹{verifyAmount.toLocaleString("en-IN")} in hand
                      </span>
                    </span>
                  </button>
                )}

                {copyMsg && <p className="text-xs font-medium text-green-700">{copyMsg}</p>}
              </div>
            )}

            {!payee && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                No payment details saved for {verifyEntry.name}. Add UPI / bank in Defaults →
                Requested by.
              </p>
            )}

            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Payment method</p>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium ${
                      paymentMethod === m
                        ? "border-[#0B4A8C] bg-[#EEF5FC] text-[#0B4A8C]"
                        : "border-zinc-200 text-zinc-600"
                    }`}
                  >
                    {m === "GPay / UPI" ? "GPay" : m}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Payment date *</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(ev) => setPaymentDate(ev.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>

            {paymentMethod === "Bank Transfer" ? (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  UTR / Bank reference *
                </label>
                <input
                  value={paymentReference}
                  onChange={(ev) => setPaymentReference(ev.target.value)}
                  placeholder="UTR123456789"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
            ) : paymentMethod === "GPay / UPI" ? (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  UPI transaction ID *
                </label>
                <input
                  value={paymentReference}
                  onChange={(ev) => setPaymentReference(ev.target.value)}
                  placeholder="After GPay payment"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-zinc-600">Paid to *</label>
                <input
                  value={paymentPaidTo}
                  onChange={(ev) => setPaymentPaidTo(ev.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Payment note (optional)
              </label>
              <input
                value={paymentNote}
                onChange={(ev) => setPaymentNote(ev.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <button
              type="button"
              disabled={saving}
              onClick={handleVerify}
              className="mt-4 w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Mark as Paid & Verify"}
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
