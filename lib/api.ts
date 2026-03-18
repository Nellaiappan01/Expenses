const USER_KEY = "ledger_user_id";

export function getApiHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return { "X-User-Id": "default" };
    const data = JSON.parse(stored);
    const headers: Record<string, string> = {};
    if (data.token) {
      headers["Authorization"] = `Bearer ${data.token}`;
    } else if (data.userId) {
      headers["X-User-Id"] = data.userId;
    } else {
      headers["X-User-Id"] = "default";
    }
    return headers;
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
