"use client";

import { useEffect } from "react";
import InstallPrompt from "./InstallPrompt";

export default function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <>
      {children}
      <InstallPrompt />
    </>
  );
}
