import type { Metadata } from "next";
import { PublicStockView } from "./components/PublicStockView";

export const metadata: Metadata = {
  title: "Stock View",
  description: "Real-time tyre stock status",
};

export default function PublicStockPage() {
  return <PublicStockView />;
}
