const USER_KEY = "ledger_user_id";

export function getApiHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return { "X-User-Id": "default" };
    const { userId } = JSON.parse(stored);
    return { "X-User-Id": userId || "default" };
  } catch {
    return { "X-User-Id": "default" };
  }
}

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const apiHeaders = getApiHeaders();
  for (const [k, v] of Object.entries(apiHeaders)) {
    headers.set(k, v);
  }
  return fetch(url, { ...init, headers });
}
