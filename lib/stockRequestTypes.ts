export type StockRequestStatus = "pending" | "approved" | "rejected";

export type StockRequest = {
  _id: string;
  stockId: string;
  businessId: string;
  qty: number;
  customerName: string;
  customerPhone?: string;
  note?: string;
  /** Set when approved or rejected */
  resolutionNote?: string;
  status: StockRequestStatus;
  createdAt: string;
  resolvedAt?: string;
  name?: string;
  godownCount?: number;
  hasPhoto?: boolean;
  photoThumbUrl?: string;
  photoUrl?: string;
  brand?: string;
  size?: string;
};
