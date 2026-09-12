// src/lib/nex-agent/day-labels.test.ts

import { describe, it, expect } from "vitest";
import { dayLabel, isStale, dayBucket } from "./day-labels";

const DAY = 24 * 60 * 60 * 1000;

describe("dayLabel", () => {
  const NOW = new Date("2026-09-11T12:00:00Z").getTime();

  it("today", () => {
    expect(dayLabel(new Date(NOW).toISOString(), NOW)).toBe("Today");
    expect(dayLabel(new Date(NOW - 3 * 60 * 60 * 1000).toISOString(), NOW)).toBe("Today");
  });

  it("yesterday", () => {
    expect(dayLabel(new Date(NOW - 1 * DAY - 3 * 60 * 60 * 1000).toISOString(), NOW)).toBe("Yesterday");
  });

  it("2-6 days ago", () => {
    expect(dayLabel(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe("3 days ago");
    expect(dayLabel(new Date(NOW - 6 * DAY).toISOString(), NOW)).toBe("6 days ago");
  });

  it("last week (7-13d)", () => {
    expect(dayLabel(new Date(NOW - 8 * DAY).toISOString(), NOW)).toBe("Last week");
  });

  it("weeks ago (14-29d)", () => {
    expect(dayLabel(new Date(NOW - 15 * DAY).toISOString(), NOW)).toBe("2 weeks ago");
  });

  it("older (30d+)", () => {
    expect(dayLabel(new Date(NOW - 60 * DAY).toISOString(), NOW)).toBe("Older");
  });

  it("invalid ISO returns dash", () => {
    expect(dayLabel("not-a-date")).toBe("—");
  });
});

describe("isStale · 7-day threshold", () => {
  const NOW = new Date("2026-09-11T12:00:00Z").getTime();

  it("today is fresh", () => {
    expect(isStale(new Date(NOW).toISOString(), NOW)).toBe(false);
  });

  it("6 days ago is fresh", () => {
    expect(isStale(new Date(NOW - 6 * DAY).toISOString(), NOW)).toBe(false);
  });

  it("8 days ago is stale", () => {
    expect(isStale(new Date(NOW - 8 * DAY).toISOString(), NOW)).toBe(true);
  });

  it("custom threshold", () => {
    expect(isStale(new Date(NOW - 3 * DAY).toISOString(), NOW, 2)).toBe(true);
    expect(isStale(new Date(NOW - 1 * DAY).toISOString(), NOW, 2)).toBe(false);
  });
});

describe("dayBucket", () => {
  const NOW = new Date("2026-09-11T12:00:00Z").getTime();
  it("today", () => expect(dayBucket(new Date(NOW).toISOString(), NOW)).toBe("today"));
  it("yesterday", () => expect(dayBucket(new Date(NOW - 1 * DAY).toISOString(), NOW)).toBe("yesterday"));
  it("3d ago = recent", () => expect(dayBucket(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe("recent"));
  it("10d ago = week+", () => expect(dayBucket(new Date(NOW - 10 * DAY).toISOString(), NOW)).toBe("week+"));
  it("60d ago = older", () => expect(dayBucket(new Date(NOW - 60 * DAY).toISOString(), NOW)).toBe("older"));
});
