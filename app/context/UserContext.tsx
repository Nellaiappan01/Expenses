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

function readStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as {
      userId?: string;
      userName?: string;
      username?: string;
      isAdmin?: boolean;
    };
  } catch {
    return null;
  }
}

type UserContextType = {
  userId: string | null;
  userName: string | null;
  username: string | null;
  isAdmin: boolean;
  setUser: (data: {
    token?: string;
    userId: string;
    userName: string;
    username?: string;
    isAdmin?: boolean;
  }) => void;
  clearUser: () => void;
  fetchHeaders: () => Record<string, string>;
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const stored = readStoredUser();
  const [userId, setUserId] = useState<string | null>(stored?.userId ?? null);
  const [userName, setUserName] = useState<string | null>(
    stored?.userName || stored?.userId || null
  );
  const [username, setUsername] = useState<string | null>(
    stored?.username || stored?.userId || null
  );
  const [isAdmin, setIsAdmin] = useState(!!stored?.isAdmin);

  useEffect(() => {
    const data = readStoredUser();
    if (!data) return;
    setUserId(data.userId ?? null);
    setUserName(data.userName || data.userId || null);
    setUsername(data.username || data.userId || null);
    setIsAdmin(!!data.isAdmin);
  }, []);

  const setUser = useCallback((data: {
    token?: string;
    userId: string;
    userName: string;
    username?: string;
    isAdmin?: boolean;
  }) => {
    setUserId(data.userId);
    setUserName(data.userName || data.userId);
    setUsername((data.username || data.userId).toLowerCase());
    setIsAdmin(!!data.isAdmin);
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        token: data.token,
        userId: data.userId,
        userName: data.userName || data.userId,
        username: (data.username || data.userId).toLowerCase(),
        isAdmin: !!data.isAdmin,
      })
    );
  }, []);

  const clearUser = useCallback(() => {
    setUserId(null);
    setUserName(null);
    setUsername(null);
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
    username,
    isAdmin,
    setUser,
    clearUser,
    fetchHeaders,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
