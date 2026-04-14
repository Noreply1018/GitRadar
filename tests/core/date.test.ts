import { describe, expect, it } from "vitest";
import {
  getCurrentDigestDate,
  getIsoTimestamp,
  getDateDaysAgo,
  getDaysSince,
} from "../../src/core/date";

describe("getCurrentDigestDate", () => {
  it("returns a YYYY-MM-DD string", () => {
    const result = getCurrentDigestDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getIsoTimestamp", () => {
  it("returns an ISO 8601 string", () => {
    const result = getIsoTimestamp();
    expect(() => new Date(result).toISOString()).not.toThrow();
  });
});

describe("getDateDaysAgo", () => {
  it("returns a YYYY-MM-DD string for a given number of days ago", () => {
    const result = getDateDaysAgo(7);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns today (UTC) when days is 0", () => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    expect(getDateDaysAgo(0)).toBe(todayUtc);
  });
});

describe("getDaysSince", () => {
  it("returns 0 for today", () => {
    const today = new Date().toISOString();
    expect(getDaysSince(today)).toBe(0);
  });

  it("returns positive number for past dates", () => {
    const pastDate = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(getDaysSince(pastDate)).toBeGreaterThanOrEqual(2);
    expect(getDaysSince(pastDate)).toBeLessThanOrEqual(4);
  });
});
