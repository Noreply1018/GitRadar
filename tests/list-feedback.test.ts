import { describe, expect, it } from "vitest";

import {
  parseListFeedbackArgs,
  renderFeedbackList,
} from "../src/commands/list-feedback";
import { filterFeedbackEvents } from "../src/feedback/store";
import type { FeedbackEvent } from "../src/feedback/model";

const SAMPLE_EVENTS: FeedbackEvent[] = [
  {
    repo: "owner/alpha-agent",
    date: "2026-03-30",
    action: "saved",
    theme: "AI Agents",
    recordedAt: "2026-03-30T10:00:00.000Z",
  },
  {
    repo: "owner/ui-lab",
    date: "2026-03-29",
    action: "later",
    theme: "Frontend & Design",
    recordedAt: "2026-03-30T09:00:00.000Z",
  },
  {
    repo: "owner/old-runtime",
    date: "2026-03-28",
    action: "skipped",
    theme: "Infra & Runtime",
    recordedAt: "2026-03-29T08:00:00.000Z",
  },
];

describe("parseListFeedbackArgs", () => {
  it("defaults to text output and a recent limit", () => {
    expect(parseListFeedbackArgs([])).toEqual({
      format: "text",
      limit: 20,
      action: undefined,
      theme: undefined,
      repo: undefined,
    });
  });

  it("parses filters and json output", () => {
    expect(
      parseListFeedbackArgs([
        "--action",
        "saved",
        "--theme",
        "AI Agents",
        "--repo",
        "owner/alpha-agent",
        "--limit",
        "5",
        "--format",
        "json",
      ]),
    ).toEqual({
      action: "saved",
      theme: "AI Agents",
      repo: "owner/alpha-agent",
      limit: 5,
      format: "json",
    });
  });

  it("rejects invalid action values", () => {
    expect(() => parseListFeedbackArgs(["--action", "keep"])).toThrow(
      "Invalid --action value. Use saved, later, or skipped.",
    );
  });

  it("rejects invalid format values", () => {
    expect(() => parseListFeedbackArgs(["--format", "table"])).toThrow(
      "Invalid --format value. Use text or json.",
    );
  });

  it("rejects invalid limit values", () => {
    expect(() => parseListFeedbackArgs(["--limit", "0"])).toThrow(
      "Invalid --limit value. Use a positive integer.",
    );
  });
});

describe("filterFeedbackEvents", () => {
  it("filters by action and sorts by recordedAt descending", () => {
    expect(filterFeedbackEvents(SAMPLE_EVENTS, { action: "saved" })).toEqual([
      SAMPLE_EVENTS[0],
    ]);
  });

  it("filters by theme and repo case-insensitively", () => {
    expect(
      filterFeedbackEvents(SAMPLE_EVENTS, {
        theme: "frontend & design",
        repo: "OWNER/UI-LAB",
      }),
    ).toEqual([SAMPLE_EVENTS[1]]);
  });

  it("applies limit after sorting", () => {
    expect(filterFeedbackEvents(SAMPLE_EVENTS, { limit: 2 })).toEqual([
      SAMPLE_EVENTS[0],
      SAMPLE_EVENTS[1],
    ]);
  });

  it("rejects invalid limits in query helpers", () => {
    expect(() => filterFeedbackEvents(SAMPLE_EVENTS, { limit: 0 })).toThrow(
      "feedback limit 必须是正整数。",
    );
  });
});

describe("renderFeedbackList", () => {
  it("renders a readable feedback list", () => {
    const output = renderFeedbackList([SAMPLE_EVENTS[0], SAMPLE_EVENTS[1]], {
      action: undefined,
      theme: undefined,
      repo: undefined,
      limit: 20,
    });

    expect(output).toContain("# GitRadar Feedback");
    expect(output).toContain("总记录数：2");
    expect(output).toContain("[收藏] owner/alpha-agent [AI Agents]");
    expect(output).toContain("[稍后看] owner/ui-lab [Frontend & Design]");
  });

  it("renders an empty-state message", () => {
    const output = renderFeedbackList([], {
      action: "saved",
      theme: undefined,
      repo: undefined,
      limit: 20,
    });

    expect(output).toContain("动作筛选：收藏");
    expect(output).toContain("没有匹配的反馈记录。");
  });
});
