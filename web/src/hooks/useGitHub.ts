import { useMemo } from "react";
import { GitHubClient } from "../api/github";
import { useAuth } from "./useAuth";

export function useGitHub(): GitHubClient | null {
  const { auth } = useAuth();

  return useMemo(() => {
    if (!auth) return null;
    return new GitHubClient(auth.token, auth.owner, auth.repo);
  }, [auth]);
}
