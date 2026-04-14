import { describe, expect, it } from "vitest";
import { maskWebhookUrl } from "../../src/config/mask";

describe("maskWebhookUrl", () => {
  it("masks query string for valid URLs", () => {
    const result = maskWebhookUrl(
      "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc123",
    );
    expect(result).toBe(
      "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?***",
    );
  });

  it("returns full URL when no query or hash", () => {
    const result = maskWebhookUrl("https://example.com/webhook");
    expect(result).toBe("https://example.com/webhook");
  });

  it("returns masked placeholder for non-URL strings", () => {
    const result = maskWebhookUrl("not-a-url-but-long-enough");
    expect(result).toBe("[masked webhook]");
  });

  it("returns masked placeholder for short non-URL strings", () => {
    const result = maskWebhookUrl("short");
    expect(result).toBe("[masked webhook]");
  });
});
