export type EntryType = "income" | "expense" | "worker_payment" | "adjustment";
export type PaymentMethod = "Cash" | "GPay";

export interface Entry {
  _id?: string;
  type: EntryType;
  name: string;
  nameLower: string;
  amount: number;
  method: PaymentMethod;
  date: string; // ISO date
  note?: string;
  businessId: string;
  createdAt: Date;
}

export interface EntryInput {
  type?: EntryType;
  name: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  note?: string;
}
