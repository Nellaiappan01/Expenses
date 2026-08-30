"use client";

import type { Entry } from "@/lib/types";
import {
  formatPaymentVerifiedMethod,
  paymentStatusLabel,
  requestLabel,
  workflowBadgeMeta,
} from "@/lib/paymentWorkflow";
import { formatDateDDMMYYYY } from "@/lib/dateFormat";

function WorkflowStatusIcon({
  kind,
}: {
  kind: "pending_approval" | "payment_pending" | "paid" | "rejected" | "nil";
}) {
  const className = "h-3.5 w-3.5 shrink-0";

  if (kind === "nil") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
      </svg>
    );
  }

  if (kind === "pending_approval") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  }

  if (kind === "payment_pending") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    );
  }

  if (kind === "paid") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function PaymentStatusBadge({
  entry,
  onPendingApprovalClick,
  iconOnly = false,
}: {
  entry: Pick<
    Entry,
    "type" | "approvalStatus" | "paymentStatus" | "paymentVerifiedMethod" | "paymentDate" | "paymentReference" | "isNil"
  >;
  onPendingApprovalClick?: () => void;
  /** Clock only — used next to the delete icon on Track. */
  iconOnly?: boolean;
}) {
  const meta = workflowBadgeMeta(entry);
  if (!meta) return null;

  const clickable = meta.icon === "pending_approval" && Boolean(onPendingApprovalClick);
  const className = iconOnly
    ? `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.className} ${
        clickable ? "active:scale-[0.98]" : ""
      }`
    : `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.className} ${
        clickable ? "active:scale-[0.98]" : ""
      }`;
  const inner = (
    <>
      <WorkflowStatusIcon kind={meta.icon} />
      {iconOnly ? null : meta.label}
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPendingApprovalClick?.();
        }}
        className={className}
        aria-label={iconOnly ? "Pending approval — set approved by" : "Set approved by"}
        title={iconOnly ? "Pending approval" : "Set approved by"}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={className} title={iconOnly ? meta.label : undefined} aria-label={iconOnly ? meta.label : undefined}>
      {inner}
    </span>
  );
}

export function PaymentStatusDetail({
  entry,
}: {
  entry: Entry;
}) {
  if (entry.type !== "expense") return null;
  if (!entry.approvalStatus && !entry.paymentStatus) {
    if (entry.approvedBy) {
      return (
        <div className="mt-2 space-y-1 rounded-lg bg-[#F4F8FC] p-2 text-xs text-[#5A7FA5]">
          <p>Approved by: {entry.approvedBy}</p>
        </div>
      );
    }
    return null;
  }

  const meta = workflowBadgeMeta(entry);

  return (
    <div className="mt-2 space-y-1.5 rounded-xl border border-slate-200/80 bg-white p-3 text-xs text-[var(--text-muted)]">
      <p>
        <span className="font-semibold">Requested by:</span> {entry.name}
      </p>
      {entry.approvedBy && (
        <p>
          <span className="font-semibold">Approved by:</span> {entry.approvedBy}
        </p>
      )}
      {entry.paymentDueDate && entry.paymentStatus !== "paid" && (
        <p>
          <span className="font-semibold">Pay on:</span>{" "}
          {formatDateDDMMYYYY(entry.paymentDueDate)}
        </p>
      )}
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">Status:</span>
        {meta ? <PaymentStatusBadge entry={entry} /> : paymentStatusLabel(entry.paymentStatus)}
      </p>
      {entry.paymentStatus === "paid" && (
        <>
          {entry.paymentVerifiedMethod && (
            <p>
              <span className="font-semibold">Payment method:</span>{" "}
              {formatPaymentVerifiedMethod(entry.paymentVerifiedMethod)}
            </p>
          )}
          {entry.paymentDate && (
            <p>
              <span className="font-semibold">Paid on:</span>{" "}
              {formatDateDDMMYYYY(entry.paymentDate)}
            </p>
          )}
          {entry.paymentReference && (
            <p>
              <span className="font-semibold">Reference:</span> {entry.paymentReference}
            </p>
          )}
          {entry.paymentPaidTo && (
            <p>
              <span className="font-semibold">Paid to:</span> {entry.paymentPaidTo}
            </p>
          )}
          {entry.paymentVerifiedBy && (
            <p>
              <span className="font-semibold">Verified by:</span> {entry.paymentVerifiedBy}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function paymentEntryTitle(entry: Pick<Entry, "note" | "category" | "name">) {
  return requestLabel(entry);
}
