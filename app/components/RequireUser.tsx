"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isPublicRoute } from "@/lib/publicRoutes";

const USER_KEY = "ledger_user_id";

export default function RequireUser({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/select-user" || isPublicRoute(pathname)) {
      setChecked(true);
      return;
    }
    try {
      const stored = localStorage.getItem(USER_KEY);
      if (!stored) {
        router.replace("/select-user");
        return;
      }
      JSON.parse(stored);
    } catch {
      router.replace("/select-user");
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (pathname === "/select-user" || isPublicRoute(pathname)) {
    return <>{children}</>;
  }
  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}
