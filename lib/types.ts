export type EntryType = "rotation_cash" | "expense" | "worker_payment" | "adjustment";
export type PaymentMethod = "Cash" | "GPay" | "Bank";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "pending" | "paid";
export type PaymentVerifiedMethod = "Cash" | "Bank Transfer" | "GPay / UPI";
export type ExpensePersonPreferredMethod = "cash" | "gpay" | "bank";

export interface ExpensePerson {
  name: string;
  nameLower: string;
  preferredMethod?: ExpensePersonPreferredMethod;
  cashOk?: boolean;
  upiId?: string;
  bankAccount?: string;
  ifsc?: string;
  accountHolder?: string;
}
export type SheetsSyncStatus = "synced" | "pending" | "failed";
export type EntryAuditAction = "update" | "delete" | "approve" | "payment_verified";

export interface Entry {
  _id?: string;
  type: EntryType;
  name: string;
  nameLower: string;
  amount: number;
  method: PaymentMethod;
  date: string; // ISO date
  category?: string;
  note?: string;
  bankName?: string;
  sender?: string;
  approvedBy?: string;
  approvedByLower?: string;
  approvalStatus?: ApprovalStatus;
  approvedAt?: Date;
  /** Date user plans to pay (set when approving on site). */
  paymentDueDate?: string;
  paymentStatus?: PaymentStatus;
  paymentVerifiedMethod?: PaymentVerifiedMethod;
  paymentDate?: string;
  paymentReference?: string;
  paymentPaidTo?: string;
  paymentVerifiedBy?: string;
  paymentVerifiedAt?: Date;
  paymentNote?: string;
  attachmentUrl?: string;
  attachmentPublicId?: string;
  tags?: string[];
  businessId: string;
  createdAt: Date;
  sheetsSyncStatus?: SheetsSyncStatus;
  sheetsSyncError?: string;
  sheetsSyncedAt?: Date;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  isEdited?: boolean;
  editedAt?: Date;
  editedBy?: string;
  /** Capital / one-off — excluded from profitability expense totals. */
  excludeFromProfitability?: boolean;
}

export interface EntryAuditLog {
  _id?: string;
  entryId: string;
  businessId: string;
  action: EntryAuditAction;
  field: string;
  originalValue: unknown;
  newValue: unknown;
  editedBy: string;
  editedAt: Date;
  reason: string;
}

export interface EntryInput {
  type?: EntryType;
  name: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  category?: string;
  note?: string;
  bankName?: string;
  sender?: string;
  approvedBy?: string;
  paymentDueDate?: string;
  attachmentUrl?: string;
  attachmentPublicId?: string;
  tags?: string[];
  excludeFromProfitability?: boolean;
}
