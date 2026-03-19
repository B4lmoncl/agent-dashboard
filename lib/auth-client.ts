/**
 * Frontend Auth Client — manages JWT tokens, refresh, and auth headers.
 *
 * Access token stored in memory (not localStorage — more secure).
 * Refresh token stored as httpOnly cookie by the server.
 * API key kept in localStorage as fallback for backward compat.
 */

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAuth() {
  accessToken = null;
  try { localStorage.removeItem("dash_api_key"); } catch { /* private browsing */ }
  try { localStorage.removeItem("dash_player_name"); } catch { /* private browsing */ }
}

/**
 * Attempt to refresh the access token using the httpOnly refresh cookie.
 * Returns the new access token or null if refresh failed.
 */
async function doRefresh(): Promise<string | null> {
  try {
    const r = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (data.accessToken) {
      accessToken = data.accessToken;
      return data.accessToken;
    }
  } catch { /* network error */ }
  return null;
}

/**
 * Get a valid access token, refreshing if needed.
 * Deduplicates concurrent refresh calls.
 */
export async function getValidToken(): Promise<string | null> {
  if (accessToken) return accessToken;

  // Try refresh (deduplicated)
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

/**
 * Build auth headers for API calls.
 * Uses JWT Bearer token if available, falls back to API key from localStorage.
 */
export function getAuthHeaders(apiKeyFallback?: string): Record<string, string> {
  if (accessToken) {
    return { "Authorization": `Bearer ${accessToken}` };
  }
  // Fallback: legacy API key
  const key = apiKeyFallback || localStorage.getItem("dash_api_key") || "";
  if (key) {
    return { "x-api-key": key };
  }
  return {};
}

/**
 * Wrapper for fetch that auto-attaches auth headers and retries on 401 (token refresh).
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);

  // Attach auth
  const authHeaders = getAuthHeaders();
  for (const [k, v] of Object.entries(authHeaders)) {
    if (!headers.has(k)) headers.set(k, v);
  }

  const r = await fetch(url, { ...options, headers, credentials: "include" });

  // If 401, try refresh and retry once
  if (r.status === 401 && accessToken) {
    const newToken = await doRefresh();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      headers.delete("x-api-key");
      return fetch(url, { ...options, headers, credentials: "include" });
    }
  }

  return r;
}
