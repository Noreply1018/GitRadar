import { describe, expect, it } from "vitest";

import { getGitHubConfigFromEnv, getLlmConfigFromEnv } from "../src/config/env";

describe("getGitHubConfigFromEnv", () => {
  it("supports the GitHub Actions specific token name", () => {
    const config = getGitHubConfigFromEnv({
      GITRADAR_GITHUB_TOKEN: "token-from-actions",
    });

    expect(config.token).toBe("token-from-actions");
    expect(config.apiBaseUrl).toBe("https://api.github.com");
  });
});

describe("getLlmConfigFromEnv", () => {
  it("normalizes and returns the current llm settings", () => {
    const config = getLlmConfigFromEnv({
      GR_API_KEY: "test-api-key",
      GR_BASE_URL: "https://example.com/v1/",
      GR_MODEL: "gpt-test",
    });

    expect(config).toEqual({
      apiKey: "test-api-key",
      baseUrl: "https://example.com/v1",
      model: "gpt-test",
    });
  });
});
