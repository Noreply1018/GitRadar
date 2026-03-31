export const RUNTIME_SOURCES = ["github", "local"] as const;

export type RuntimeSource = (typeof RUNTIME_SOURCES)[number];

export function normalizeRuntimeSource(
  value: string | null | undefined,
): RuntimeSource {
  return value === "local" ? "local" : "github";
}

export function isLocalRuntimeSource(source: RuntimeSource): boolean {
  return source === "local";
}

export function isGitHubRuntimeSource(source: RuntimeSource): boolean {
  return source === "github";
}
