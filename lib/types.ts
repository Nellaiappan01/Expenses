export type EntryType = "rotation_cash" | "expense" | "worker_payment" | "adjustment";
export type PaymentMethod = "Cash" | "GPay" | "Bank";
export type SheetsSyncStatus = "synced" | "pending" | "failed";

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
  businessId: string;
  createdAt: Date;
  sheetsSyncStatus?: SheetsSyncStatus;
  sheetsSyncError?: string;
  sheetsSyncedAt?: Date;
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
}
