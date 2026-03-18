"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import { useUser } from "./UserContext";

export type ConfigFeatures = {
  expenses: boolean;
  workers: boolean;
  stock: boolean;
};

type ConfigContextType = {
  config: {
    appMode: string;
    features: ConfigFeatures & { user_delete?: boolean };
  } | null;
  refresh: () => void;
};

const defaultFeatures: ConfigFeatures = {
  expenses: true,
  workers: true,
  stock: false,
};

const ConfigContext = createContext<ConfigContextType | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { userId } = useUser();
  const [config, setConfig] = useState<ConfigContextType["config"]>(null);

  const refresh = useCallback(() => {
    apiFetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setConfig({
            ...data,
            features: { ...defaultFeatures, ...data.features },
          });
        } else {
          setConfig({ appMode: "expenses", features: defaultFeatures });
        }
      })
      .catch(() => setConfig({ appMode: "expenses", features: defaultFeatures }));
  }, []);

  useEffect(() => {
    if (userId) refresh();
    else setConfig(null);
  }, [userId, refresh]);

  return (
    <ConfigContext.Provider value={{ config, refresh }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  return ctx;
}
