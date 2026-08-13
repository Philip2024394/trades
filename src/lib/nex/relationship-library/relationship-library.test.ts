// Object Relationship Library · tests.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { assertRelationship, get, query, count, clear, describeObject } from "./index";

beforeEach(() => clear());

describe("Object Relationship Library", () => {
  it("assertRelationship registers a typed edge", () => {
    const r = assertRelationship({ from_object_id: "LOFT_LADDER_001", kind: "requires", to_object_id: "LOFT_HATCH_001", confidence: 0.9 });
    expect(r.observed_count).toBe(1);
    expect(count()).toBe(1);
  });

  it("re-asserting the same edge reinforces confidence + observed_count + evidence", () => {
    assertRelationship({ from_object_id: "LOFT_LADDER_001", kind: "requires", to_object_id: "LOFT_HATCH_001", confidence: 0.9, evidence_asset_id: "asset_1" });
    const r = assertRelationship({ from_object_id: "LOFT_LADDER_001", kind: "requires", to_object_id: "LOFT_HATCH_001", confidence: 0.9, evidence_asset_id: "asset_2" });
    expect(r.observed_count).toBe(2);
    expect(r.evidence_asset_ids).toEqual(["asset_1", "asset_2"]);
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it("reinforcement caps confidence at 1.0", () => {
    for (let i = 0; i < 20; i++) {
      assertRelationship({ from_object_id: "A", kind: "requires", to_object_id: "B", confidence: 0.9 });
    }
    const r = get("A", "requires", "B");
    expect(r?.confidence).toBeLessThanOrEqual(1);
  });

  it("stores loft ladder taxonomy · requires/mounted_in/inside/used_for", () => {
    assertRelationship({ from_object_id: "LOFT_LADDER_001", kind: "requires", to_object_id: "LOFT_HATCH_001", confidence: 0.95 });
    assertRelationship({ from_object_id: "LOFT_HATCH_001", kind: "mounted_in", to_object_id: "CEILING", confidence: 0.95 });
    assertRelationship({ from_object_id: "CEILING", kind: "inside", to_object_id: "ROOM", confidence: 1 });
    assertRelationship({ from_object_id: "LOFT_LADDER_001", kind: "used_for", to_object_id: "loft_access", confidence: 1 });
    expect(count()).toBe(4);
  });

  it("query filters by from · to · kind · min_confidence", () => {
    assertRelationship({ from_object_id: "A", kind: "requires", to_object_id: "B", confidence: 0.9 });
    assertRelationship({ from_object_id: "A", kind: "mounted_in", to_object_id: "C", confidence: 0.6 });
    expect(query({ from_object_id: "A" })).toHaveLength(2);
    expect(query({ from_object_id: "A", kind: "requires" })).toHaveLength(1);
    expect(query({ min_confidence: 0.8 })).toHaveLength(1);
  });

  it("describeObject renders a Voice-friendly summary", () => {
    assertRelationship({ from_object_id: "LOFT_LADDER_001", kind: "requires", to_object_id: "LOFT_HATCH_001", confidence: 0.95 });
    assertRelationship({ from_object_id: "LOFT_LADDER_001", kind: "used_for", to_object_id: "loft_access", confidence: 1 });
    const desc = describeObject("LOFT_LADDER_001");
    expect(desc).toContain("requires → LOFT_HATCH_001");
    expect(desc).toContain("used_for → loft_access");
  });

  it("describeObject for unknown object returns 'no relationships recorded'", () => {
    expect(describeObject("UNKNOWN")).toContain("no relationships recorded");
  });
});
