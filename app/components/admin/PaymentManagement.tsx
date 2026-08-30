"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";
import { notifyLedgerDataChanged } from "@/lib/clientDataCache";
import {
  buildUpiPayUrl,
  formatBankDetailsText,
  paymentMethodFromPerson,
} from "@/lib/expensePeople";
import { validatePaymentReference } from "@/lib/paymentReference";
import { requestLabel } from "@/lib/paymentWorkflow";
import type { Entry, ExpensePerson, PaymentVerifiedMethod } from "@/lib/types";

type PaymentFilter = "payment_pending" | "paid" | "approval_pending" | "all";

type PaymentEntry = Entry & { businessName?: string; payee?: ExpensePerson };

const PAYMENT_METHODS: PaymentVerifiedMethod[] = ["Cash", "GPay / UPI", "Bank Transfer"];
const DEFAULT_GPAY_NOTE = "Paid GPay";
const BULK_SAVE_CHUNK = 50;

type BulkProgress = {
  phase: "saving" | "sheet";
  done: number;
  total: number;
  failed: number;
};

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
  const [requestedBy, setRequestedBy] = useState("");
  const [category, setCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [requestedByNames, setRequestedByNames] = useState<string[]>([]);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [pendingTotal, setPendingTotal] = useState({ count: 0, amount: 0 });
  const [paidTotal, setPaidTotal] = useState({ count: 0, amount: 0 });
  const [approvalTotal, setApprovalTotal] = useState({ count: 0, amount: 0 });
  const [filteredTotal, setFilteredTotal] = useState({ count: 0, amount: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [saveElapsed, setSaveElapsed] = useState(0);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ filter });
      if (businessId) params.set("businessId", businessId);
      if (requestedBy) params.set("requestedBy", requestedBy);
      if (category) params.set("category", category);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await apiFetch(`/api/admin/payments?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      const nextEntries = (data.entries ?? []) as PaymentEntry[];
      setEntries(nextEntries);
      setUsers(data.users ?? []);
      setRequestedByNames(data.requestedByNames ?? []);
      setCategoryNames(data.categoryNames ?? []);
      if (data.pendingTotal) setPendingTotal(data.pendingTotal);
      else setPendingTotal({ count: 0, amount: 0 });
      if (data.paidTotal) setPaidTotal(data.paidTotal);
      else setPaidTotal({ count: 0, amount: 0 });
      if (data.approvalTotal) setApprovalTotal(data.approvalTotal);
      else setApprovalTotal({ count: 0, amount: 0 });
      if (data.filteredTotal) setFilteredTotal(data.filteredTotal);
      else setFilteredTotal({ count: 0, amount: 0 });
      if (data.counts) setCounts(data.counts);
      const pendingIds = nextEntries
        .filter(
          (entry) =>
            entry.paymentStatus !== "paid" &&
            (entry.approvalStatus === "approved" || Boolean(entry.approvedBy?.trim()))
        )
        .map((entry) => entry._id)
        .filter((id): id is string => Boolean(id));
      setSelectedIds(
        filter === "payment_pending" && (businessId || requestedBy) ? pendingIds : []
      );
    } catch {
      setError("Could not load payment list");
    } finally {
      setLoading(false);
    }
  }, [filter, businessId, requestedBy, category, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!businessId) {
      setRequestedBy("");
      setCategory("");
    }
  }, [businessId]);

  useEffect(() => {
    if (!businessId || !requestedBy) return;
    if (!requestedByNames.includes(requestedBy)) {
      setRequestedBy("");
    }
  }, [businessId, requestedByNames, requestedBy]);

  useEffect(() => {
    if (!businessId || !category) return;
    if (requestedBy && !requestedByNames.includes(requestedBy)) {
      setRequestedBy("");
    }
  }, [businessId, category, requestedByNames, requestedBy]);

  useEffect(() => {
    if (!businessId || !requestedBy) return;
    if (category && !categoryNames.includes(category)) {
      setCategory("");
    }
  }, [businessId, requestedBy, categoryNames, category]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 8000);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => {
    if (!copyMsg) return;
    const t = setTimeout(() => {
      setCopyMsg("");
      setCopiedKey("");
    }, 1600);
    return () => clearTimeout(t);
  }, [copyMsg]);

  useEffect(() => {
    if (!saving) {
      setSaveElapsed(0);
      return;
    }
    const t = setInterval(() => setSaveElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [saving]);

  function choosePaymentMethod(method: PaymentVerifiedMethod) {
    setPaymentMethod(method);
    if (method === "GPay / UPI") setPaymentReference(DEFAULT_GPAY_NOTE);
    else if (method === "Bank Transfer") setPaymentReference("");
  }

  function openVerify(entry: PaymentEntry) {
    const payee = entry.payee;
    const method = paymentMethodFromPerson(payee);
    setVerifyEntry(entry);
    choosePaymentMethod(method);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    if (method !== "GPay / UPI") setPaymentReference("");
    setPaymentPaidTo(method === "Cash" ? entry.name : "");
    setPaymentNote("");
    setError("");
    setCopyMsg("");
    setCopiedKey("");
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

  async function copyText(text: string, label: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setCopyMsg(`${label} copied`);
    } catch {
      setCopiedKey("");
      setCopyMsg("Could not copy");
    }
  }

  async function handleVerify() {
    if (!verifyEntry || saving) return;
    if (!paymentDate) {
      setError("Payment date is required");
      return;
    }
    if (paymentMethod === "Cash" && !paymentPaidTo.trim()) {
      setError("Paid to is required for cash");
      return;
    }
    const referenceCheck = validatePaymentReference(paymentMethod, paymentReference);
    if (!referenceCheck.ok) {
      setError(referenceCheck.error);
      return;
    }
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
              ? referenceCheck.value
              : undefined,
          paymentPaidTo: paymentMethod === "Cash" ? paymentPaidTo : undefined,
          paymentNote: paymentNote || undefined,
        }),
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Verification failed");
      notifyLedgerDataChanged();
      setSuccess("Payment marked as paid & verified");
      setVerifyEntry(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSaving(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function handleBulkPay() {
    if (saving) return;
    if (!requestedBy && selectedIds.length === 0 && !businessId) {
      setError("Select a site, a person, or tick the pending entries to pay");
      return;
    }
    const idsToPay =
      selectedIds.length > 0
        ? [...selectedIds]
        : payableIds;
    if (idsToPay.length === 0) {
      setError("No pending payments selected");
      return;
    }
    if (!paymentDate) {
      setError("Payment date is required");
      return;
    }
    if (paymentMethod === "Cash" && !paymentPaidTo.trim() && !requestedBy) {
      setError("Paid to is required for cash");
      return;
    }
    const referenceCheck = validatePaymentReference(paymentMethod, paymentReference);
    if (!referenceCheck.ok) {
      setError(referenceCheck.error);
      return;
    }
    setSaving(true);
    setError("");
    const ids = idsToPay;
    const total = ids.length;
    setBulkProgress({ phase: "saving", done: 0, total, failed: 0 });
    try {
      let paidCount = 0;
      let paidAmount = 0;
      const paidIds: string[] = [];

      for (let i = 0; i < ids.length; i += BULK_SAVE_CHUNK) {
        const chunk = ids.slice(i, i + BULK_SAVE_CHUNK);
        const res = await apiFetch("/api/admin/payments/bulk-pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestedBy: requestedBy || undefined,
            category: category || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
            businessId: businessId || undefined,
            ids: chunk,
            skipSheets: true,
            paymentMethod,
            paymentDate,
            paymentReference:
              paymentMethod === "Bank Transfer" || paymentMethod === "GPay / UPI"
                ? referenceCheck.value
                : undefined,
            paymentPaidTo:
              paymentMethod === "Cash" ? paymentPaidTo.trim() || requestedBy : undefined,
            paymentNote: paymentNote || undefined,
          }),
        });
        const data = await readApiJson<{
          paidCount?: number;
          paidAmount?: number;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error || "Bulk pay failed");
        paidCount += data.paidCount ?? 0;
        paidAmount += Number(data.paidAmount || 0);
        paidIds.push(...chunk);
        setBulkProgress({
          phase: "saving",
          done: Math.min(paidIds.length, total),
          total,
          failed: 0,
        });
      }

      setBulkProgress({ phase: "sheet", done: 0, total: paidIds.length, failed: 0 });
      if (paidIds.length > 0) {
        const syncRes = await apiFetch("/api/admin/payments/sync-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: paidIds }),
        });
        const syncData = await readApiJson<{ synced?: number; failed?: number; errors?: string[] }>(
          syncRes
        );
        const sheetFailed = syncData.failed ?? 0;
        setBulkProgress({
          phase: "sheet",
          done: syncData.synced ?? paidIds.length,
          total: paidIds.length,
          failed: sheetFailed,
        });
        if (!syncRes.ok || sheetFailed > 0) {
          setError(
            syncData.errors?.[0] ||
              `Paid in app but ${sheetFailed} sheet row(s) need admin retry. Users do not need to tap Sync All.`
          );
        }
      }

      notifyLedgerDataChanged();
      setSuccess(
        `Marked ${paidCount} as paid — ₹${paidAmount.toLocaleString("en-IN")}. Google Sheet updated by admin — users do not need to sync again.`
      );
      setShowBulk(false);
      setPaymentReference("");
      setBulkProgress(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk pay failed");
    } finally {
      setSaving(false);
      setBulkProgress(null);
    }
  }

  const filters: { id: PaymentFilter; label: string }[] = [
    { id: "payment_pending", label: "To pay" },
    { id: "approval_pending", label: "Need approver" },
    { id: "paid", label: "Paid" },
    { id: "all", label: "All" },
  ];

  const shellClass = dashboard
    ? "space-y-4"
    : "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

  const payableEntries = entries.filter(
    (entry) =>
      entry.paymentStatus !== "paid" &&
      (entry.approvalStatus === "approved" || Boolean(entry.approvedBy?.trim()))
  );
  const payableIds = payableEntries
    .map((entry) => entry._id)
    .filter((id): id is string => Boolean(id));

  function selectAllPayable() {
    setSelectedIds(payableIds);
  }

  function clearPayableSelection() {
    setSelectedIds([]);
  }

  const verifyAmount = verifyEntry ? Math.abs(verifyEntry.amount) : 0;
  const selectedPendingAmount = entries
    .filter((entry) => entry._id && selectedIds.includes(entry._id))
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const payee = verifyEntry?.payee;
  const upiUrl =
    payee?.upiId && verifyEntry
      ? buildUpiPayUrl({
          upiId: payee.upiId,
          name: payee.name,
          amount: verifyAmount,
          note: requestLabel(verifyEntry).slice(0, 50),
        })
      : null;
  const upiReferenceCheck =
    paymentMethod === "GPay / UPI" || paymentMethod === "Bank Transfer"
      ? validatePaymentReference(paymentMethod, paymentReference)
      : { ok: true as const, value: "" };
  const bankDetails = payee ? formatBankDetailsText(payee) : "";
  const filterLabel =
    filter === "approval_pending"
      ? "Pending approval"
      : filter === "payment_pending"
        ? "To pay"
        : filter === "paid"
          ? "Paid"
          : "All statuses";
  const rangeLabel =
    fromDate && toDate
      ? `${formatDateDDMMYYYY(fromDate)} to ${formatDateDDMMYYYY(toDate)}`
      : fromDate
        ? `From ${formatDateDDMMYYYY(fromDate)}`
        : toDate
          ? `Until ${formatDateDDMMYYYY(toDate)}`
          : "All dates";
  const peopleLabel = requestedBy || "All people";
  const categoryLabel = category || "All categories";
  const accountLabel = users.find((u) => u.userId === businessId)?.name || "All sites";

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
            className="min-h-[4.5rem] rounded-2xl border border-amber-200 bg-amber-50 px-2 py-2.5 text-left active:scale-[0.99]"
          >
            <p className="text-[10px] font-semibold uppercase leading-tight text-amber-800">Need approver</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">{approvalTotal.count}</p>
            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-amber-800">
              ₹{Math.round(approvalTotal.amount).toLocaleString("en-IN")}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFilter("payment_pending")}
            className="min-h-[4.5rem] rounded-2xl border border-yellow-200 bg-yellow-50 px-2 py-2.5 text-left active:scale-[0.99]"
          >
            <p className="text-[10px] font-semibold uppercase leading-tight text-yellow-800">To pay</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-yellow-900">{pendingTotal.count}</p>
            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-yellow-800">
              ₹{Math.round(pendingTotal.amount).toLocaleString("en-IN")}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFilter("paid")}
            className="min-h-[4.5rem] rounded-2xl border border-green-200 bg-green-50 px-2 py-2.5 text-left active:scale-[0.99]"
          >
            <p className="text-[10px] font-semibold uppercase leading-tight text-green-800">Paid</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-green-900">{paidTotal.count}</p>
            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-green-800">
              ₹{Math.round(paidTotal.amount).toLocaleString("en-IN")}
            </p>
          </button>
        </div>
      )}

      <div className={`${dashboard ? "rounded-2xl border border-[#D6E6F5] bg-white p-3 shadow-sm sm:p-4" : ""}`}>
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-3.5 py-2.5 text-xs font-semibold ${
              filter === f.id
                ? "bg-[#0B4A8C] text-white"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-2xl border border-[#D6E6F5] bg-[#F8FBFE] p-3">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5A7FA5]">
          Site account
        </label>
        <select
          value={businessId}
          onChange={(e) => {
            setBusinessId(e.target.value);
            setRequestedBy("");
            setCategory("");
          }}
          className="w-full rounded-xl border border-[#D6E6F5] bg-white px-3 py-2.5 text-sm text-[#0B4A8C] outline-none focus:border-[#0B4A8C]"
        >
          <option value="">All sites</option>
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.name}
            </option>
          ))}
        </select>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5A7FA5]">
              Requested by
            </label>
            <select
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              disabled={!businessId}
              className="w-full rounded-xl border border-[#D6E6F5] bg-white px-3 py-2.5 text-sm text-[#0B4A8C] outline-none focus:border-[#0B4A8C] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              <option value="">
                {businessId ? "All people" : "Select site account first"}
              </option>
              {requestedByNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5A7FA5]">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={!businessId}
              className="w-full rounded-xl border border-[#D6E6F5] bg-white px-3 py-2.5 text-sm text-[#0B4A8C] outline-none focus:border-[#0B4A8C] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              <option value="">
                {businessId ? "All categories" : "Select site account first"}
              </option>
              {categoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5A7FA5]">
              From date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-[#D6E6F5] bg-white px-3 py-2.5 text-sm text-[#0B4A8C]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5A7FA5]">
              To date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-[#D6E6F5] bg-white px-3 py-2.5 text-sm text-[#0B4A8C]"
            />
          </div>
        </div>
      </div>

        <div className="mb-3 rounded-2xl bg-[#0B4A8C] px-4 py-3 text-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-100">
            {filterLabel} total
          </p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">
            ₹{Math.round(filteredTotal.amount).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-sky-100">
            {filteredTotal.count} {filteredTotal.count === 1 ? "entry" : "entries"} · {rangeLabel}
            {" · "}
            {peopleLabel} · {categoryLabel}
            {businessId ? ` · ${accountLabel}` : ""}
          </p>
        </div>

        {filter === "payment_pending" && pendingTotal.count > 0 && (businessId || requestedBy) ? (
          <div className="mb-3 rounded-2xl border border-[#E8D48A] bg-gradient-to-b from-[#FFFBEB] to-[#FEF9E7] p-3 shadow-sm">
            <p className="text-sm font-bold text-[#5C4A0A]">
              {requestedBy || accountLabel} · {pendingTotal.count} to pay · ₹
              {pendingTotal.amount.toLocaleString("en-IN")}
            </p>
            <p className="mt-0.5 text-[11px] text-[#8A7428]">
              {selectedIds.length > 0
                ? `${selectedIds.length} selected for bulk pay`
                : "Tick entries below or use Select all"}
              {fromDate || toDate
                ? ` · Dates ${fromDate || "…"} to ${toDate || "…"}`
                : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={selectAllPayable}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D4C078] bg-white px-3 py-2.5 text-xs font-semibold text-[#5C4A0A] shadow-sm active:scale-[0.98]"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                Select all ({payableIds.length})
              </button>
              {selectedIds.length > 0 ? (
                <button
                  type="button"
                  onClick={clearPayableSelection}
                  className="flex items-center justify-center gap-1 rounded-xl border border-[#D4C078] bg-white px-3 py-2.5 text-xs font-semibold text-[#5C4A0A] shadow-sm active:scale-[0.98]"
                  aria-label="Clear selection"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Clear
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setFilter("payment_pending");
                setPaymentMethod(requestedBy ? "Cash" : "Bank Transfer");
                setPaymentPaidTo(requestedBy || "");
                setPaymentDate(new Date().toISOString().split("T")[0]);
                setPaymentReference("");
                setPaymentNote("");
                setShowBulk(true);
                setVerifyEntry(null);
                setEditEntry(null);
              }}
              disabled={selectedIds.length === 0 && !requestedBy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B4A8C] py-3 text-sm font-bold text-white shadow-md disabled:opacity-50 active:scale-[0.99]"
            >
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Mark {selectedIds.length || pendingTotal.count} as paid
            </button>
          </div>
        ) : null}

      {error && !verifyEntry && !showBulk && (
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
        <div className="space-y-2">
          {entries.map((e) => {
            const isPaid = e.paymentStatus === "paid";
            const isExpanded = !isPaid || expandedId === e._id;
            return (
            <article
              key={e._id}
              className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => {
                  if (!isPaid) return;
                  setExpandedId((current) => (current === e._id ? null : e._id ?? null));
                }}
              >
                <span className="flex min-w-0 items-start gap-2">
                  {filter === "payment_pending" &&
                  e.paymentStatus !== "paid" &&
                  (e.approvalStatus === "approved" || Boolean(e.approvedBy?.trim())) ? (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[#0B4A8C]"
                      checked={selectedIds.includes(e._id ?? "")}
                      onChange={() => e._id && toggleSelected(e._id)}
                      onClick={(ev) => ev.stopPropagation()}
                    />
                  ) : null}
                  <span className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {e.category?.trim() || e.note?.trim() || e.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {e.name}
                      {e.payee?.preferredMethod === "cash" ? " · Cash" : ""}
                      {e.payee?.preferredMethod === "gpay" && (e.payee.upiId || e.payee.mobile)
                        ? " · GPay"
                        : ""}
                      {e.payee?.preferredMethod === "bank" ? " · Bank" : ""}
                    </p>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-base font-bold tabular-nums text-[#0B4A8C]">
                    ₹{Math.abs(e.amount).toLocaleString("en-IN")}
                  </span>
                  {isPaid ? (
                    <svg
                      className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  ) : null}
                </span>
              </button>
              {isPaid && !isExpanded ? (
                <p className="mt-1 text-[11px] font-medium text-green-700">Paid · tap for details</p>
              ) : (
                <>
              {isExpanded && isPaid ? (
                <>
                  {e.note?.trim() && e.note.trim() !== (e.category ?? "").trim() ? (
                    <p className="mt-0.5 truncate text-[11px] text-zinc-400">{e.note.trim()}</p>
                  ) : null}
                  {e.businessName ? (
                    <p className="text-[11px] text-zinc-400">{e.businessName}</p>
                  ) : null}
                </>
              ) : !isPaid ? (
                <>
                  {e.note?.trim() && e.note.trim() !== (e.category ?? "").trim() ? (
                    <p className="mt-0.5 truncate text-[11px] text-zinc-400">{e.note.trim()}</p>
                  ) : null}
                  {e.businessName ? (
                    <p className="text-[11px] text-zinc-400">{e.businessName}</p>
                  ) : null}
                </>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                <span>Approved: {e.approvedBy || "—"}</span>
                <span>Pay on: {e.paymentDueDate ? formatDateDDMMYYYY(e.paymentDueDate) : "—"}</span>
              </div>
              <p className="mt-1 text-xs font-medium">
                {e.approvalStatus === "pending" ? (
                  <span className="text-amber-700">User pending</span>
                ) : e.paymentStatus === "paid" ? (
                  <span className="text-green-700">Paid</span>
                ) : (
                  <span className="text-yellow-700">Payment pending</span>
                )}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(e)}
                  className="rounded-xl border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(e)}
                  disabled={saving}
                  className="rounded-xl border border-red-200 py-2.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
                {e.approvalStatus === "pending" ? (
                  <span className="flex items-center justify-center text-center text-[10px] leading-tight text-zinc-500">
                    User adds approver
                  </span>
                ) : e.paymentStatus === "pending" ? (
                  <button
                    type="button"
                    onClick={() => openVerify(e)}
                    className="rounded-xl bg-[#0B4A8C] py-2.5 text-xs font-bold text-white"
                  >
                    Pay
                  </button>
                ) : (
                  <span className="flex items-center justify-center text-xs font-medium text-green-700">
                    Done
                  </span>
                )}
              </div>
                </>
              )}
            </article>
            );
          })}
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
          <div className="fixed inset-x-0 bottom-0 z-[71] max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:inset-x-4 sm:bottom-auto sm:top-8 sm:mx-auto sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl">
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
          <div className="fixed inset-x-0 bottom-0 z-[71] max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:inset-x-4 sm:bottom-auto sm:top-8 sm:mx-auto sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl">
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
              {payee?.mobile ? (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p>
                    Mobile: <strong className="tabular-nums">{payee.mobile}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      choosePaymentMethod("GPay / UPI");
                      void copyText(payee.mobile!, "Mobile number", "mobile");
                    }}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white transition-colors active:scale-90 ${
                      copiedKey === "mobile" ? "copy-pop bg-emerald-700" : "bg-emerald-600"
                    }`}
                  >
                    {copiedKey === "mobile" ? "Copied" : "Copy"}
                  </button>
                </div>
              ) : null}
            </div>

            {payee && (upiUrl || bankDetails || payee.preferredMethod === "cash" || payee.mobile) && (
              <div className="mt-3 space-y-2 rounded-xl border border-[#D6E6F5] bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7A9BB8]">
                  Quick pay — {payee.name}
                </p>

                {payee.mobile && (payee.preferredMethod === "gpay" || paymentMethod === "GPay / UPI") && (
                  <button
                    type="button"
                    onClick={() => {
                      choosePaymentMethod("GPay / UPI");
                      void copyText(payee.mobile!, "Mobile number", "mobile-gpay");
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold active:scale-95 ${
                      copiedKey === "mobile-gpay"
                        ? "copy-pop border-emerald-600 bg-emerald-600 text-white"
                        : "border-emerald-500 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        copiedKey === "mobile-gpay" ? "bg-white text-emerald-700" : "bg-white text-emerald-700"
                      }`}
                    >
                      {copiedKey === "mobile-gpay" ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">
                        {copiedKey === "mobile-gpay" ? "Copied" : "Copy mobile for GPay"}
                      </span>
                      <span
                        className={`block truncate text-xs font-normal tabular-nums ${
                          copiedKey === "mobile-gpay" ? "text-white/80" : "text-[#5A7FA5]"
                        }`}
                      >
                        {payee.mobile} · ₹{verifyAmount.toLocaleString("en-IN")}
                      </span>
                    </span>
                  </button>
                )}
                {upiUrl && (
                  <>
                    <a
                      href={upiUrl}
                      onClick={() => choosePaymentMethod("GPay / UPI")}
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
                  </>
                )}

                {bankDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("Bank Transfer");
                      void copyText(bankDetails, "Bank details", "bank");
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold active:scale-95 ${
                      copiedKey === "bank"
                        ? "copy-pop border-emerald-600 bg-emerald-600 text-white"
                        : "border-[#0B4A8C] bg-[#EEF5FC] text-[#0B4A8C]"
                    }`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{copiedKey === "bank" ? "Copied" : "Copy bank details"}</span>
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
                No payment details saved for {verifyEntry.name}. Add mobile / UPI / bank in Defaults →
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
                    onClick={() => choosePaymentMethod(m)}
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
                  placeholder="12-digit UTR from bank receipt"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
                {paymentReference.trim() && !upiReferenceCheck.ok && (
                  <p className="mt-1 text-[11px] text-red-600">{upiReferenceCheck.error}</p>
                )}
              </div>
            ) : paymentMethod === "GPay / UPI" ? (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  GPay note *
                </label>
                <input
                  value={paymentReference}
                  onChange={(ev) => setPaymentReference(ev.target.value)}
                  placeholder="Paid GPay"
                  autoComplete="off"
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
              disabled={
                saving ||
                ((paymentMethod === "GPay / UPI" || paymentMethod === "Bank Transfer") &&
                  !upiReferenceCheck.ok)
              }
              onClick={handleVerify}
              className="mt-4 w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Mark as Paid & Verify"}
            </button>
          </div>
        </>
      )}

      {showBulk && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/50"
            onClick={() => {
              if (!saving) setShowBulk(false);
            }}
            aria-label="Close"
          />
          <div className="fixed inset-x-0 bottom-0 z-[71] max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:inset-x-4 sm:bottom-auto sm:top-8 sm:mx-auto sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl">
            <h3 className="text-base font-bold text-zinc-900">Bulk mark as paid</h3>
            <div className="mt-2 rounded-lg bg-[#F4F8FC] p-3 text-sm text-[#0B4A8C]">
              <p className="font-semibold">
                {requestedBy || (businessId ? accountLabel : "Selected entries")}
              </p>
              <p>
                {selectedIds.length} pending · ₹{selectedPendingAmount.toLocaleString("en-IN")}
              </p>
              {(fromDate || toDate) && (
                <p className="text-xs">
                  {fromDate || "…"} to {toDate || "…"}
                </p>
              )}
            </div>

            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Payment method</p>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => choosePaymentMethod(m)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium ${
                      paymentMethod === m
                        ? "border-[#0B4A8C] bg-[#EEF5FC] text-[#0B4A8C]"
                        : "border-zinc-200 text-zinc-600"
                    }`}
                  >
                    {m === "GPay / UPI" ? "GPay" : m === "Bank Transfer" ? "Bank" : "Cash"}
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

            {paymentMethod === "Cash" ? (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-zinc-600">Paid to *</label>
                <input
                  value={paymentPaidTo}
                  onChange={(ev) => setPaymentPaidTo(ev.target.value)}
                  placeholder={requestedBy || "Name"}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  {paymentMethod === "GPay / UPI" ? "GPay note *" : "UTR / Bank reference *"}
                </label>
                <input
                  value={paymentReference}
                  onChange={(ev) => setPaymentReference(ev.target.value)}
                  placeholder={
                    paymentMethod === "GPay / UPI"
                      ? DEFAULT_GPAY_NOTE
                      : "One UTR for this bulk pay"
                  }
                  autoComplete="off"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
                {paymentMethod === "Bank Transfer" &&
                paymentReference.trim() &&
                !upiReferenceCheck.ok ? (
                  <p className="mt-1 text-[11px] text-red-600">{upiReferenceCheck.error}</p>
                ) : null}
              </div>
            )}

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Note (optional)</label>
              <input
                value={paymentNote}
                onChange={(ev) => setPaymentNote(ev.target.value)}
                placeholder="e.g. Paid Murugan weekly wages"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            {saving && bulkProgress && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                <p className="font-semibold">
                  {bulkProgress.phase === "saving"
                    ? `Saving in app: ${bulkProgress.done} / ${bulkProgress.total}`
                    : `Updating Google Sheet: ${bulkProgress.done} / ${bulkProgress.total}`}
                </p>
                <p className="mt-0.5 text-xs">
                  {bulkProgress.phase === "saving"
                    ? "Do not tap again. Payments are being marked paid one batch at a time."
                    : bulkProgress.failed > 0
                      ? `${bulkProgress.failed} sheet row${bulkProgress.failed === 1 ? "" : "s"} still need retry — do not tap Sync All yet.`
                      : "Sheet rows update one by one. Please wait."}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-200">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all duration-300"
                    style={{
                      width: `${
                        bulkProgress.total > 0
                          ? Math.min(
                              100,
                              bulkProgress.phase === "saving"
                                ? (bulkProgress.done / bulkProgress.total) * 50
                                : 50 + (bulkProgress.done / bulkProgress.total) * 50
                            )
                          : 8
                      }%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-amber-800">{saveElapsed}s elapsed</p>
              </div>
            )}

            <button
              type="button"
              disabled={
                saving ||
                selectedIds.length === 0 ||
                ((paymentMethod === "GPay / UPI" || paymentMethod === "Bank Transfer") &&
                  !upiReferenceCheck.ok)
              }
              onClick={handleBulkPay}
              className="mt-4 w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving && bulkProgress
                ? bulkProgress.phase === "saving"
                  ? `Saving ${bulkProgress.done} / ${bulkProgress.total}…`
                  : `Sheet ${bulkProgress.done} / ${bulkProgress.total}…`
                : `Mark ${selectedIds.length} as paid · ₹${selectedPendingAmount.toLocaleString("en-IN")}`}
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
