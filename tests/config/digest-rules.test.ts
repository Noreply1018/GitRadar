import { describe, expect, it } from "vitest";
import {
  DIGEST_RULES_CONFIG,
  DIGEST_DESCRIPTION_BLACKLIST,
  DIGEST_TOPIC_BLACKLIST,
  loadDigestRulesConfig,
  getDefaultDigestRulesConfigPath,
} from "../../src/config/digest-rules";

describe("DIGEST_RULES_CONFIG", () => {
  it("loads the default config successfully", () => {
    expect(DIGEST_RULES_CONFIG).toBeDefined();
    expect(DIGEST_RULES_CONFIG.version).toBeTruthy();
  });

  it("has at least one theme defined", () => {
    expect(DIGEST_RULES_CONFIG.themes.length).toBeGreaterThan(0);
  });

  it("has valid score buckets", () => {
    for (const bucket of DIGEST_RULES_CONFIG.thresholds.recentPushMomentum) {
      expect(bucket.maxDays).toBeGreaterThan(0);
      expect(bucket.score).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("DIGEST_DESCRIPTION_BLACKLIST", () => {
  it("is a RegExp pattern", () => {
    expect(DIGEST_DESCRIPTION_BLACKLIST).toBeInstanceOf(RegExp);
  });
});

describe("DIGEST_TOPIC_BLACKLIST", () => {
  it("is a Set", () => {
    expect(DIGEST_TOPIC_BLACKLIST).toBeInstanceOf(Set);
  });
});

describe("loadDigestRulesConfig", () => {
  it("loads from default path without error", () => {
    const config = loadDigestRulesConfig(getDefaultDigestRulesConfigPath());
    expect(config.version).toBeTruthy();
    expect(config.themes.length).toBeGreaterThan(0);
  });

  it("throws on non-existent path", () => {
    expect(() => loadDigestRulesConfig("/nonexistent/path.json")).toThrow();
  });
});
