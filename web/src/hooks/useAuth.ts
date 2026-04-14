import { useCallback, useSyncExternalStore } from "react";

interface AuthState {
  session: string;
  owner: string;
  repo: string;
}

const STORAGE_KEY = "gitradar_session";

// Legacy keys to clean up
const LEGACY_KEYS = ["gitradar_pat", "gitradar_owner", "gitradar_repo"];

function cleanLegacyStorage(): void {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

function decodeJwtPayload(token: string): { owner: string; repo: string; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

function getSnapshot(): AuthState | null {
  const session = localStorage.getItem(STORAGE_KEY);
  if (!session) return null;

  const payload = decodeJwtPayload(session);
  if (!payload) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  // Check expiration
  if (payload.exp * 1000 < Date.now()) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  return { session, owner: payload.owner, repo: payload.repo };
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useAuth() {
  const auth = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const login = useCallback((session: string) => {
    cleanLegacyStorage();
    localStorage.setItem(STORAGE_KEY, session);
    window.dispatchEvent(new Event("storage"));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("storage"));
  }, []);

  return { auth, login, logout };
}
