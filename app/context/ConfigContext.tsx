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
  profitability?: boolean;
};

export type UserBranding = {
  appName: string;
  appShortName: string;
  bannerUrl: string;
};

export type UserIntegrations = {
  googleSheetUrl: string;
  appsScriptWebhookUrl: string;
  googleDriveFolderUrl?: string;
  hasAppsScriptWebhook?: boolean;
  hasGoogleDriveFolder?: boolean;
};

type ConfigContextType = {
  config: {
    appMode: string;
    features: ConfigFeatures & { user_delete?: boolean };
    branding?: UserBranding;
    integrations?: UserIntegrations;
  } | null;
  refresh: () => void;
};

const defaultFeatures: ConfigFeatures = {
  expenses: true,
  workers: true,
  stock: false,
  profitability: false,
};

const ConfigContext = createContext<ConfigContextType | null>(null);

const CONFIG_CACHE_KEY = "ledger_config_cache";

function readConfigCache(userId: string): ConfigContextType["config"] | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = sessionStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId: string; config: ConfigContextType["config"] };
    if (parsed.userId !== userId) return null;
    return parsed.config;
  } catch {
    return null;
  }
}

function writeConfigCache(userId: string, config: ConfigContextType["config"]) {
  if (typeof window === "undefined" || !userId || !config) return;
  try {
    sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ userId, config }));
  } catch {
    // ignore
  }
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { userId } = useUser();
  const [config, setConfig] = useState<ConfigContextType["config"]>(null);

  const refresh = useCallback(() => {
    apiFetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          const next = {
            ...data,
            features: { ...defaultFeatures, ...data.features },
          };
          setConfig(next);
          if (userId) writeConfigCache(userId, next);
        } else {
          const fallback = { appMode: "expenses", features: defaultFeatures };
          setConfig(fallback);
          if (userId) writeConfigCache(userId, fallback);
        }
      })
      .catch(() => {
        const fallback = { appMode: "expenses", features: defaultFeatures };
        setConfig((prev) => prev ?? fallback);
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setConfig(null);
      return;
    }
    setConfig(readConfigCache(userId));
    refresh();
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
