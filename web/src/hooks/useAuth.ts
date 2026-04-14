import { useCallback, useSyncExternalStore } from "react";

interface AuthState {
  token: string;
  owner: string;
  repo: string;
}

const STORAGE_KEYS = {
  token: "gitradar_pat",
  owner: "gitradar_owner",
  repo: "gitradar_repo",
} as const;

function getSnapshot(): AuthState | null {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const owner = localStorage.getItem(STORAGE_KEYS.owner);
  const repo = localStorage.getItem(STORAGE_KEYS.repo);

  if (!token || !owner || !repo) {
    return null;
  }

  return { token, owner, repo };
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useAuth() {
  const auth = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const login = useCallback(
    (token: string, owner: string, repo: string) => {
      localStorage.setItem(STORAGE_KEYS.token, token);
      localStorage.setItem(STORAGE_KEYS.owner, owner);
      localStorage.setItem(STORAGE_KEYS.repo, repo);
      window.dispatchEvent(new Event("storage"));
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.owner);
    localStorage.removeItem(STORAGE_KEYS.repo);
    window.dispatchEvent(new Event("storage"));
  }, []);

  return { auth, login, logout };
}
