import { describe, expect, it } from "vitest";
import {
  parseValidateDigestRulesArgs,
  buildDigestRulesSummary,
  renderDigestRulesSummary,
} from "../../src/commands/validate-digest-rules";
import {
  loadDigestRulesConfig,
  getDefaultDigestRulesConfigPath,
} from "../../src/config/digest-rules";

describe("parseValidateDigestRulesArgs", () => {
  it("defaults to text format with no args", () => {
    const result = parseValidateDigestRulesArgs([]);
    expect(result.format).toBe("text");
  });

  it("accepts --format json", () => {
    const result = parseValidateDigestRulesArgs(["--format", "json"]);
    expect(result.format).toBe("json");
  });

  it("throws on unsupported argument", () => {
    expect(() => parseValidateDigestRulesArgs(["--unknown"])).toThrow();
  });
});

describe("buildDigestRulesSummary", () => {
  const configPath = getDefaultDigestRulesConfigPath();
  const config = loadDigestRulesConfig(configPath);

  it("returns a summary with theme count", () => {
    const summary = buildDigestRulesSummary(config, configPath);
    expect(summary.themeCount).toBeGreaterThan(0);
  });

  it("includes blacklist sizes", () => {
    const summary = buildDigestRulesSummary(config, configPath);
    expect(summary.descriptionBlacklistCount).toBeGreaterThanOrEqual(0);
    expect(summary.topicBlacklistCount).toBeGreaterThanOrEqual(0);
  });
});

describe("renderDigestRulesSummary", () => {
  it("renders a non-empty text summary", () => {
    const configPath = getDefaultDigestRulesConfigPath();
    const config = loadDigestRulesConfig(configPath);
    const summary = buildDigestRulesSummary(config, configPath);
    const text = renderDigestRulesSummary(summary);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("Themes");
  });
});
