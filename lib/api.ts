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

/** Parse JSON from an API response. HTML/timeout pages become a clear error instead of a JSON parse crash. */
export async function readApiJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const compact = text.replace(/\s+/g, " ").trim().slice(0, 120);
    if (/an error occurred/i.test(text) || compact.startsWith("<")) {
      throw new Error(
        "Server timed out. Refresh the list before tapping again — the data may already be saved."
      );
    }
    throw new Error(`Unexpected response: ${compact}`);
  }
}
