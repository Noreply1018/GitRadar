import { describe, expect, it } from "vitest";

import { getGitHubConfigFromEnv } from "../src/config/env";

describe("getGitHubConfigFromEnv", () => {
  it("supports the GitHub Actions specific token name", () => {
    const config = getGitHubConfigFromEnv({
      GITRADAR_GITHUB_TOKEN: "token-from-actions",
    });

    expect(config.token).toBe("token-from-actions");
    expect(config.apiBaseUrl).toBe("https://api.github.com");
  });
});
