// Delivery planner — lead-time derivation + suggestion arithmetic.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase — return controllable cost rows for the history query.
let costRows: Array<{ created_at: string; due_at: string | null }> = [];
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from() {
      const builder = {
        select: () => builder,
        eq:     () => builder,
        not:    () => builder,
        order:  () => builder,
        limit:  () => Promise.resolve({ data: costRows })
      };
      return builder;
    }
  }
}));

import { suggestDelivery } from "./delivery_planner";

beforeEach(() => { costRows = []; });

describe("suggestDelivery", () => {
  const need = new Date("2026-08-15T00:00:00Z");
  const now  = new Date("2026-07-23T00:00:00Z");

  it("falls back to 3-day engine default when history is thin", async () => {
    costRows = [{ created_at: "2026-07-01T00:00:00Z", due_at: "2026-07-05T00:00:00Z" }];
    const s = await suggestDelivery({ merchantListingId: "m1", supplierName: "Jewson", materialHint: "plasterboard", needBy: need, now });
    expect(s.lead_time_source).toBe("engine_default");
    expect(s.lead_time_days).toBe(3);
    expect(s.reason.toLowerCase()).toContain("engine default");
  });

  it("uses history median when 3+ rows available", async () => {
    costRows = [
      { created_at: "2026-06-01T00:00:00Z", due_at: "2026-06-06T00:00:00Z" },   // 5 days
      { created_at: "2026-06-10T00:00:00Z", due_at: "2026-06-17T00:00:00Z" },   // 7 days
      { created_at: "2026-06-20T00:00:00Z", due_at: "2026-06-24T00:00:00Z" }    // 4 days
    ];
    const s = await suggestDelivery({ merchantListingId: "m1", supplierName: "Jewson", materialHint: "plasterboard", needBy: need, now });
    expect(s.lead_time_source).toBe("history_median");
    expect(s.lead_time_days).toBe(5);   // median of [4,5,7]
  });

  it("target delivery = need-by minus 1 day; order-by = target minus lead-time", async () => {
    costRows = [
      { created_at: "2026-06-01T00:00:00Z", due_at: "2026-06-06T00:00:00Z" },
      { created_at: "2026-06-10T00:00:00Z", due_at: "2026-06-15T00:00:00Z" },
      { created_at: "2026-06-20T00:00:00Z", due_at: "2026-06-25T00:00:00Z" }
    ];
    const s = await suggestDelivery({ merchantListingId: "m1", supplierName: "Jewson", materialHint: "boards", needBy: need, now });
    expect(s.target_delivery).toBe("2026-08-14");
    // 5 days before 2026-08-14 = 2026-08-09
    expect(s.suggested_order_by).toBe("2026-08-09");
  });

  it("filters implausible lead-times (< 0 or > 60 days)", async () => {
    costRows = [
      { created_at: "2026-06-01T00:00:00Z", due_at: "2026-06-01T00:00:00Z" },   // 0
      { created_at: "2026-06-01T00:00:00Z", due_at: "2026-09-01T00:00:00Z" },   // 92 days — filtered
      { created_at: "2026-06-05T00:00:00Z", due_at: "2026-06-15T00:00:00Z" },   // 10
      { created_at: "2026-06-10T00:00:00Z", due_at: "2026-06-14T00:00:00Z" }    // 4
    ];
    const s = await suggestDelivery({ merchantListingId: "m1", supplierName: "Jewson", materialHint: "x", needBy: need, now });
    // Filtered set = [0, 10, 4] sorted = [0, 4, 10] → median 4
    expect(s.lead_time_days).toBe(4);
  });
});
