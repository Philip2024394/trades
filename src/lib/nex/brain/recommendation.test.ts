// Stage 3.17 · Phase 10 · Recommendation unit tests.

import { describe, it, expect } from "vitest";
import {
  detectRecommendationIntent,
  recommendFromCandidates,
  renderRecommendationReply,
  type RecommendCandidate,
} from "./recommendation";
import type { RecognisedEntity } from "./entities";

const AT = "2026-08-31T00:00:00.000Z";

function biz(name: string, refId: string): RecognisedEntity {
  return {
    id: `business_name:${name.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "business_name",
    canonical: name.toLowerCase(),
    raw: name,
    source: "nex_reply",
    atIso: AT,
    presentedOffset: 1,
    refId,
  };
}

function cand(name: string, lat: number, lng: number, category = "accommodation.hotel"): RecommendCandidate {
  return {
    entity: biz(name, `place:accommodation:osm:${name.toLowerCase().replace(/\s+/g, "_")}`),
    hit: { category, geo: { lat, lng } },
  };
}

describe("detectRecommendationIntent", () => {
  it("triggers on 'which is best'", () => expect(detectRecommendationIntent("which one is best?")).toBe(true));
  it("triggers on 'recommend'", () => expect(detectRecommendationIntent("recommend one to me")).toBe(true));
  it("triggers on 'your pick'", () => expect(detectRecommendationIntent("what's your pick?")).toBe(true));
  it("triggers on 'which should I pick'", () => expect(detectRecommendationIntent("which one should I pick")).toBe(true));
  it("triggers on Bahasa 'rekomendasi'", () => expect(detectRecommendationIntent("rekomendasi hotel")).toBe(true));
  it("triggers on Bahasa 'mana yang paling baik'", () => expect(detectRecommendationIntent("mana yang paling baik")).toBe(true));
  it("does NOT trigger on plain discovery", () => expect(detectRecommendationIntent("I need a hotel")).toBe(false));
});

describe("recommendFromCandidates · edge cases", () => {
  it("no candidates → recommended=false · no_candidates", () => {
    const r = recommendFromCandidates([], { area: "malioboro" });
    expect(r.recommended).toBe(false);
    if (!r.recommended) expect(r.reason).toBe("no_candidates");
  });

  it("no area preference AND no geo → no_ranking_signal", () => {
    const r = recommendFromCandidates(
      [
        { entity: biz("A", "id1"), hit: { category: "accommodation.hotel" } },
        { entity: biz("B", "id2"), hit: { category: "accommodation.hotel" } },
      ],
      undefined,
    );
    expect(r.recommended).toBe(false);
    if (!r.recommended) expect(r.reason).toBe("no_ranking_signal");
  });
});

describe("recommendFromCandidates · area proximity ranking", () => {
  it("picks the candidate closest to the area centroid", () => {
    // Malioboro centroid: -7.7929, 110.3660
    const r = recommendFromCandidates(
      [
        cand("Far Hotel",  -7.8271, 110.4001),   // near Kotagede (~5km from Malioboro)
        cand("Close Hotel", -7.7930, 110.3661),  // ~10m from Malioboro
      ],
      { area: "malioboro" },
    );
    expect(r.recommended).toBe(true);
    if (r.recommended) {
      expect(r.topPick.canonical).toBe("close hotel");
      expect(r.reason).toContain("malioboro");
      expect(r.tieBreakingNeeded).toBe(false);
    }
  });

  it("tie-breaking fires when top two are within 100m", () => {
    const r = recommendFromCandidates(
      [
        cand("Alpha", -7.7929, 110.3660),  // exactly at centroid
        cand("Bravo", -7.7930, 110.3661),  // ~15m away
      ],
      { area: "malioboro" },
    );
    expect(r.recommended).toBe(true);
    if (r.recommended) {
      expect(r.tieBreakingNeeded).toBe(true);
      expect(r.tieBreakerPrompt).toContain("essentially tied");
    }
  });

  it("cannotRankOn always lists price / rating / amenities / availability / reviews", () => {
    const r = recommendFromCandidates(
      [cand("A", -7.79, 110.36), cand("B", -7.80, 110.37)],
      { area: "malioboro" },
    );
    if (!r.recommended) throw new Error("expected recommendation");
    const attrs = r.cannotRankOn.map((x) => x.attribute);
    expect(new Set(attrs)).toEqual(new Set(["price", "rating", "amenities", "availability", "reviews"]));
  });

  it("runners are populated in ranked order", () => {
    const r = recommendFromCandidates(
      [
        cand("Third", -7.83, 110.40),
        cand("First",  -7.7929, 110.3660),  // exactly at Malioboro
        cand("Second", -7.7929, 110.3680),  // ~200m away
      ],
      { area: "malioboro" },
    );
    if (!r.recommended) throw new Error("expected recommendation");
    expect(r.topPick.canonical).toBe("first");
    expect(r.runners.map((x) => x.canonical)).toEqual(["second", "third"]);
  });
});

describe("recommendFromCandidates · retrieval-position fallback", () => {
  it("falls back to retrieval position when no area slot but geo present", () => {
    const r = recommendFromCandidates(
      [
        cand("First", -7.79, 110.36),
        cand("Second", -7.80, 110.37),
      ],
      { location: "yogyakarta" },  // no area slot
    );
    expect(r.recommended).toBe(true);
    if (r.recommended) {
      expect(r.topPick.canonical).toBe("first"); // position 0
      expect(r.reason).toContain("retrieval position");
    }
  });
});

describe("renderRecommendationReply", () => {
  it("renders a clear pick with runners", () => {
    const r = recommendFromCandidates(
      [
        cand("Griya Sentana",  -7.7929, 110.3660),  // at Malioboro
        cand("Hotel Trim Tiga", -7.79, 110.36),
      ],
      { area: "malioboro" },
    );
    const txt = renderRecommendationReply(r);
    expect(txt).toContain("Griya Sentana");
    expect(txt).toContain("malioboro");
    expect(txt.toLowerCase()).toContain("i don't have price, rating, amenity");
  });

  it("renders tie-breaker prompt when tied", () => {
    const r = recommendFromCandidates(
      [
        cand("Alpha", -7.7929, 110.3660),
        cand("Bravo", -7.7930, 110.3661),
      ],
      { area: "malioboro" },
    );
    const txt = renderRecommendationReply(r);
    expect(txt.toLowerCase()).toContain("essentially tied");
  });

  it("renders no_candidates message when no candidates", () => {
    const r = recommendFromCandidates([], { area: "malioboro" });
    expect(renderRecommendationReply(r).toLowerCase()).toContain("don't have candidates");
  });
});
