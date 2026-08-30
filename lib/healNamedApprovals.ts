import type { Db } from "mongodb";

/**
 * Sheet "Payment Pending" rows often have Approved by filled while Mongo still
 * has approvalStatus: pending — so Track "To pay" was empty. Promote those.
 */
export async function healNamedApprovals(db: Db, businessId?: string) {
  const filter: Record<string, unknown> = {
    type: "expense",
    deleted: { $ne: true },
    paymentStatus: { $ne: "paid" },
    approvalStatus: { $ne: "rejected" },
    approvedBy: { $gt: "" },
    $or: [
      { approvalStatus: "pending" },
      { approvalStatus: { $exists: false } },
      { paymentStatus: { $exists: false } },
      { paymentStatus: null },
      { paymentStatus: "" },
    ],
  };
  if (businessId) filter.businessId = businessId;
  await db.collection("entries").updateMany(filter, {
    $set: { approvalStatus: "approved", paymentStatus: "pending" },
  });
}
