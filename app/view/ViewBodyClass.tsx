"use client";

import { useEffect } from "react";

export function ViewBodyClass() {
  useEffect(() => {
    document.body.classList.add("public-view-page");
    return () => document.body.classList.remove("public-view-page");
  }, []);
  return null;
}
