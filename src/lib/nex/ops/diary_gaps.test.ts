// Diary-gap detector — mocks supabase to control scheduled jobs.

import { describe, it, expect, vi, beforeEach } from "vitest";

let scheduledJobs: Array<{ scheduled_start_date: string; scheduled_end_date: string | null }> = [];

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from() {
      const b = {
        select: () => b,
        eq:     () => b,
        gte:    () => b,
        lte:    () => b,
        not:    () => b,
        then:   (resolve: (v: { data: unknown }) => void) => Promise.resolve().then(() => resolve({ data: scheduledJobs }))
      };
      return b;
    }
  }
}));

import { findDiaryGaps } from "./diary_gaps";

beforeEach(() => { scheduledJobs = []; });

describe("findDiaryGaps", () => {
  it("returns full window as one gap when no jobs scheduled", async () => {
    const now = new Date("2026-07-23T00:00:00Z");
    const gaps = await findDiaryGaps({ merchantId: "m1", now, windowDays: 7 });
    expect(gaps.length).toBe(1);
    expect(gaps[0].days).toBeGreaterThanOrEqual(7);
  });

  it("detects a 2+ day gap between two jobs", async () => {
    scheduledJobs = [
      { scheduled_start_date: "2026-07-23", scheduled_end_date: "2026-07-23" },
      { scheduled_start_date: "2026-07-27", scheduled_end_date: "2026-07-27" }
    ];
    const now = new Date("2026-07-23T00:00:00Z");
    const gaps = await findDiaryGaps({ merchantId: "m1", now, windowDays: 21 });
    expect(gaps.length).toBeGreaterThan(0);
    const midGap = gaps.find((g) => g.start_date === "2026-07-24");
    expect(midGap).toBeDefined();
    expect(midGap!.days).toBe(3);   // 24, 25, 26
  });

  it("ignores single-day free windows (below MIN_GAP_DAYS)", async () => {
    scheduledJobs = [
      { scheduled_start_date: "2026-07-23", scheduled_end_date: "2026-07-23" },
      { scheduled_start_date: "2026-07-25", scheduled_end_date: "2026-07-25" },  // only 24th free
      { scheduled_start_date: "2026-07-26", scheduled_end_date: "2026-07-26" }
    ];
    const now = new Date("2026-07-23T00:00:00Z");
    const gaps = await findDiaryGaps({ merchantId: "m1", now, windowDays: 4 });
    // The 24th is a 1-day gap → dropped; trailing days may be a gap.
    // Only assertion needed: no 1-day gap surfaced.
    for (const g of gaps) expect(g.days).toBeGreaterThanOrEqual(2);
  });
});
