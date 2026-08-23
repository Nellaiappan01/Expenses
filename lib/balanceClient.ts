const BALANCE_KEY = "ledger_balance_cache";

type BalanceCache = {
  userId: string;
  net: number;
  savedAt: number;
};

export function readBalanceCache(userId: string): number | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = sessionStorage.getItem(BALANCE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as BalanceCache;
    if (data.userId !== userId) return null;
    // Show cached value up to 24h while refreshing in background
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) return null;
    return data.net;
  } catch {
    return null;
  }
}

export function writeBalanceCache(userId: string, net: number) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const payload: BalanceCache = { userId, net, savedAt: Date.now() };
    sessionStorage.setItem(BALANCE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

export function clearBalanceCache() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(BALANCE_KEY);
  } catch {
    // ignore
  }
}
