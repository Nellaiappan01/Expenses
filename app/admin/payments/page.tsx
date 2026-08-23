"use client";

import AdminShell from "@/app/components/admin/AdminShell";
import PaymentManagement from "@/app/components/admin/PaymentManagement";

export default function AdminPaymentsPage() {
  return (
    <AdminShell
      active="payments"
      title="Payment Management"
      subtitle="Approve requests, transfer & verify payments"
    >
      <PaymentManagement dashboard />
    </AdminShell>
  );
}
