"use client";

import { usePathname } from "next/navigation";

export default function MainWithPadding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasHeader = pathname !== "/select-user";

  return (
    <main
      className={hasHeader ? "pt-[calc(4rem+env(safe-area-inset-top))]" : ""}
    >
      {children}
    </main>
  );
}
