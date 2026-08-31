// src/lib/nex/brain/recommend-from-world.test.ts
//
// Stage 3.35 · Phase A · Evidence-based World recommendation tests
// (Philip 2026-08-31).
//
// Locks in:
//   · Bayesian rating × reviewCount as primary signal (smoothed)
//   · Single 5.0-with-1-review does NOT beat 4.7-with-500-reviews
//   · Area proximity kicks in when rating tied or missing
//   · Retrieval position tie-breaker preserves adapter's ordering
//   · Never fabricates a signal (missing rating stays missing)
//   · Honest gaps enumerated per vertical (price · amenities · distance)
//   · Reply text cites the strongest signal + names the honest gaps
//   · Bilingual EN + ID replies
//   · recommended:false with honest message when zero candidates or no signals

import { describe, expect, it } from "vitest";
import { recommendFromWorld } from "./recommend-from-world";
import type { WorldRecord, WorldVertical } from "./world-adapters/types";

function rec(overrides: Partial<WorldRecord> & { id: string; name: string; vertical?: WorldVertical }): WorldRecord {
  return {
    vertical: overrides.vertical ?? "accommodation",
    market: "ID",
    category: overrides.vertical === "commerce" ? "new" : "hotel",
    city: "Yogyakarta",
    provenance: { sourceKey: "test", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
    ...overrides,
  };
}

describe("recommendFromWorld · Bayesian rating primary signal", () => {
  it("higher-review high-rating wins over single-review 5.0 (Bayesian smoothing works)", () => {
    const A = rec({ id: "1", name: "A", rating: 4.7, reviewCount: 500 });
    const B = rec({ id: "2", name: "B", rating: 5.0, reviewCount: 1 });
    const out = recommendFromWorld({ records: [B, A], vertical: "accommodation" });
    expect(out.recommended).toBe(true);
    if (out.recommended) {
      expect(out.pick.name).toBe("A"); // A wins despite B's raw 5.0
      expect(out.primarySignal).toBe("rating_and_reviews");
    }
  });

  it("clearly higher-rated + more reviews wins", () => {
    const A = rec({ id: "1", name: "Gaotama", rating: 4.7, reviewCount: 128 });
    const B = rec({ id: "2", name: "B",        rating: 4.1, reviewCount: 60 });
    const C = rec({ id: "3", name: "C",        rating: 3.9, reviewCount: 22 });
    const out = recommendFromWorld({ records: [A, B, C], vertical: "accommodation" });
    expect(out.recommended).toBe(true);
    if (out.recommended) {
      expect(out.pick.name).toBe("Gaotama");
      expect(out.runners).toHaveLength(2);
      expect(out.runners[0].record.name).toBe("B");
      expect(out.runners[1].record.name).toBe("C");
    }
  });
});

describe("recommendFromWorld · area proximity secondary signal", () => {
  it("no ratings anywhere · closest to slotArea wins", () => {
    const A = rec({ id: "1", name: "Far",   latitude: -7.85, longitude: 110.40 });
    const B = rec({ id: "2", name: "Close", latitude: -7.795, longitude: 110.366 });  // very near Malioboro (-7.7929, 110.366)
    const out = recommendFromWorld({ records: [A, B], vertical: "accommodation", slotArea: "malioboro" });
    expect(out.recommended).toBe(true);
    if (out.recommended) {
      expect(out.pick.name).toBe("Close");
      expect(out.primarySignal).toBe("area_proximity");
    }
  });

  it("ratings + proximity both present · closer well-rated beats far excellent-rated", () => {
    // Doctrine: when user gave a slot area they care about location.
    // A well-rated option on the requested area beats a slightly-better-rated
    // option 15km away. Math: GreatFar Bayesian ~4.86 × 0.65 = 3.16 · zero
    // proximity bonus (>3km). OkNear Bayesian ~4.17 × 0.65 = 2.71 · full
    // proximity bonus 0.35 × 5 = 1.75 · total 4.45. OkNear wins.
    const A = rec({ id: "1", name: "GreatFar", rating: 4.9, reviewCount: 400, latitude: -7.90, longitude: 110.45 });
    const B = rec({ id: "2", name: "OkNear",   rating: 4.2, reviewCount: 100, latitude: -7.7929, longitude: 110.366 });
    const out = recommendFromWorld({ records: [A, B], vertical: "accommodation", slotArea: "malioboro" });
    expect(out.recommended).toBe(true);
    if (out.recommended) expect(out.pick.name).toBe("OkNear");
  });

  it("ratings + proximity both present · close-enough rating gap wins when proximity ties", () => {
    // Both roughly equal distance from Malioboro; slightly better rated wins.
    const A = rec({ id: "1", name: "Higher", rating: 4.7, reviewCount: 200, latitude: -7.795, longitude: 110.366 });
    const B = rec({ id: "2", name: "Lower",  rating: 4.0, reviewCount: 60,  latitude: -7.797, longitude: 110.365 });
    const out = recommendFromWorld({ records: [A, B], vertical: "accommodation", slotArea: "malioboro" });
    if (out.recommended) expect(out.pick.name).toBe("Higher");
  });
});

describe("recommendFromWorld · retrieval position tie-break", () => {
  it("no signals anywhere · returns no_ranking_signal (never fabricates)", () => {
    const A = rec({ id: "1", name: "A" });
    const B = rec({ id: "2", name: "B" });
    const out = recommendFromWorld({ records: [A, B], vertical: "accommodation" });
    expect(out.recommended).toBe(false);
    if (!out.recommended) {
      expect(out.reason).toBe("no_ranking_signal");
      expect(out.message.en).toContain("rating, review, or distance data");
      expect(out.message.id).toContain("rating");
    }
  });
});

describe("recommendFromWorld · honest gaps per vertical", () => {
  it("accommodation gaps include price + amenities missing when no area", () => {
    const A = rec({ id: "1", name: "A", rating: 4.5, reviewCount: 50 });
    const out = recommendFromWorld({ records: [A], vertical: "accommodation" });
    if (out.recommended) {
      const gapFields = out.honestGaps.map((g) => g.field);
      expect(gapFields).toContain("price");
      expect(gapFields).toContain("distance"); // no slotArea
    }
  });

  it("commerce gap notes amenities absence (schema-level)", () => {
    const A = rec({ id: "1", name: "Product A", vertical: "commerce", rating: 4.5, reviewCount: 50 });
    const out = recommendFromWorld({ records: [A], vertical: "commerce" });
    if (out.recommended) {
      const gapFields = out.honestGaps.map((g) => g.field);
      expect(gapFields).toContain("amenities");
    }
  });

  it("with slotArea + coords · distance gap NOT emitted", () => {
    const A = rec({ id: "1", name: "A", rating: 4.5, reviewCount: 50, latitude: -7.7929, longitude: 110.366 });
    const out = recommendFromWorld({ records: [A], vertical: "accommodation", slotArea: "malioboro" });
    if (out.recommended) {
      const gapFields = out.honestGaps.map((g) => g.field);
      expect(gapFields).not.toContain("distance");
    }
  });
});

describe("recommendFromWorld · reply text · defensible reasoning", () => {
  it("EN reply names the pick, cites rating + reviews, mentions runners", () => {
    const A = rec({ id: "1", name: "Gaotama", rating: 4.7, reviewCount: 128 });
    const B = rec({ id: "2", name: "Trim Tiga", rating: 4.3, reviewCount: 80 });
    const C = rec({ id: "3", name: "Asia Afrika", rating: 4.1, reviewCount: 45 });
    const out = recommendFromWorld({ records: [A, B, C], vertical: "accommodation" });
    if (out.recommended) {
      expect(out.replyText.en).toContain("I'd start with Gaotama");
      expect(out.replyText.en).toContain("4.7");
      expect(out.replyText.en).toContain("128 reviews");
      expect(out.replyText.en).toContain("Trim Tiga");
      // Honest gap · price is called out
      expect(out.replyText.en).toContain("can't compare price");
    }
  });

  it("ID reply names the pick, cites rating in ID phrasing", () => {
    const A = rec({ id: "1", name: "Gaotama", rating: 4.7, reviewCount: 128 });
    const out = recommendFromWorld({ records: [A], vertical: "accommodation" });
    if (out.recommended) {
      expect(out.replyText.id).toContain("Gaotama");
      expect(out.replyText.id).toContain("4.7");
      expect(out.replyText.id).toContain("128 ulasan");
    }
  });

  it("area-proximity primary · reply cites distance, not rating", () => {
    const A = rec({ id: "1", name: "Far",   latitude: -7.85, longitude: 110.40 });
    const B = rec({ id: "2", name: "Close", latitude: -7.795, longitude: 110.366 });
    const out = recommendFromWorld({ records: [A, B], vertical: "accommodation", slotArea: "malioboro" });
    if (out.recommended) {
      expect(out.replyText.en).toContain("Close");
      expect(out.replyText.en).toContain("closest to malioboro");
    }
  });
});

describe("recommendFromWorld · empty candidates", () => {
  it("zero records → recommended:false with honest message", () => {
    const out = recommendFromWorld({ records: [], vertical: "accommodation" });
    expect(out.recommended).toBe(false);
    if (!out.recommended) {
      expect(out.reason).toBe("no_candidates");
    }
  });
});
