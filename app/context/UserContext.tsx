"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const USER_KEY = "ledger_user_id";

type UserContextType = {
  userId: string | null;
  userName: string | null;
  isAdmin: boolean;
  setUser: (data: { token?: string; userId: string; userName: string; isAdmin?: boolean }) => void;
  clearUser: () => void;
  fetchHeaders: () => Record<string, string>;
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setUserId(data.userId);
        setUserName(data.userName || data.userId);
        setIsAdmin(!!data.isAdmin);
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }
    setMounted(true);
  }, []);

  const setUser = useCallback((data: { token?: string; userId: string; userName: string; isAdmin?: boolean }) => {
    setUserId(data.userId);
    setUserName(data.userName || data.userId);
    setIsAdmin(!!data.isAdmin);
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        token: data.token,
        userId: data.userId,
        userName: data.userName || data.userId,
        isAdmin: !!data.isAdmin,
      })
    );
  }, []);

  const clearUser = useCallback(() => {
    setUserId(null);
    setUserName(null);
    setIsAdmin(false);
    localStorage.removeItem(USER_KEY);
  }, []);

  const fetchHeaders = useCallback((): Record<string, string> => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.token) return { Authorization: `Bearer ${data.token}` };
        if (data.userId) return { "X-User-Id": data.userId };
      } catch {}
    }
    return { "X-User-Id": "default" };
  }, []);

  const value: UserContextType = {
    userId,
    userName,
    isAdmin,
    setUser,
    clearUser,
    fetchHeaders,
  };

  return (
    <UserContext.Provider value={value}>
      {mounted ? children : null}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
