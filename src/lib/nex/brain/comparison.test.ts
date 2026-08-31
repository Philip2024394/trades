// Stage 3.16 · Phase 9 · Comparison unit tests.

import { describe, it, expect } from "vitest";
import {
  detectComparisonIntent,
  selectComparisonCandidates,
  compareCandidates,
  renderComparisonReply,
  type CompareCandidate,
} from "./comparison";
import type { RecognisedEntity } from "./entities";

const AT_NEW = "2026-08-31T00:00:00.000Z";
const AT_OLD = "2026-08-30T00:00:00.000Z";

function biz(name: string, offset: number, refId: string, atIso: string = AT_NEW): RecognisedEntity {
  return {
    id: `business_name:${name.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "business_name",
    canonical: name.toLowerCase(),
    raw: name,
    source: "nex_reply",
    atIso,
    presentedOffset: offset,
    refId,
  };
}

function ordinal(word: "first" | "second" | "third"): RecognisedEntity {
  return { id: `ordinal:${word}`, kind: "ordinal", canonical: word, raw: `the ${word}`, source: "user_message", atIso: AT_NEW };
}

describe("detectComparisonIntent", () => {
  it("triggers on 'compare'", () => expect(detectComparisonIntent("compare the first and second")).toBe(true));
  it("triggers on 'vs'", () => expect(detectComparisonIntent("Griya Sentana vs Hotel Trim Tiga")).toBe(true));
  it("triggers on 'difference between'", () => expect(detectComparisonIntent("what is the difference between them")).toBe(true));
  it("triggers on 'which is better'", () => expect(detectComparisonIntent("which one is better")).toBe(true));
  it("triggers on Bahasa 'bandingkan'", () => expect(detectComparisonIntent("bandingkan yang pertama dengan kedua")).toBe(true));
  it("does NOT trigger on plain discovery", () => expect(detectComparisonIntent("I need a hotel")).toBe(false));
});

describe("selectComparisonCandidates", () => {
  const window = [
    biz("Griya Sentana", 1, "place:accommodation:osm:node_1"),
    biz("Hotel Trim Tiga", 2, "place:accommodation:osm:node_2"),
    biz("Asia Afrika", 3, "place:accommodation:osm:node_3"),
  ];

  it("picks the ordinals-referenced businesses when 2+ ordinals present", () => {
    const selected = selectComparisonCandidates([ordinal("first"), ordinal("third")], window);
    expect(selected.map((e) => e.canonical)).toEqual(["griya sentana", "asia afrika"]);
  });

  it("falls back to top-N of most-recent batch when no ordinals", () => {
    const selected = selectComparisonCandidates([], window, 2);
    expect(selected).toHaveLength(2);
    expect(selected.map((e) => e.canonical)).toEqual(["griya sentana", "hotel trim tiga"]);
  });

  it("only considers most-recent batch when 1 ordinal present + fallback ignored", () => {
    // 1 ordinal only · fallback to top-N because <2 ordinals.
    const selected = selectComparisonCandidates([ordinal("second")], window, 3);
    expect(selected.map((e) => e.canonical)).toEqual(["griya sentana", "hotel trim tiga", "asia afrika"]);
  });

  it("returns empty when no presented businesses in window", () => {
    expect(selectComparisonCandidates([ordinal("first"), ordinal("second")], [])).toEqual([]);
  });
});

describe("compareCandidates", () => {
  function candidate(name: string, refId: string, category: string, lat: number, lng: number): CompareCandidate {
    return {
      entity: biz(name, 1, refId),
      hit: { category, geo: { lat, lng } },
    };
  }

  it("returns insufficient_candidates for <2", () => {
    const r = compareCandidates([candidate("Griya Sentana", "id1", "accommodation.hotel", -7.79, 110.36)]);
    expect(r.compared).toBe(false);
    if (!r.compared) expect(r.reason).toBe("insufficient_candidates");
  });

  it("returns too_many_candidates for >3", () => {
    const many = [1, 2, 3, 4].map((i) => candidate(`H${i}`, `id${i}`, "accommodation.hotel", -7.79, 110.36));
    const r = compareCandidates(many);
    expect(r.compared).toBe(false);
    if (!r.compared) expect(r.reason).toBe("too_many_candidates");
  });

  it("compares 2 candidates and emits all attribute kinds + honest boundaries", () => {
    const r = compareCandidates([
      candidate("Griya Sentana", "id1", "accommodation.hotel", -7.7853, 110.3636),
      candidate("Hotel Trim Tiga", "id2", "accommodation.hotel", -7.79, 110.36),
    ]);
    expect(r.compared).toBe(true);
    if (!r.compared) return;
    const keys = r.attributes.map((a) => a.key);
    expect(new Set(keys)).toEqual(new Set(["name", "type", "area_proximity", "coords", "provenance"]));
    // All 5 boundary categories present.
    const boundaryAttrs = r.boundaries.map((b) => b.attribute);
    expect(new Set(boundaryAttrs)).toEqual(new Set(["price", "rating", "amenities", "availability", "reviews"]));
  });

  it("area proximity computed via haversine to nearest known centroid", () => {
    // Griya Sentana is close to Tugu; Hotel Trim Tiga sits closer to Malioboro.
    const r = compareCandidates([
      candidate("Griya Sentana", "id1", "accommodation.hotel", -7.7854, 110.3636),
      candidate("Hotel Trim Tiga", "id2", "accommodation.hotel", -7.7929, 110.3660),
    ]);
    if (!r.compared) throw new Error("expected compared=true");
    const area = r.attributes.find((a) => a.key === "area_proximity")!;
    expect(area.supported).toBe(true);
    // Second candidate is essentially AT Malioboro centroid — should mention it.
    expect(area.values[1].value.toLowerCase()).toContain("malioboro");
  });

  it("notes 'same type · same area cluster' when both match", () => {
    const r = compareCandidates([
      candidate("A", "id1", "accommodation.hotel", -7.7929, 110.3660),
      candidate("B", "id2", "accommodation.hotel", -7.7930, 110.3661),
    ]);
    if (!r.compared) throw new Error("expected compared");
    expect(r.summary).toContain("same type");
    expect(r.summary).toContain("same area cluster");
  });

  it("preserves refId on candidates", () => {
    const r = compareCandidates([
      candidate("A", "place:accommodation:osm:node_100", "accommodation.hotel", -7.79, 110.36),
      candidate("B", "place:accommodation:osm:node_200", "accommodation.hotel", -7.79, 110.36),
    ]);
    if (!r.compared) throw new Error("expected compared");
    expect(r.candidates.map((c) => c.refId)).toEqual(["place:accommodation:osm:node_100", "place:accommodation:osm:node_200"]);
  });
});

describe("renderComparisonReply", () => {
  it("renders multi-line comparison with one candidate line each", () => {
    const r = compareCandidates([
      { entity: biz("Griya Sentana", 1, "id1"), hit: { category: "accommodation.hotel", geo: { lat: -7.7854, lng: 110.3636 } } },
      { entity: biz("Hotel Trim Tiga", 2, "id2"), hit: { category: "accommodation.hotel", geo: { lat: -7.7929, lng: 110.3660 } } },
    ]);
    const txt = renderComparisonReply(r);
    expect(txt).toContain("Comparing Griya Sentana and Hotel Trim Tiga");
    expect(txt).toContain("Griya Sentana — hotel");
    expect(txt).toContain("Hotel Trim Tiga — hotel");
    expect(txt).toContain("directory");
  });

  it("insufficient · returns 'need at least two' prompt", () => {
    const r = compareCandidates([{ entity: biz("A", 1, "id1"), hit: { category: "accommodation.hotel", geo: { lat: -7.79, lng: 110.36 } } }]);
    expect(renderComparisonReply(r).toLowerCase()).toContain("at least two");
  });
});
