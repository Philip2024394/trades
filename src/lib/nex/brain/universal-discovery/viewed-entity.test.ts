// src/lib/nex/brain/universal-discovery/viewed-entity.test.ts
//
// NEX World-Class Result Card Interaction & Entity Detail Slice
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE

import { describe, expect, it } from "vitest";
import {
  VIEWED_ENTITY_FRESHNESS_TURNS,
  isViewedEntityFresh,
  makeViewedEntitySnapshot,
  type ViewedEntitySnapshot,
} from "./viewed-entity";

const sample: ViewedEntitySnapshot = {
  ref_id: "place:accommodation:#AC-2026-0000D",
  vertical: "accommodation",
  name: "Gaotama Hotel",
  viewedInTurn: 3,
  viewedAtIso: "2026-09-06T14:00:00Z",
};

describe("viewed-entity · freshness", () => {
  it("undefined snapshot is never fresh", () => {
    expect(isViewedEntityFresh(undefined, 3)).toBe(false);
  });
  it("same-turn is fresh", () => {
    expect(isViewedEntityFresh(sample, 3)).toBe(true);
  });
  it("within freshness window is fresh", () => {
    expect(isViewedEntityFresh(sample, 3 + VIEWED_ENTITY_FRESHNESS_TURNS)).toBe(true);
  });
  it("beyond freshness window is stale", () => {
    expect(isViewedEntityFresh(sample, 3 + VIEWED_ENTITY_FRESHNESS_TURNS + 1)).toBe(false);
  });
  it("out-of-order turn is not fresh", () => {
    expect(isViewedEntityFresh(sample, 2)).toBe(false);
  });
});

describe("viewed-entity · makeViewedEntitySnapshot", () => {
  it("builds a snapshot from valid inputs", () => {
    const snap = makeViewedEntitySnapshot({
      ref_id: "place:accommodation:#AC-2026-0000D",
      vertical: "accommodation",
      name: "Gaotama Hotel",
      turnCount: 5,
      nowIso: "2026-09-06T14:00:00Z",
    });
    expect(snap).not.toBeNull();
    if (snap) {
      expect(snap.ref_id).toBe("place:accommodation:#AC-2026-0000D");
      expect(snap.vertical).toBe("accommodation");
      expect(snap.name).toBe("Gaotama Hotel");
      expect(snap.viewedInTurn).toBe(5);
    }
  });
  it("rejects unknown vertical", () => {
    const snap = makeViewedEntitySnapshot({
      ref_id: "place:xxx:#AC-2026-0000D",
      vertical: "not_a_vertical",
      name: "Gaotama Hotel",
      turnCount: 5,
    });
    expect(snap).toBeNull();
  });
  it("rejects empty ref_id / name", () => {
    expect(makeViewedEntitySnapshot({ ref_id: "", vertical: "accommodation", name: "X", turnCount: 1 })).toBeNull();
    expect(makeViewedEntitySnapshot({ ref_id: "x", vertical: "accommodation", name: "", turnCount: 1 })).toBeNull();
  });
  it("rejects non-finite turnCount", () => {
    expect(makeViewedEntitySnapshot({ ref_id: "x", vertical: "food", name: "N", turnCount: NaN })).toBeNull();
  });
  it("accepts and floors positive turnCount", () => {
    const snap = makeViewedEntitySnapshot({ ref_id: "x", vertical: "food", name: "N", turnCount: 2.9 });
    expect(snap?.viewedInTurn).toBe(2);
  });
  it("floors turnCount<1 to 1", () => {
    const snap = makeViewedEntitySnapshot({ ref_id: "x", vertical: "food", name: "N", turnCount: 0 });
    expect(snap?.viewedInTurn).toBe(1);
  });
});

describe("viewed-entity · cross-vertical", () => {
  it("accepts each recognised vertical", () => {
    for (const v of ["accommodation", "food", "commerce", "service", "transport", "places"] as const) {
      const snap = makeViewedEntitySnapshot({ ref_id: "x", vertical: v, name: "N", turnCount: 1 });
      expect(snap?.vertical).toBe(v);
    }
  });
});
