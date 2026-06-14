"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { StockRequest } from "@/lib/stockRequestTypes";
import { StockThumbnail } from "../StockThumbnail";
import { ShareWhatsAppButton } from "../ShareWhatsAppButton";
import { formatDateTimeDDMMYYYY } from "@/lib/dateFormat";

import type { StockFlowItem } from "./StockMovementFlow";
import { isValidMobile, sanitizeMobileInput } from "@/lib/phone";
import { matchesStockSearch } from "@/lib/stockSearch";

export type ClaimUpdatePayload = {
  customerName: string;
  customerPhone: string;
  stockId?: string;
  qty?: number;
  note?: string;
  resolutionNote?: string;
};

type Props = {
  requests: StockRequest[];
  loading?: boolean;
  shopName?: string;
  error?: string;
  items?: StockFlowItem[];
  onApprove: (id: string, resolutionNote?: string) => Promise<boolean>;
  onReject: (id: string, resolutionNote?: string) => Promise<boolean>;
  onUpdate: (id: string, payload: ClaimUpdatePayload) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onRefresh: () => void;
  onAddRequest?: () => void;
};

type Tab = "awaiting" | "approved" | "rejected";

/** Match customer, mobile, or product details across all statuses. */
function matchesSearch(r: StockRequest, q: string): boolean {
  if (!q) return true;
  const qLower = q.toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const customer = (r.customerName || "").toLowerCase();
  const phone = (r.customerPhone || "").replace(/\D/g, "");
  if (customer.includes(qLower)) return true;
  if (qDigits.length > 0 && phone.includes(qDigits)) return true;
  if ((r.customerPhone || "").toLowerCase().includes(qLower)) return true;

  const productHay = [r.name, r.brand, r.size, r.note, r.resolutionNote]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return productHay.includes(qLower);
}

export function OrderClaimFlow({
  requests,
  loading,
  shopName,
  error,
  items = [],
  onApprove,
  onReject,
  onUpdate,
  onDelete,
  onRefresh,
  onAddRequest,
}: Props) {
  const [tab, setTab] = useState<Tab>("awaiting");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    id: string;
    action: "approve" | "reject";
  } | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [editTarget, setEditTarget] = useState<StockRequest | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editResolutionNote, setEditResolutionNote] = useState("");
  const [editStockId, setEditStockId] = useState("");
  const [editQty, setEditQty] = useState("1");
  const [editSearch, setEditSearch] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const q = search.trim().toLowerCase();

  const awaiting = useMemo(
    () => requests.filter((r) => r.status === "pending" && matchesSearch(r, q)),
    [requests, q]
  );
  const approved = useMemo(
    () => requests.filter((r) => r.status === "approved" && matchesSearch(r, q)),
    [requests, q]
  );
  const rejected = useMemo(
    () => requests.filter((r) => r.status === "rejected" && matchesSearch(r, q)),
    [requests, q]
  );

  const lists: Record<Tab, StockRequest[]> = {
    awaiting,
    approved,
    rejected,
  };

  const isSearching = q.length > 0;
  const searchTotal = awaiting.length + approved.length + rejected.length;

  const counts = {
    awaiting: isSearching
      ? awaiting.length
      : requests.filter((r) => r.status === "pending").length,
    approved: isSearching
      ? approved.length
      : requests.filter((r) => r.status === "approved").length,
    rejected: isSearching
      ? rejected.length
      : requests.filter((r) => r.status === "rejected").length,
  };

  async function submitAction() {
    if (!actionTarget) return;
    setBusyId(actionTarget.id);
    try {
      const note = resolutionNote.trim() || undefined;
      const ok =
        actionTarget.action === "approve"
          ? await onApprove(actionTarget.id, note)
          : await onReject(actionTarget.id, note);
      if (ok) {
        setActionTarget(null);
        setResolutionNote("");
      }
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(request: StockRequest) {
    setEditTarget(request);
    setEditName(request.customerName);
    setEditPhone(request.customerPhone ?? "");
    setEditNote(request.note ?? "");
    setEditResolutionNote(request.resolutionNote ?? "");
    setEditStockId(request.stockId);
    setEditQty(String(request.qty || 1));
    setEditSearch("");
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editTarget || !editName.trim() || !isValidMobile(editPhone)) return;
    setEditSaving(true);
    try {
      const payload: ClaimUpdatePayload = {
        customerName: editName.trim(),
        customerPhone: editPhone.trim(),
        note: editNote.trim() || undefined,
      };
      if (editTarget.status !== "pending") {
        payload.resolutionNote = editResolutionNote.trim() || undefined;
      } else {
        payload.stockId = editStockId;
        payload.qty = Number(editQty) || 1;
      }
      const ok = await onUpdate(editTarget._id, payload);
      if (ok) setEditTarget(null);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string, customerName: string) {
    if (!confirm(`Delete claim for ${customerName}?`)) return;
    setBusyId(id);
    try {
      await onDelete(id);
    } finally {
      setBusyId(null);
    }
  }

  const filteredEditItems = items.filter((it) => {
    const q = editSearch.trim();
    if (!q) return true;
    return matchesStockSearch(it, q);
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50/80 to-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const activeList = lists[tab];

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/90 via-violet-50/30 to-white pb-28">
      <div className="sticky top-0 z-20 border-b border-indigo-100/80 bg-white/95 px-4 pb-3 pt-2 backdrop-blur-md">
        <div className="mb-3 flex items-center gap-3">
          <Link
            href="/stock"
            className="shrink-0 rounded-xl p-2 text-zinc-500 ring-1 ring-zinc-200/80 active:scale-95"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-zinc-900">Claim list</p>
          </div>
          {onAddRequest && (
            <button
              type="button"
              onClick={onAddRequest}
              className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
            >
              + New
            </button>
          )}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer, mobile, or product…"
          className="mb-3 w-full rounded-xl bg-indigo-50 px-3 py-2.5 text-sm ring-1 ring-indigo-100"
        />

        <div className="grid grid-cols-3 gap-1.5">
          <TabBtn
            active={tab === "awaiting"}
            onClick={() => setTab("awaiting")}
            label="Awaiting"
            count={counts.awaiting}
            tone="amber"
          />
          <TabBtn
            active={tab === "approved"}
            onClick={() => setTab("approved")}
            label="Approved"
            count={counts.approved}
            tone="emerald"
          />
          <TabBtn
            active={tab === "rejected"}
            onClick={() => setTab("rejected")}
            label="Rejected"
            count={counts.rejected}
            tone="rose"
          />
        </div>
      </div>

      <div className="px-4 py-3">
        {error && <p className="mb-3 text-center text-sm text-red-600">{error}</p>}

        {isSearching ? (
          searchTotal === 0 ? (
            <div className="rounded-2xl bg-white py-12 text-center ring-1 ring-zinc-100">
              <p className="text-sm font-semibold text-zinc-600">
                No claims for this search
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <ClaimSection
                title="Awaiting"
                tone="amber"
                list={awaiting}
                shopName={shopName}
                busyId={busyId}
                onApprove={(id) => {
                  setResolutionNote("");
                  setActionTarget({ id, action: "approve" });
                }}
                onReject={(id) => {
                  setResolutionNote("");
                  setActionTarget({ id, action: "reject" });
                }}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
              <ClaimSection
                title="Approved"
                tone="emerald"
                list={approved}
                shopName={shopName}
                busyId={busyId}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
              <ClaimSection
                title="Rejected"
                tone="rose"
                list={rejected}
                shopName={shopName}
                busyId={busyId}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            </div>
          )
        ) : activeList.length === 0 ? (
          <div className="rounded-2xl bg-white py-12 text-center ring-1 ring-zinc-100">
            <p className="text-sm font-semibold text-zinc-600">
              No {tab === "awaiting" ? "awaiting" : tab} claims
            </p>
            {tab === "awaiting" && onAddRequest && (
              <button
                type="button"
                onClick={onAddRequest}
                className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"
              >
                + New claim
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {activeList.map((r) => (
              <ClaimCard
                key={r._id}
                request={r}
                shopName={shopName}
                showActions={tab === "awaiting"}
                busy={busyId === r._id}
                onApprove={() => {
                  setResolutionNote("");
                  setActionTarget({ id: r._id, action: "approve" });
                }}
                onReject={() => {
                  setResolutionNote("");
                  setActionTarget({ id: r._id, action: "reject" });
                }}
                onEdit={() => openEdit(r)}
                onDelete={() => handleDelete(r._id, r.customerName)}
              />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 w-full py-2 text-center text-xs font-medium text-indigo-600"
        >
          Refresh
        </button>
      </div>

      {actionTarget && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] bg-black/50"
            aria-label="Close"
            onClick={() => !busyId && setActionTarget(null)}
          />
          <div className="nav-sheet fixed inset-x-0 bottom-0 z-[81] rounded-t-3xl bg-white p-4 pb-[env(safe-area-inset-bottom)]">
            <h3 className="text-lg font-bold text-zinc-900">
              {actionTarget.action === "approve" ? "Approve claim" : "Reject claim"}
            </h3>
            <p className="mb-3 text-xs text-zinc-500">Add a note for purchase team (optional)</p>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Approval / rejection note…"
              rows={3}
              className="mb-3 w-full resize-none rounded-xl bg-zinc-50 px-3 py-2.5 text-sm ring-1 ring-zinc-200"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!!busyId}
                onClick={() => setActionTarget(null)}
                className="rounded-xl py-3 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!busyId}
                onClick={submitAction}
                className={`rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50 ${
                  actionTarget.action === "approve"
                    ? "bg-emerald-600"
                    : "bg-rose-600"
                }`}
              >
                {busyId ? "Saving…" : actionTarget.action === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </>
      )}

      {editTarget && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] bg-black/50"
            aria-label="Close"
            onClick={() => !editSaving && setEditTarget(null)}
          />
          <div className="nav-sheet fixed inset-x-0 bottom-0 z-[81] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[env(safe-area-inset-bottom)]">
            <h3 className="mb-1 text-lg font-bold text-zinc-900">Edit claim</h3>
            <p className="mb-4 text-xs text-zinc-500">
              {editTarget.status === "pending"
                ? "Update customer, product, or damage note."
                : "Update customer details or resolution note."}
            </p>
            <form onSubmit={submitEdit} className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Customer name *"
                required
                className="w-full rounded-xl bg-zinc-50 px-3 py-2.5 text-sm ring-1 ring-zinc-200"
              />
              <input
                type="tel"
                inputMode="numeric"
                value={editPhone}
                onChange={(e) => setEditPhone(sanitizeMobileInput(e.target.value))}
                placeholder="10-digit mobile *"
                required
                minLength={10}
                maxLength={10}
                className="w-full rounded-xl bg-zinc-50 px-3 py-2.5 text-sm tabular-nums ring-1 ring-zinc-200"
              />
              {editTarget.status === "pending" && (
                <>
                  <input
                    type="search"
                    value={editSearch}
                    onChange={(e) => setEditSearch(e.target.value)}
                    placeholder="Search product…"
                    className="w-full rounded-xl bg-indigo-50 px-3 py-2.5 text-sm ring-1 ring-indigo-100"
                  />
                  <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl bg-zinc-50 p-1">
                    {filteredEditItems.slice(0, 20).map((it) => (
                      <button
                        key={it._id}
                        type="button"
                        onClick={() => setEditStockId(it._id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                          editStockId === it._id ? "bg-indigo-100 font-semibold text-indigo-900" : ""
                        }`}
                      >
                        <span className="truncate">{it.name}</span>
                        <span className="shrink-0 text-xs text-zinc-500">{it.count} pcs</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Damage / return reason (optional)"
                rows={2}
                className="w-full resize-none rounded-xl bg-zinc-50 px-3 py-2.5 text-sm ring-1 ring-zinc-200"
              />
              {editTarget.status !== "pending" && (
                <textarea
                  value={editResolutionNote}
                  onChange={(e) => setEditResolutionNote(e.target.value)}
                  placeholder="Approval / rejection note (optional)"
                  rows={2}
                  className="w-full resize-none rounded-xl bg-zinc-50 px-3 py-2.5 text-sm ring-1 ring-zinc-200"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditTarget(null)}
                  className="rounded-xl py-3 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    editSaving ||
                    !editName.trim() ||
                    !isValidMobile(editPhone) ||
                    (editTarget.status === "pending" && !editStockId)
                  }
                  className="rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {editSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function ClaimSection({
  title,
  tone,
  list,
  shopName,
  busyId,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}: {
  title: string;
  tone: "amber" | "emerald" | "rose";
  list: StockRequest[];
  shopName?: string;
  busyId: string | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onEdit?: (request: StockRequest) => void;
  onDelete?: (id: string, customerName: string) => void;
}) {
  if (list.length === 0) return null;

  const headerClass =
    tone === "amber"
      ? "text-amber-800"
      : tone === "emerald"
        ? "text-emerald-800"
        : "text-rose-800";

  return (
    <section>
      <h2 className={`mb-2 text-xs font-bold uppercase tracking-wide ${headerClass}`}>
        {title} ({list.length})
      </h2>
      <ul className="space-y-3">
        {list.map((r) => (
          <ClaimCard
            key={r._id}
            request={r}
            shopName={shopName}
            showActions={r.status === "pending" && !!onApprove && !!onReject}
            busy={busyId === r._id}
            onApprove={() => onApprove?.(r._id)}
            onReject={() => onReject?.(r._id)}
            onEdit={() => onEdit?.(r)}
            onDelete={() => onDelete?.(r._id, r.customerName)}
          />
        ))}
      </ul>
    </section>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: "amber" | "emerald" | "rose";
}) {
  const activeRing =
    tone === "amber"
      ? "ring-amber-400 bg-amber-50 text-amber-900"
      : tone === "emerald"
        ? "ring-emerald-400 bg-emerald-50 text-emerald-900"
        : "ring-rose-400 bg-rose-50 text-rose-900";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl py-2 text-center ring-2 transition-colors ${
        active ? activeRing : "bg-white text-zinc-600 ring-zinc-100"
      }`}
    >
      <span className="block text-[10px] font-bold uppercase">{label}</span>
      <span className="text-lg font-black tabular-nums">{count}</span>
    </button>
  );
}

function ClaimCard({
  request: r,
  shopName,
  showActions,
  busy,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}: {
  request: StockRequest;
  shopName?: string;
  showActions: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusBadge =
    r.status === "pending"
      ? "bg-amber-100 text-amber-800"
      : r.status === "approved"
        ? "bg-emerald-100 text-emerald-800"
        : "bg-rose-100 text-rose-800";

  return (
    <li className="overflow-hidden rounded-2xl bg-white p-3 shadow-sm ring-1 ring-indigo-100/80">
      <div className="flex gap-3">
        <StockThumbnail
          stockId={r.stockId}
          hasPhoto={r.hasPhoto}
          photoThumbUrl={r.photoThumbUrl}
          photoUrl={r.photoUrl}
          size="thumb"
          className="h-14 w-14 shrink-0 !rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${statusBadge}`}>
            {r.status === "pending" ? "Awaiting" : r.status}
          </span>
          <p className="mt-1 truncate text-sm font-bold text-zinc-900">{r.customerName}</p>
          {r.customerPhone && (
            <a href={`tel:${r.customerPhone}`} className="text-xs font-semibold text-indigo-600">
              {r.customerPhone}
            </a>
          )}
          <p className="mt-1 truncate text-xs text-zinc-600">{r.name}</p>
          {r.note && (
            <p className="mt-1 line-clamp-2 text-xs text-amber-800">{r.note}</p>
          )}
          {r.resolutionNote && (
            <p className="mt-1 rounded-lg bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
              <span className="font-semibold">Note: </span>
              {r.resolutionNote}
            </p>
          )}
          <p className="mt-1 text-[10px] text-zinc-400">
            {formatDateTimeDDMMYYYY(r.resolvedAt ?? r.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 self-center">
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            aria-label="Edit claim"
            title="Edit"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 active:scale-[0.98] disabled:opacity-50"
          >
            <EditIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            aria-label="Delete claim"
            title="Delete"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100 active:scale-[0.98] disabled:opacity-50"
          >
            <DeleteIcon className="h-4 w-4" />
          </button>
          <ShareWhatsAppButton
            className="h-9 w-9 shrink-0"
            shopName={shopName}
            name={r.name ?? ""}
            count={r.godownCount ?? 0}
            photoUrl={r.photoUrl}
            customerName={r.customerName}
            customerPhone={r.customerPhone}
            issueNote={r.note}
            shareKind="approval"
            title="Share on WhatsApp"
          />
        </div>
      </div>

      {showActions && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="rounded-xl bg-zinc-100 py-2.5 text-sm font-bold text-rose-700 active:scale-[0.98] disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-50"
          >
            Approve
          </button>
        </div>
      )}
    </li>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
