/**
 * Studio token storage — browser-only utilities.
 *
 * Tokens arrive via the `?studio=<token>` URL param (set by the dashboard's
 * "Edit site" button). We:
 *   1. Read it
 *   2. Store in sessionStorage (tab-scoped; clears when the tab closes)
 *   3. Strip from the URL via history.replaceState (no reload)
 *
 * Tokens never touch cookies, localStorage, or any XHR-visible storage
 * that survives the tab. That keeps the blast radius small.
 */

const STORAGE_KEY = 'hn.studio.token';
const URL_PARAM = 'studio';

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Read token from sessionStorage OR the URL param — URL wins and replaces storage. */
export function readStudioToken(): string | null {
  if (!isBrowser()) return null;

  // 1) URL param takes precedence — fresh handoff from the dashboard
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get(URL_PARAM);
  if (fromUrl) {
    try {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
    } catch {
      // ignore — sessionStorage may be disabled in private tabs
    }
    url.searchParams.delete(URL_PARAM);
    const qs = url.searchParams.toString();
    const newUrl = url.pathname + (qs ? `?${qs}` : '') + url.hash;
    window.history.replaceState(window.history.state, '', newUrl);
    return fromUrl;
  }

  // 2) Fall back to sessionStorage
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeStudioToken(token: string): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

export function clearStudioToken(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
