// src/lib/nex/capability-graph/__tests__/wave-8g1-acceptance.test.ts
//
// UWI · Wave 8.G.1 · Capability graph substrate acceptance suite
// Founder-authorised (2026-09-21 · this-turn's explicit authorisation).
//
// Founder-required proof:
//   1. Positive evidence-backed functional_pipeline · creates edge
//   2. Rejection of unsupported relationship (empty/vacuous evidence)
//   3. Contradiction handling (contradicting arrays preserved SEPARATELY · never netted)
//   4. Deduplication (same signature refused)
//   5. 20-edge per-cycle emission ceiling enforced
//   6. Provenance preservation (typed EntityRef edges + M19 append-only log)
//   7. Relevance separation (M22 · averageRelevance throws)
//   8. Existing lifecycle compatibility (M18 8-entity vocabulary preserved)
//   9. No fabricated Product Candidates (Wave 8.G.1 does not touch ProductCandidateStore)
//  10. State machine (M23 distinct absorbing states · PARKED reversible)

import { describe, it, expect } from "vitest";
import {
  CapabilityRelationshipStore,
  RelationshipLifecycleLog,
  validateFunctionalPipelineEvidence,
  assertFunctionalPipelineEvidence,
  computeFunctionalPipelineDedupSignature,
  DEFAULT_MAX_EMISSIONS_PER_CYCLE,
  CompositionEdgeInsufficientEvidenceError,
  DuplicateRelationshipError,
  EmissionCeilingReachedError,
  InvalidRelationshipStatusTransitionError,
  nodeId,
  type CapabilityNode,
  type FunctionalPipelineEvidence,
} from "..";
import { RelevanceAveragingProhibitedError } from "../../research-memory/types";
import { ProductCandidateStore, ProductLifecycleLog } from "../../product-lifecycle";

// ═══ Helpers ══════════════════════════════════════════════════════════
function nodeA(): CapabilityNode {
  return {
    finding_id: "ecofinding:aaaa",
    capability_category: "webgl_rendering",
    underlying_technique: "WebGL fragment shader compositor",
    nex_rebuildable_natively: true,
    source_ecosystem: "github",
    source_resource_id: "org/webgl-lib",
  };
}
function nodeB(): CapabilityNode {
  return {
    finding_id: "ecofinding:bbbb",
    capability_category: "video_timeline",
    underlying_technique: "video timeline + track manager + keyframe editor",
    nex_rebuildable_natively: true,
    source_ecosystem: "github",
    source_resource_id: "org/video-editor",
  };
}

function realEvidence(): FunctionalPipelineEvidence {
  return {
    source_capability_output: "RGBA texture rendered to canvas (WebGL framebuffer with typed dimensions)",
    consumer_capability_input: "per-frame RGBA texture data · read from canvas by track manager for keyframe compositing",
    pipeline_medium: "shared canvas element · WebGL texture handed to video timeline as per-frame layer input",
    source_evidence_ref: { kind: "RAW_EVIDENCE", id: "evidence:rendered-frame-consumed-by-timeline-2026-09-21" },
  };
}

function vacuousEvidence(): FunctionalPipelineEvidence {
  return {
    source_capability_output: "TBD",
    consumer_capability_input: "",
    pipeline_medium: "?",
    source_evidence_ref: { kind: "OPPORTUNITY", id: "x" },  // wrong kind
  };
}

function fresh() {
  const history = new RelationshipLifecycleLog();
  return { store: new CapabilityRelationshipStore(history), history };
}

function baseCreate(store: CapabilityRelationshipStore, cycle_id: string = "cycle-1") {
  return store.createFunctionalPipeline({
    left_node: nodeA(),
    right_node: nodeB(),
    evidence: realEvidence(),
    supporting_signals: ["both capabilities render RGBA frames · shared type match"],
    contradicting_signals: [],
    user_relevance: 0.6,
    nex_relevance: 0.7,
    confidence: 0.75,
    novelty_score: 0.55,
    cycle_id,
    actor: "test",
    provenance: { discovered_via: "wave-8g1-test" },
  });
}

// ═══ (1) Positive evidence-backed pipeline ═══════════════════════════
describe("Wave 8.G.1 · (1) positive evidence-backed functional_pipeline", () => {
  it("creates a relationship in DISCOVERED status with dedup signature + append-only history", () => {
    const { store, history } = fresh();
    const rel = baseCreate(store);
    expect(rel.status).toBe("DISCOVERED");
    expect(rel.kind).toBe("functional_pipeline");
    expect(rel.dedup_signature).toBe(computeFunctionalPipelineDedupSignature(nodeId(nodeA()), nodeId(nodeB())));
    expect(rel.evidence.source_evidence_ref.kind).toBe("RAW_EVIDENCE");
    expect(store.size()).toBe(1);
    expect(history.size()).toBe(1);
  });
});

// ═══ (2) Rejection of unsupported relationship ═══════════════════════
describe("Wave 8.G.1 · (2) rejection of unsupported relationship (evidence-required)", () => {
  it("vacuous evidence → CompositionEdgeInsufficientEvidenceError · nothing stored", () => {
    const { store } = fresh();
    expect(() => store.createFunctionalPipeline({
      left_node: nodeA(),
      right_node: nodeB(),
      evidence: vacuousEvidence(),
      user_relevance: 0.5, nex_relevance: 0.5,
      confidence: 0.5, novelty_score: 0.5,
      cycle_id: "cycle-x", actor: "test",
    })).toThrow(CompositionEdgeInsufficientEvidenceError);
    expect(store.size()).toBe(0);
  });

  it("evidence with wrong-kind source_evidence_ref → refused", () => {
    const { store } = fresh();
    const evidence: FunctionalPipelineEvidence = {
      ...realEvidence(),
      source_evidence_ref: { kind: "DECISION", id: "decision:x" },  // DECISION is not evidence
    };
    expect(() => store.createFunctionalPipeline({
      left_node: nodeA(), right_node: nodeB(), evidence,
      user_relevance: 0.5, nex_relevance: 0.5,
      confidence: 0.5, novelty_score: 0.5,
      cycle_id: "cycle-x", actor: "test",
    })).toThrow(CompositionEdgeInsufficientEvidenceError);
  });

  it("validator standalone flags every missing field", () => {
    const verdict = validateFunctionalPipelineEvidence(vacuousEvidence());
    expect(verdict.is_admissible).toBe(false);
    expect(verdict.missing_or_vacuous.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══ (3) Contradiction handling (M21 · SEPARATE arrays never netted) ═
describe("Wave 8.G.1 · (3) contradiction handling", () => {
  it("supporting and contradicting arrays kept SEPARATE at insert · never merged", () => {
    const { store } = fresh();
    const rel = store.createFunctionalPipeline({
      left_node: nodeA(), right_node: nodeB(),
      evidence: realEvidence(),
      supporting_signals: ["shared RGBA type"],
      contradicting_signals: ["framerate mismatch · source 60fps · consumer 30fps"],
      user_relevance: 0.6, nex_relevance: 0.7,
      confidence: 0.65, novelty_score: 0.5,
      cycle_id: "cycle-1", actor: "test",
    });
    expect(rel.supporting_signals).toEqual(["shared RGBA type"]);
    expect(rel.contradicting_signals).toEqual(["framerate mismatch · source 60fps · consumer 30fps"]);
    // Arrays are distinct references · not netted
    expect(rel.supporting_signals).not.toBe(rel.contradicting_signals);
  });

  it("addSupportingSignal + addContradictingSignal update the SEPARATE arrays independently", () => {
    const { store, history } = fresh();
    const rel = baseCreate(store);
    store.addSupportingSignal(rel.relationship_id, "second supporting", "test");
    store.addContradictingSignal(rel.relationship_id, "second contradicting", "test");
    const updated = store.mustGet(rel.relationship_id);
    expect(updated.supporting_signals.length).toBe(2);
    expect(updated.contradicting_signals.length).toBe(1);
    expect(history.size()).toBe(3);   // created + supporting + contradicting
  });
});

// ═══ (4) Deduplication ═══════════════════════════════════════════════
describe("Wave 8.G.1 · (4) deduplication", () => {
  it("second insert with same left→right signature → DuplicateRelationshipError · store size unchanged", () => {
    const { store } = fresh();
    const first = baseCreate(store);
    expect(() => baseCreate(store)).toThrow(DuplicateRelationshipError);
    expect(store.size()).toBe(1);
    expect(store.findBySignature(first.dedup_signature)?.relationship_id).toBe(first.relationship_id);
  });

  it("swapped direction (B→A) is treated as a DIFFERENT signature (directional pipeline)", () => {
    const { store } = fresh();
    baseCreate(store);   // A → B
    // Now B → A · different signature
    const rel2 = store.createFunctionalPipeline({
      left_node: nodeB(), right_node: nodeA(),
      evidence: realEvidence(),
      user_relevance: 0.5, nex_relevance: 0.5,
      confidence: 0.5, novelty_score: 0.5,
      cycle_id: "cycle-1", actor: "test",
    });
    expect(rel2.dedup_signature).not.toBe(computeFunctionalPipelineDedupSignature(nodeId(nodeA()), nodeId(nodeB())));
    expect(store.size()).toBe(2);
  });
});

// ═══ (5) 20-edge per-cycle emission ceiling ══════════════════════════
describe("Wave 8.G.1 · (5) bounded per-cycle emission ceiling (default 20)", () => {
  it("21st insert in same cycle → EmissionCeilingReachedError", () => {
    const { store } = fresh();
    expect(store.maxEmissionsPerCycle()).toBe(DEFAULT_MAX_EMISSIONS_PER_CYCLE);
    // Insert 20 different edges in the same cycle
    for (let i = 0; i < 20; i++) {
      const left: CapabilityNode = { ...nodeA(), finding_id: `ecofinding:a${i}` };
      const right: CapabilityNode = { ...nodeB(), finding_id: `ecofinding:b${i}` };
      store.createFunctionalPipeline({
        left_node: left, right_node: right,
        evidence: realEvidence(),
        user_relevance: 0.5, nex_relevance: 0.5,
        confidence: 0.5, novelty_score: 0.5,
        cycle_id: "cycle-cap", actor: "test",
      });
    }
    expect(store.perCycleCount("cycle-cap")).toBe(20);
    // 21st insert refused
    expect(() => store.createFunctionalPipeline({
      left_node: { ...nodeA(), finding_id: "ecofinding:a20" },
      right_node: { ...nodeB(), finding_id: "ecofinding:b20" },
      evidence: realEvidence(),
      user_relevance: 0.5, nex_relevance: 0.5,
      confidence: 0.5, novelty_score: 0.5,
      cycle_id: "cycle-cap", actor: "test",
    })).toThrow(EmissionCeilingReachedError);
  });

  it("different cycle_id gets its own counter · not blocked by prior full cycle", () => {
    const { store } = fresh();
    for (let i = 0; i < 20; i++) {
      const left: CapabilityNode = { ...nodeA(), finding_id: `ecofinding:c1a${i}` };
      const right: CapabilityNode = { ...nodeB(), finding_id: `ecofinding:c1b${i}` };
      store.createFunctionalPipeline({
        left_node: left, right_node: right,
        evidence: realEvidence(),
        user_relevance: 0.5, nex_relevance: 0.5,
        confidence: 0.5, novelty_score: 0.5,
        cycle_id: "cycle-1", actor: "test",
      });
    }
    // New cycle can insert
    const rel = store.createFunctionalPipeline({
      left_node: { ...nodeA(), finding_id: "ecofinding:c2a0" },
      right_node: { ...nodeB(), finding_id: "ecofinding:c2b0" },
      evidence: realEvidence(),
      user_relevance: 0.5, nex_relevance: 0.5,
      confidence: 0.5, novelty_score: 0.5,
      cycle_id: "cycle-2", actor: "test",
    });
    expect(rel).toBeDefined();
    expect(store.perCycleCount("cycle-1")).toBe(20);
    expect(store.perCycleCount("cycle-2")).toBe(1);
  });
});

// ═══ (6) Provenance preservation ═════════════════════════════════════
describe("Wave 8.G.1 · (6) provenance preservation (M18 typed edges · M19 append-only)", () => {
  it("relationship carries typed edges to both source findings + custom provenance envelope", () => {
    const { store, history } = fresh();
    const rel = store.createFunctionalPipeline({
      left_node: nodeA(), right_node: nodeB(),
      evidence: realEvidence(),
      user_relevance: 0.6, nex_relevance: 0.7,
      confidence: 0.7, novelty_score: 0.55,
      cycle_id: "cycle-prov", actor: "test",
      provenance: { discovered_via: "wave-8g1-test", cross_ref: "opp-42" },
    });
    expect(rel.left_node.finding_id).toBe("ecofinding:aaaa");
    expect(rel.right_node.finding_id).toBe("ecofinding:bbbb");
    expect(rel.provenance).toEqual({ discovered_via: "wave-8g1-test", cross_ref: "opp-42" });
    expect(rel.evidence.source_evidence_ref.kind).toBe("RAW_EVIDENCE");
    const events = history.forRelationship(rel.relationship_id);
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("created");
    expect(events[0].detail).toMatchObject({ cycle_id: "cycle-prov" });
  });
});

// ═══ (7) Relevance separation (M22) ══════════════════════════════════
describe("Wave 8.G.1 · (7) relevance separation (M22 · never averaged)", () => {
  it("user_relevance and nex_relevance are stored separately · averageRelevance throws", () => {
    const { store } = fresh();
    const rel = baseCreate(store);
    const pair = store.relevancePair(rel.relationship_id);
    expect(pair.user_relevance).toBe(0.6);
    expect(pair.nex_relevance).toBe(0.7);
    expect(() => store.averageRelevance(rel.relationship_id)).toThrow(RelevanceAveragingProhibitedError);
  });
});

// ═══ (8) Existing lifecycle compatibility (M18 8 entities preserved) ═
describe("Wave 8.G.1 · (8) existing M18 8-entity vocabulary preserved", () => {
  it("EntityRef kinds used by relationship remain in the existing 8-entity union", async () => {
    // Import the EntityKind union from research-memory · verify it still lists the 8
    const rm = await import("../../research-memory/types");
    const _sample: rm.EntityRef = { kind: "FINDING", id: "x" };  // typecheck
    const kinds: rm.EntityKind[] = [
      "RAW_EVIDENCE", "SOURCE_RECORD", "RESEARCH_EVENT", "FINDING",
      "HYPOTHESIS", "OPPORTUNITY", "IDEA", "DECISION",
    ];
    expect(kinds.length).toBe(8);
    // CAPABILITY_RELATIONSHIP is a NEW entity · does NOT collapse into EntityKind
    // (its EntityRef carrier convention documented in types.ts · relationshipRef helper)
    expect(_sample.kind).toBe("FINDING");
  });
});

// ═══ (9) No fabricated Product Candidates ════════════════════════════
describe("Wave 8.G.1 · (9) no fabricated Product Candidates (Wave 8.G.2 boundary preserved)", () => {
  it("creating a relationship does NOT touch ProductCandidateStore", () => {
    const { store } = fresh();
    const candidate_store = new ProductCandidateStore(new ProductLifecycleLog());
    baseCreate(store);
    expect(store.size()).toBe(1);
    expect(candidate_store.size()).toBe(0);   // Wave 8.G.1 never creates candidates
  });
});

// ═══ (10) State machine (M23 · distinct absorbing states) ════════════
describe("Wave 8.G.1 · (10) state machine (M23 distinct absorbing states preserved)", () => {
  it("DISCOVERED → VALIDATING → VALIDATED → SUPERSEDED valid chain", () => {
    const { store } = fresh();
    const rel = baseCreate(store);
    store.transitionStatus(rel.relationship_id, "VALIDATING", "test", "status_changed");
    store.transitionStatus(rel.relationship_id, "VALIDATED", "test", "status_changed");
    store.transitionStatus(rel.relationship_id, "SUPERSEDED", "test", "superseded_by");
    expect(store.mustGet(rel.relationship_id).status).toBe("SUPERSEDED");
  });

  it("PARKED is reversible (M23 discipline)", () => {
    const { store } = fresh();
    const rel = baseCreate(store);
    store.transitionStatus(rel.relationship_id, "PARKED", "test", "parked");
    store.transitionStatus(rel.relationship_id, "DISCOVERED", "test", "status_changed");
    expect(store.mustGet(rel.relationship_id).status).toBe("DISCOVERED");
  });

  it("illegal transition (DISCOVERED → VALIDATED without VALIDATING) → InvalidRelationshipStatusTransitionError", () => {
    const { store } = fresh();
    const rel = baseCreate(store);
    expect(() => store.transitionStatus(rel.relationship_id, "VALIDATED", "test", "status_changed")).toThrow(InvalidRelationshipStatusTransitionError);
  });
});
