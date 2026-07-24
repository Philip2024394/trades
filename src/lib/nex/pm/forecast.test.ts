// Completion forecast — honest arithmetic + confidence bands.

import { describe, it, expect, vi, beforeEach } from "vitest";

let jobRow: {
  title:              string;
  status:             string;
  scheduled_end_date: string | null;
  actual_start_date:  string | null;
  actual_end_date:    string | null;
  progress_percent:   number | null;
} | null = null;

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from() {
      const b = {
        select: () => b,
        eq:     () => b,
        order:  () => b,
        limit:  () => b,
        maybeSingle: async () => ({ data: jobRow })
      };
      return b;
    }
  }
}));

import { forecastCompletion } from "./forecast";

beforeEach(() => { jobRow = null; });

describe("forecastCompletion", () => {
  const now = new Date("2026-07-23T00:00:00Z");

  it("returns unknown when no start date", async () => {
    jobRow = { title: "Kitchen", status: "in_progress", scheduled_end_date: "2026-08-30", actual_start_date: null, actual_end_date: null, progress_percent: 40 };
    const f = await forecastCompletion({ projectId: "p1", merchantId: "m1", now });
    expect(f.confidence).toBe("unknown");
    expect(f.forecast_end).toBeNull();
  });

  it("returns unknown when progress is zero", async () => {
    jobRow = { title: "Kitchen", status: "in_progress", scheduled_end_date: "2026-08-30", actual_start_date: "2026-07-15", actual_end_date: null, progress_percent: 0 };
    const f = await forecastCompletion({ projectId: "p1", merchantId: "m1", now });
    expect(f.confidence).toBe("unknown");
  });

  it("returns high confidence + forecast when progress ≥25% and 14+ days on site", async () => {
    // 15 days on site, progress 30% → velocity 2%/day, remaining 70% ~35 days → 2026-08-27
    jobRow = { title: "Kitchen", status: "in_progress", scheduled_end_date: "2026-08-30", actual_start_date: "2026-07-08", actual_end_date: null, progress_percent: 30 };
    const f = await forecastCompletion({ projectId: "p1", merchantId: "m1", now });
    expect(f.confidence).toBe("high");
    expect(f.forecast_end).toBeTruthy();
  });

  it("returns 'medium' when progress ≥10% but <25% or <14 days", async () => {
    // 5 days on site, progress 20% (progress ≥ 10, but daysSinceStart < 14) → medium
    jobRow = { title: "Kitchen", status: "in_progress", scheduled_end_date: "2026-08-30", actual_start_date: "2026-07-18", actual_end_date: null, progress_percent: 20 };
    const f = await forecastCompletion({ projectId: "p1", merchantId: "m1", now });
    expect(f.confidence).toBe("medium");
  });

  it("returns 'low' when progress under 10%", async () => {
    jobRow = { title: "Kitchen", status: "in_progress", scheduled_end_date: "2026-08-30", actual_start_date: "2026-07-20", actual_end_date: null, progress_percent: 5 };
    const f = await forecastCompletion({ projectId: "p1", merchantId: "m1", now });
    expect(f.confidence).toBe("low");
    expect(f.forecast_end).toBeTruthy();
  });

  it("returns 'high' + forecast=actual_end_date when already complete", async () => {
    jobRow = { title: "Kitchen", status: "signed_off", scheduled_end_date: "2026-08-30", actual_start_date: "2026-07-01", actual_end_date: "2026-07-20", progress_percent: 100 };
    const f = await forecastCompletion({ projectId: "p1", merchantId: "m1", now });
    expect(f.confidence).toBe("high");
    expect(f.forecast_end).toBe("2026-07-20");
    expect(f.reason).toContain("complete");
  });

  it("reason mentions how it compares to scheduled_end", async () => {
    jobRow = { title: "Kitchen", status: "in_progress", scheduled_end_date: "2026-08-01", actual_start_date: "2026-07-08", actual_end_date: null, progress_percent: 30 };
    const f = await forecastCompletion({ projectId: "p1", merchantId: "m1", now });
    // 30% in 15 days = 2%/day. 70% left = 35 days → 2026-08-27 → 26 days later than 2026-08-01
    expect(f.reason).toContain("later than the scheduled end");
  });
});
