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
  setUser: (userId: string, userName: string) => void;
  clearUser: () => void;
  fetchHeaders: () => Record<string, string>;
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        const { userId: id, userName: name } = JSON.parse(stored);
        setUserId(id);
        setUserName(name || id);
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }
    setMounted(true);
  }, []);

  const setUser = useCallback((id: string, name: string) => {
    setUserId(id);
    setUserName(name || id);
    localStorage.setItem(USER_KEY, JSON.stringify({ userId: id, userName: name || id }));
  }, []);

  const clearUser = useCallback(() => {
    setUserId(null);
    setUserName(null);
    localStorage.removeItem(USER_KEY);
  }, []);

  const fetchHeaders = useCallback((): Record<string, string> => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        const { userId: id } = JSON.parse(stored);
        return id ? { "X-User-Id": id } : { "X-User-Id": "default" };
      } catch {}
    }
    return { "X-User-Id": "default" };
  }, []);

  const value: UserContextType = {
    userId,
    userName,
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
