export type EntryType = "rotation_cash" | "expense" | "worker_payment" | "adjustment";
export type PaymentMethod = "Cash" | "GPay" | "Bank";
export type SheetsSyncStatus = "synced" | "pending" | "failed";
export type EntryAuditAction = "update" | "delete";

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
  attachmentUrl?: string;
  attachmentPublicId?: string;
  tags?: string[];
}
