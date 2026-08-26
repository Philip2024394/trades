// src/lib/nex-decision/decision-context.test.ts
//
// EVIDENCE-BOUNDARY TESTS · anti-hallucination enforcement.
//
// These tests prove Decision Context CANNOT be tricked into promoting evidence
// into an unwarranted conclusion. They are the enforcement of:
//
//   - Truth Invariant (2026-08-22 CONSTITUTIONAL)
//   - Business Suitability ≠ Business Quality (2026-08-23)
//   - Traveller Protection Principle (2026-08-23)
//   - SOURCE → CLAIM → INTERPRETATION → UNKNOWN → DECISION chain (2026-08-23)
//
// If any of these tests ever go red, it means a code change has weakened the
// evidence boundary. Fix the code · never the test.

import { describe, it, expect } from "vitest";
import { composeDecision, renderSCIUD } from "./decision-context";
import type {
  BusinessKnowledge,
  EvidenceItem,
} from "../nex-directory/business-knowledge-object";

function mkEvidence(overrides: Partial<EvidenceItem>): EvidenceItem {
  return {
    knowledgeId: "test-id",
    vertical: "food",
    businessRef: "test-business",
    attributeDomain: "facilities",
    attributeKey: "wheelchair",
    source: "osm_replay",
    sourceReference: "node/1",
    sourceTier: "OBSERVED",
    claim: "yes",
    interpretation: null,
    unknownNote: null,
    confidence: null,
    capturedAt: new Date("2026-08-01T00:00:00Z"),
    freshnessValidUntil: null,
    provenance: {},
    snapshotId: null,
    cycleRunId: null,
    supersededBy: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

function mkBK(items: EvidenceItem[]): BusinessKnowledge {
  const byDomain: BusinessKnowledge["byDomain"] = {};
  for (const it of items) {
    const d = (byDomain[it.attributeDomain] ??= {});
    (d[it.attributeKey] ??= []).push(it);
  }
  return {
    vertical: "food",
    businessRef: "test-business",
    byDomain,
    allEvidence: items,
  };
}

describe("Evidence boundary · changing_table=yes does NOT become family-safe", () => {
  it("returns the raw evidence and unknown-note · never a family-safe verdict", () => {
    const bk = mkBK([
      mkEvidence({
        attributeDomain: "family",
        attributeKey: "changing_table",
        claim: "yes",
        interpretation: "This business has a baby changing table according to OSM.",
        unknownNote:
          "This does NOT mean the business is family safe. Family suitability requires context NEX doesn't have from this single tag.",
      }),
    ]);

    const answer = composeDecision(bk, {
      attributeDomain: "family",
      attributeKey: "changing_table",
      intent: "is this place ok for kids",
    });

    expect(answer.status).toBe("EVIDENCE_FOUND");
    // The answer must not contain "family safe" as a positive assertion.
    expect(answer.interpretation.toLowerCase()).not.toMatch(/family\s+safe/);
    // The unknown-note must acknowledge the boundary.
    expect(answer.unknown).toMatch(/does NOT mean/i);
    // The decision must be handed to the traveller.
    expect(answer.decisionPhrasing.toLowerCase()).toMatch(/traveller/);
  });

  it("no changing_table evidence at all does NOT flip to 'not family safe'", () => {
    const bk = mkBK([]);
    const answer = composeDecision(bk, {
      attributeDomain: "family",
      attributeKey: "changing_table",
      intent: "is this place ok for kids",
    });

    expect(answer.status).toBe("NO_EVIDENCE");
    expect(answer.claims).toEqual([]);
    // Absence of evidence is not evidence of absence · answer must say so.
    expect(answer.unknown.toLowerCase()).toMatch(/does not mean the answer is no/);
  });
});

describe("Evidence boundary · OSM contact:whatsapp does NOT become 'contactable now'", () => {
  it("returns the raw phone claim with an availability unknown-note", () => {
    const bk = mkBK([
      mkEvidence({
        attributeDomain: "contact",
        attributeKey: "contact_whatsapp",
        claim: "+62 812 xxxx xxxx",
        interpretation:
          "OSM records a WhatsApp number for this business. The number was observed at OSM capture time.",
        unknownNote:
          "This does NOT confirm the number still works, that the business responds on WhatsApp, or that it is monitored right now.",
      }),
    ]);
    const answer = composeDecision(bk, {
      attributeDomain: "contact",
      attributeKey: "contact_whatsapp",
      intent: "can I message them now",
    });

    expect(answer.interpretation.toLowerCase()).not.toMatch(/contactable\s+now/);
    expect(answer.interpretation.toLowerCase()).not.toMatch(/reachable\s+now/);
    expect(answer.unknown).toMatch(/does NOT confirm/);
  });
});

describe("Evidence boundary · straight-line distance does NOT become walking distance", () => {
  it("straight-line evidence carries an unknown-note about routing", () => {
    const bk = mkBK([
      mkEvidence({
        attributeDomain: "location",
        attributeKey: "straight_line_distance_m",
        claim: 850,
        interpretation:
          "The straight-line distance to the destination is 850 metres based on coordinates.",
        unknownNote:
          "Straight-line distance is NOT walking distance. Actual walk depends on roads, footpaths, rivers, walls, safety, and time of day.",
      }),
    ]);
    const answer = composeDecision(bk, {
      attributeDomain: "location",
      attributeKey: "straight_line_distance_m",
      intent: "can I walk there",
    });

    expect(answer.interpretation.toLowerCase()).not.toMatch(/walking\s+distance/);
    expect(answer.unknown).toMatch(/NOT walking distance/i);
  });
});

describe("Evidence boundary · regulated fare range does NOT become live app quote", () => {
  it("regulated tariff evidence carries an unknown-note about live pricing", () => {
    const bk = mkBK([
      mkEvidence({
        attributeDomain: "commercial",
        attributeKey: "ojol_fare_reference_range_idr",
        claim: { min: 9250, max: 11500, per_km_min: 1850, per_km_max: 2300 },
        sourceTier: "VERIFIED",
        source: "gov_registry",
        sourceReference: "KP-564-2022",
        interpretation:
          "Ministry of Transport Zone I motorcycle ride-hailing tariff for Yogyakarta: Rp 1,850–2,300 per km, minimum first-ride Rp 9,250–11,500 (KP 564/2022, Zone I).",
        unknownNote:
          "This is the regulated reference. It is NOT the live Grab/Gojek quote. Actual price depends on the operator's current fare rules, promotions, surge, tolls, waiting, and traffic.",
      }),
    ]);
    const answer = composeDecision(bk, {
      attributeDomain: "commercial",
      attributeKey: "ojol_fare_reference_range_idr",
      intent: "what will it cost on Grab",
    });

    expect(answer.interpretation.toLowerCase()).not.toMatch(/your\s+grab\s+price/);
    expect(answer.interpretation.toLowerCase()).not.toMatch(/live\s+quote/);
    expect(answer.unknown).toMatch(/NOT the live/i);
  });
});

describe("Evidence boundary · OWNER_CLAIM never silently promoted to VERIFIED", () => {
  it("keeps source_tier immutable in the answer chain", () => {
    const bk = mkBK([
      mkEvidence({
        attributeDomain: "opening_availability",
        attributeKey: "opening_hours",
        source: "owner_form",
        sourceReference: "form-abc",
        sourceTier: "OWNER_CLAIM",
        claim: "Mo-Fr 09:00-17:00",
        interpretation: "The owner states hours as Mon-Fri 09:00-17:00.",
        unknownNote: "Not independently verified.",
      }),
    ]);
    const answer = composeDecision(bk, {
      attributeDomain: "opening_availability",
      attributeKey: "opening_hours",
      intent: "will they be open tomorrow at 10am",
    });

    expect(answer.sources[0].sourceTier).toBe("OWNER_CLAIM");
    // The interpretation must not present as VERIFIED
    expect(answer.interpretation.toLowerCase()).not.toMatch(/verified/);
  });

  it("chooses VERIFIED over OWNER_CLAIM when both exist", () => {
    const bk = mkBK([
      mkEvidence({
        attributeDomain: "opening_availability",
        attributeKey: "opening_hours",
        source: "owner_form",
        sourceReference: "form-abc",
        sourceTier: "OWNER_CLAIM",
        claim: "Mo-Fr 09:00-17:00",
      }),
      mkEvidence({
        attributeDomain: "opening_availability",
        attributeKey: "opening_hours",
        source: "gov_registry",
        sourceReference: "reg-1",
        sourceTier: "VERIFIED",
        claim: "Mo-Sa 08:00-20:00",
      }),
    ]);
    const answer = composeDecision(bk, {
      attributeDomain: "opening_availability",
      attributeKey: "opening_hours",
      intent: "when are they open",
    });

    expect(answer.sources[0].sourceTier).toBe("VERIFIED");
    expect(answer.claims[0]).toBe("Mo-Sa 08:00-20:00");
  });
});

describe("Evidence boundary · conflicting evidence never silently resolved", () => {
  it("flags EVIDENCE_INSUFFICIENT when top-tier claims disagree", () => {
    const bk = mkBK([
      mkEvidence({
        attributeDomain: "facilities",
        attributeKey: "wheelchair",
        source: "osm_replay",
        sourceReference: "node/1",
        sourceTier: "OBSERVED",
        claim: "yes",
      }),
      mkEvidence({
        attributeDomain: "facilities",
        attributeKey: "wheelchair",
        source: "osm_replay",
        sourceReference: "node/2",
        sourceTier: "OBSERVED",
        claim: "no",
      }),
    ]);
    const answer = composeDecision(bk, {
      attributeDomain: "facilities",
      attributeKey: "wheelchair",
      intent: "is it wheelchair accessible",
    });

    expect(answer.status).toBe("EVIDENCE_INSUFFICIENT");
    expect(answer.interpretation.toLowerCase()).toMatch(/conflicting/);
  });
});

describe("SCIUD renderer · never skips a line", () => {
  it("always renders all five lines even when some are empty", () => {
    const answer = composeDecision(null, {
      attributeDomain: "family",
      attributeKey: "changing_table",
      intent: "kids ok",
    });
    const text = renderSCIUD(answer);
    expect(text).toMatch(/^SOURCE:/m);
    expect(text).toMatch(/^CLAIM:/m);
    expect(text).toMatch(/^INTERPRETATION:/m);
    expect(text).toMatch(/^UNKNOWN:/m);
    expect(text).toMatch(/^DECISION:/m);
  });
});
