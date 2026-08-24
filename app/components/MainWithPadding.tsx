"use client";

import { usePathname } from "next/navigation";
import { isPublicRoute } from "@/lib/publicRoutes";

export default function MainWithPadding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasHeader = pathname !== "/select-user" && !isPublicRoute(pathname);
  const isSaltHome = pathname === "/";
  const isAdminArea = pathname.startsWith("/admin");

  return (
    <main
      className={
        hasHeader && !isSaltHome && !isAdminArea
          ? "pt-[calc(4rem+env(safe-area-inset-top))]"
          : ""
      }
    >
      {children}
    </main>
  );
}
