import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DIGEST_RULES_CONFIG } from "../src/config/digest-rules";
import {
  buildDigestRulesSummary,
  parseValidateDigestRulesArgs,
  renderDigestRulesSummary,
} from "../src/commands/validate-digest-rules";

describe("parseValidateDigestRulesArgs", () => {
  it("uses text output by default", () => {
    expect(parseValidateDigestRulesArgs([])).toEqual({
      configPath: undefined,
      format: "text",
    });
  });

  it("supports custom path and json output", () => {
    expect(
      parseValidateDigestRulesArgs([
        "--path",
        "config/digest-rules.json",
        "--format",
        "json",
      ]),
    ).toEqual({
      configPath: "config/digest-rules.json",
      format: "json",
    });
  });

  it("rejects unsupported args", () => {
    expect(() => parseValidateDigestRulesArgs(["--unknown"])).toThrow(
      /Unsupported argument: --unknown/,
    );
  });
});

describe("renderDigestRulesSummary", () => {
  it("renders a readable validation summary", () => {
    const summary = buildDigestRulesSummary(
      DIGEST_RULES_CONFIG,
      path.join(os.tmpdir(), "digest-rules.json"),
    );
    const rendered = renderDigestRulesSummary(summary);

    expect(rendered).toContain("GitRadar digest rules config is valid.");
    expect(rendered).toContain(`Rules version: ${DIGEST_RULES_CONFIG.version}`);
    expect(rendered).toContain(`Themes: ${DIGEST_RULES_CONFIG.themes.length}`);
  });
});
