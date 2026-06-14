"use client";

import { createContext, useContext } from "react";

const PublicStockUserContext = createContext<string | undefined>(undefined);

export function PublicStockUserProvider({
  publicUser,
  children,
}: {
  publicUser?: string;
  children: React.ReactNode;
}) {
  return (
    <PublicStockUserContext.Provider value={publicUser}>
      {children}
    </PublicStockUserContext.Provider>
  );
}

export function usePublicStockUser() {
  return useContext(PublicStockUserContext);
}
