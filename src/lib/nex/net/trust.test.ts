// Trust profile signals — mock supabase, verify signal math.

import { describe, it, expect, vi, beforeEach } from "vitest";

type FakeQuery = {
  select: () => FakeQuery;
  eq:     () => FakeQuery;
  maybeSingle: () => Promise<{ data: unknown }>;
  then?:  (r: (v: { data: unknown; count?: number | null }) => void) => Promise<void>;
};

let listingRow: { id: string; display_name: string; created_at: string } | null = null;
let reviewRows: Array<{ overall_score: number; owner_response_body: string | null }> = [];
let completionsCount: number | null = null;

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from(table: string) {
      const q: FakeQuery = {
        select() { return q; },
        eq()     { return q; },
        async maybeSingle() {
          if (table === "hammerex_trade_off_listings") return { data: listingRow };
          return { data: null };
        }
      };
      // Support `await q` for the reviews/completions queries.
      (q as unknown as { then: (r: (v: { data: unknown; count?: number | null }) => void) => Promise<void> }).then = async (r) => {
        if (table === "hammerex_network_reviews")   r({ data: reviewRows });
        else if (table === "hammerex_sitebook_members") r({ data: [], count: completionsCount });
        else r({ data: [] });
      };
      return q;
    }
  }
}));

import { bandFor, buildTrustProfile } from "./trust";

beforeEach(() => {
  listingRow = { id: "L1", display_name: "Phil Plumbing", created_at: "2024-07-23T00:00:00Z" };
  reviewRows = [];
  completionsCount = null;
});

describe("buildTrustProfile", () => {
  const now = new Date("2026-07-23T00:00:00Z");

  it("no data at all → overall 0, critical band, null signals", async () => {
    listingRow = null;
    const t = await buildTrustProfile({ merchantSlug: "phil", now });
    expect(t.overall_score).toBe(0);
    expect(t.band).toBe("critical");
    expect(t.signals.reviews.score).toBeNull();
  });

  it("healthy reviews + completions → high overall", async () => {
    reviewRows = Array.from({ length: 20 }, () => ({ overall_score: 4.8, owner_response_body: "thanks" }));
    completionsCount = 12;
    const t = await buildTrustProfile({ merchantSlug: "phil", merchantListingId: "L1", now });
    expect(t.overall_score).toBeGreaterThan(75);
    expect(["excellent", "healthy"]).toContain(t.band);
    expect(t.signals.reviews.score).toBeGreaterThan(70);
    expect(t.signals.completions.score).toBeGreaterThan(70);
    expect(t.signals.reliability.score).toBeGreaterThan(70);
  });

  it("2-year tenure sits mid-tenure signal", async () => {
    listingRow = { id: "L1", display_name: "Phil", created_at: "2024-07-23T00:00:00Z" };
    const t = await buildTrustProfile({ merchantSlug: "phil", now });
    // 2 years / 5 * 30 + 60 = 72
    expect(t.signals.tenure.score).toBeGreaterThan(65);
    expect(t.signals.tenure.score).toBeLessThan(80);
  });
});

describe("bandFor", () => {
  it("maps thresholds correctly", () => {
    expect(bandFor(95)).toBe("excellent");
    expect(bandFor(75)).toBe("healthy");
    expect(bandFor(60)).toBe("steady");
    expect(bandFor(40)).toBe("attention");
    expect(bandFor(10)).toBe("critical");
  });
});
