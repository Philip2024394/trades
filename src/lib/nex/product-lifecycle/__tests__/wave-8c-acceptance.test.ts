// src/lib/nex/product-lifecycle/__tests__/wave-8c-acceptance.test.ts
//
// UWI · Wave 8.C · Acceptance suite
// Founder-authorised programme (Rule 5o.T · capability → NEX Product doctrine).
//
// Proves:
//   1. §18 gates validator refuses vacuous/missing answers
//   2. §19 measurability triad enforced (reuses Wave 5 falsifiability)
//   3. §18 + §19 alignment check (§18.9 ↔ §19.predicted_effect · §18.10 ↔ §19.refutation_condition)
//   4. ProductCandidateStore.create enforces gates + triad + M22 relevance separation
//   5. Route registry defaults to "not_yet_created" (never invents routes · §22-§23)
//   6. State-machine transitions respect Wave 5 M23 distinct absorbing states
//   7. Multi-capability extraction returns MULTIPLE capabilities from one source (§5)
//   8. Multi-capability extraction returns SINGLE-cap when source only exhibits one signal
//   9. Multi-capability extraction returns UNKNOWN placeholder when source exhibits none
//  10. Opportunity → Product Candidate bridge · REJECT disposition blocks
//  11. Opportunity → Product Candidate bridge · insufficient gates → 'gates_insufficient' (Opportunity remains)
//  12. Opportunity → Product Candidate bridge · full gates + REBUILD disposition → Candidate created + provenance preserved
//  13. Multi-capability source → single audit produces multiple Candidates (one per capability)

import { describe, it, expect } from "vitest";
import {
  ProductCandidateStore,
  ProductLifecycleLog,
  bridgeOpportunityToProductCandidate,
  assertProductCandidateGates,
  assertProductCandidateReadiness,
  findVacuousGates,
  ProductCandidateGatesInsufficientError,
  InvalidProductStatusTransitionError,
  type ProductCandidateGates,
} from "..";
import { RelevanceAveragingProhibitedError, type FalsifiabilityCheck, type Opportunity } from "../../research-memory/types";
import { extractCapabilities } from "../../ecosystem/multi-capability-extraction";
import type { EcosystemFinding, EcosystemResource } from "../../ecosystem/types";

// ─── Helpers ────────────────────────────────────────────────────────
function fullGates(): ProductCandidateGates {
  return {
    what_user_problem: "Trades users need to trim and caption short site-visit videos on their phone without shipping footage to third-party AI",
    why_nex_needs_it: "NEX has no native video capability today · owning it strengthens the manufacturing/trades workflow surface",
    what_is_genuinely_new: "Combining NEX evidence + on-device WebCodecs export means the captions inherit NEX's project provenance, not just guess-based captions",
    evidence_supporting_opportunity: "Wave 8.A audit confirmed WebGL/WebCodecs primitives in the source; existing NEX capability graph shows no comparable module today",
    capability_creating_value: "WebGL compositor + WebCodecs export + timeline engine composed with NEX-native transcript memory",
    nex_can_build_technically: "All primitives are deterministic browser APIs; no external model required at runtime",
    nex_can_build_legally: "Source licence Apache-2.0 is NEX-compatible; clean-rebuild path preferred to keep NEX naming/UX consistent",
    nex_can_keep_runtime_clean: "Wave 8.A purity scan reports zero external LLM / hosted AI / model download",
    proof_product_works: "A user can trim, caption and export a 30-second site visit video in one continuous session with NEX-native evidence attached to each caption",
    proof_idea_is_wrong: "After two founder-user pilot sessions, no trades user completes the trim-caption-export flow · or ≥50% of captions require manual rewriting",
  };
}

function fullMeasurability(): FalsifiabilityCheck {
  return {
    predicted_effect: "Trades users complete short site-visit video trim/caption/export end-to-end inside NEX without leaving the app",
    measurable_outcome: "Number of NEX video projects successfully exported per week per active user · NEX evidence tagged onto ≥80% of exported captions",
    refutation_condition: "After two founder-user pilots, no user completes the full flow OR caption evidence tagging falls below 20%",
  };
}

function vacuousGates(): ProductCandidateGates {
  return {
    what_user_problem: "TBD",
    why_nex_needs_it: "",
    what_is_genuinely_new: "?",
    evidence_supporting_opportunity: "todo",
    capability_creating_value: "n/a",
    nex_can_build_technically: "unknown",
    nex_can_build_legally: "-",
    nex_can_keep_runtime_clean: "TBD",
    proof_product_works: "we will see",
    proof_idea_is_wrong: "we don't know",
  };
}

function stubFinding(overrides: Partial<EcosystemFinding> = {}): EcosystemFinding {
  const base: EcosystemFinding = {
    finding_id: "ecofinding:stub",
    resource: {
      ecosystem: "hugging_face",
      resource_kind: "space",
      id: "test-org/nex-video-source",
      source_url: "https://huggingface.co/spaces/test-org/nex-video-source",
      metadata: {},
      fetched_at_iso: new Date().toISOString(),
    },
    verdict: {
      what_it_does: "video timeline + WebGL compositor + WebCodecs export",
      licence: {
        checked_at_iso: new Date().toISOString(),
        spdx_identifier: "Apache-2.0",
        raw_license_text: "Apache-2.0",
        copyleft_class: "permissive",
        signals: {
          requires_attribution: true, requires_source_redistribution: false,
          requires_modification_disclosure: false, network_use_clause: false,
          patent_grant: true, commercial_use_permitted: true,
        },
        nex_compatible: true,
        requires_legal_review: false,
        notes: [],
      },
      dependencies_summary: { direct_count: 3, transitive_count: 8, notable: ["undici", "cheerio", "tailwindcss"] },
      runtime_purity: {
        checked_at_iso: new Date().toISOString(),
        external_llm_dependencies: [],
        external_embedding_apis: [],
        hosted_ai_services: [],
        cloud_service_dependencies: [],
        model_download_at_runtime: false,
        is_pure_for_nex_runtime: true,
        notes: [],
      },
      useful_technique: {
        checked_at_iso: new Date().toISOString(),
        capability_summary: "video editing pipeline",
        underlying_technique: "WebGL compositor + WebCodecs export + timeline engine",
        nex_reusable_directly: false,
        nex_rebuildable_natively: true,
        capability_category: "video_timeline",
        notes: [],
      },
      direct_reuse_verdict: { appropriate: false, reason: "Wave 8.C prefers clean rebuild to preserve NEX naming/UX" },
      clean_rebuild_verdict: { possible: true, reason: "All primitives are deterministic browser APIs" },
      opportunity_recommendation: {
        create_finding: true,
        create_hypothesis: true,
        create_opportunity: true,
        downgrade_to_observation: false,
        reason: "rebuildable + NEX-relevant + novel",
      },
    },
    disposition: "REBUILD",
    created_at_iso: new Date().toISOString(),
    nex_relevance: 0.75,
    user_relevance: 0.7,
    novelty_score: 0.6,
    provenance_chain: [
      { stage: "resource_fetched", at_iso: new Date().toISOString(), detail: "test-org/nex-video-source" },
      { stage: "licence_forensics", at_iso: new Date().toISOString(), detail: "permissive" },
    ],
  };
  return { ...base, ...overrides };
}

function stubOpportunity(): Opportunity {
  const now = new Date().toISOString();
  return {
    opportunity_id: "opp-1",
    created_at_iso: now,
    title: "Video-editing capability from HF source",
    summary_hypothesis: "NEX gains a video_timeline capability by clean-rebuilding the underlying technique",
    status: "DISCOVERED",
    hypothesis_refs: [],
    finding_refs: [{ kind: "FINDING", id: "ecofinding:stub" }],
    source_refs: [{ kind: "SOURCE_RECORD", id: "hugging_face:test-org/nex-video-source" }],
    signal_classes: ["video_timeline", "REBUILD"],
    affected_capabilities: ["video_timeline"],
    related_opportunity_ids: [],
    dependencies: [],
    supporting_signals: ["licence_class=permissive", "runtime_purity=pure", "capability_category=video_timeline", "disposition=REBUILD"],
    contradicting_signals: [],
    user_relevance: 0.7,   // M22 · SEPARATE
    nex_relevance: 0.75,   // M22 · SEPARATE
    last_reviewed_at_iso: now,
    next_review_at_iso: null,
    decay_window_ms: 30 * 24 * 60 * 60 * 1000,
    cost_cap_units: 100,
    cool_down_until_iso: null,
    confidence: 0.7,
    novelty_score: 0.6,
    provenance: { ecosystem_finding: "ecofinding:stub" },
  };
}

// ═══ §18 gates validator ══════════════════════════════════════════════
describe("Wave 8.C · §18 gates validator", () => {
  it("full 10 answers · assertProductCandidateGates passes", () => {
    expect(() => assertProductCandidateGates(fullGates(), "test")).not.toThrow();
    expect(findVacuousGates(fullGates()).length).toBe(0);
  });

  it("vacuous 10 answers · assertProductCandidateGates throws with all 10 listed", () => {
    let caught: unknown = null;
    try { assertProductCandidateGates(vacuousGates(), "test"); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ProductCandidateGatesInsufficientError);
    if (caught instanceof ProductCandidateGatesInsufficientError) {
      expect(caught.missing_or_vacuous.length).toBe(10);
    }
  });

  it("partial gates (5/10 answered) · findVacuousGates returns 5", () => {
    const half: ProductCandidateGates = { ...fullGates(), ...{
      nex_can_build_technically: "",
      nex_can_build_legally: "tbd",
      nex_can_keep_runtime_clean: "?",
      proof_product_works: "n/a",
      proof_idea_is_wrong: "-",
    } };
    expect(findVacuousGates(half).length).toBe(5);
  });
});

// ═══ §19 measurability triad + §18-§19 alignment ══════════════════════
describe("Wave 8.C · §19 measurability triad", () => {
  it("passing readiness check requires both gates + triad populated", () => {
    expect(() => assertProductCandidateReadiness(fullGates(), fullMeasurability(), "test")).not.toThrow();
  });

  it("empty predicted_effect fails readiness", () => {
    const bad: FalsifiabilityCheck = { predicted_effect: "", measurable_outcome: "x", refutation_condition: "y" };
    expect(() => assertProductCandidateReadiness(fullGates(), bad, "test")).toThrow();
  });

  it("empty refutation_condition fails readiness", () => {
    const bad: FalsifiabilityCheck = { predicted_effect: "x", measurable_outcome: "y", refutation_condition: "" };
    expect(() => assertProductCandidateReadiness(fullGates(), bad, "test")).toThrow();
  });
});

// ═══ ProductCandidateStore behaviour ══════════════════════════════════
describe("Wave 8.C · ProductCandidateStore", () => {
  function fresh() {
    const history = new ProductLifecycleLog();
    return { store: new ProductCandidateStore(history), history };
  }

  it("create · full gates + triad + relevance separate + routes default not_yet_created + status=PROPOSED", () => {
    const { store, history } = fresh();
    const c = store.create({
      product_name: "NEX Video Studio",
      product_category: "video_creation",
      problem_solved: "trades users need NEX-native video capture + caption",
      target_user: "field trades professionals",
      capability_origin: [{ kind: "OPPORTUNITY", id: "opp-1" }],
      source_provenance: [{ ecosystem: "hugging_face", source_url: "https://hf/x", resource_id: "test/nex-video-source" }],
      evidence: [{ kind: "audit_disposition", detail: "REBUILD" }],
      useful_underlying_technique: "WebGL + WebCodecs + timeline",
      nex_interpretation: "NEX-native video pipeline attached to project evidence",
      proposed_nex_experience: "trim → caption → export inside NEX",
      proposed_inputs: ["mp4", "webm"],
      proposed_outputs: ["mp4", "webm", "gif"],
      dependencies_summary: { notable: ["undici"], total_direct: 1, total_transitive: 3 },
      licence: { spdx_identifier: "Apache-2.0", copyleft_class: "permissive", nex_compatible: true, requires_legal_review: false },
      security: { risk_level: "low", notes: [] },
      runtime_purity: { is_pure_for_nex_runtime: true, notable_external_deps: [] },
      direct_reuse_verdict: { appropriate: false, reason: "prefer clean rebuild" },
      clean_rebuild_verdict: { possible: true, reason: "deterministic browser APIs" },
      novelty_assessment: { novelty_score: 0.6, rationale: "no comparable NEX module today" },
      user_relevance: 0.7,
      nex_relevance: 0.75,
      validation_gates: fullGates(),
      measurable_success: fullMeasurability(),
      actor: "wave-8c-test",
    });
    expect(c.status).toBe("PROPOSED");
    expect(c.routes.product.status).toBe("not_yet_created");
    expect(c.routes.product.path).toBe(null);
    expect(c.routes.page.status).toBe("not_yet_created");
    expect(c.routes.design.status).toBe("not_yet_created");
    expect(c.routes.engineering.status).toBe("not_yet_created");
    // M22 · relevance kept SEPARATE
    expect(c.user_relevance).toBe(0.7);
    expect(c.nex_relevance).toBe(0.75);
    expect(() => store.averageRelevance(c.candidate_id)).toThrow(RelevanceAveragingProhibitedError);
    expect(store.size()).toBe(1);
    expect(history.size()).toBe(1);
  });

  it("create · vacuous gates → refused at insert", () => {
    const { store } = fresh();
    expect(() => store.create({
      product_name: "x", product_category: "y", problem_solved: "z", target_user: "w",
      capability_origin: [], source_provenance: [], evidence: [],
      useful_underlying_technique: "t", nex_interpretation: "i",
      proposed_nex_experience: "e", proposed_inputs: [], proposed_outputs: [],
      dependencies_summary: { notable: [], total_direct: 0, total_transitive: 0 },
      licence: { spdx_identifier: null, copyleft_class: "unknown_or_missing", nex_compatible: false, requires_legal_review: true },
      security: { risk_level: "medium", notes: [] },
      runtime_purity: { is_pure_for_nex_runtime: true, notable_external_deps: [] },
      direct_reuse_verdict: { appropriate: false, reason: "r" },
      clean_rebuild_verdict: { possible: true, reason: "r" },
      novelty_assessment: { novelty_score: 0.5, rationale: "r" },
      user_relevance: 0.5, nex_relevance: 0.5,
      validation_gates: vacuousGates(),
      measurable_success: fullMeasurability(),
      actor: "test",
    })).toThrow(ProductCandidateGatesInsufficientError);
    expect(store.size()).toBe(0);
  });

  it("updateRoute · records route transition to live", () => {
    const { store, history } = fresh();
    const c = store.create({
      product_name: "NEX Video Studio", product_category: "video_creation",
      problem_solved: "p", target_user: "t",
      capability_origin: [], source_provenance: [], evidence: [],
      useful_underlying_technique: "t", nex_interpretation: "i",
      proposed_nex_experience: "e", proposed_inputs: [], proposed_outputs: [],
      dependencies_summary: { notable: [], total_direct: 0, total_transitive: 0 },
      licence: { spdx_identifier: "MIT", copyleft_class: "permissive", nex_compatible: true, requires_legal_review: false },
      security: { risk_level: "low", notes: [] },
      runtime_purity: { is_pure_for_nex_runtime: true, notable_external_deps: [] },
      direct_reuse_verdict: { appropriate: false, reason: "r" },
      clean_rebuild_verdict: { possible: true, reason: "r" },
      novelty_assessment: { novelty_score: 0.6, rationale: "r" },
      user_relevance: 0.6, nex_relevance: 0.7,
      validation_gates: fullGates(),
      measurable_success: fullMeasurability(),
      actor: "test",
    });
    store.updateRoute(c.candidate_id, "product", {
      status: "live", path: "/app/nex-video-studio", last_verified_at_iso: new Date().toISOString(),
    }, "test");
    const updated = store.mustGet(c.candidate_id);
    expect(updated.routes.product.status).toBe("live");
    expect(updated.routes.product.path).toBe("/app/nex-video-studio");
    expect(history.size()).toBe(2);
  });
});

// ═══ State-machine transitions ════════════════════════════════════════
describe("Wave 8.C · state-machine transitions (M23 distinct-absorbing preserved)", () => {
  function fresh() {
    const history = new ProductLifecycleLog();
    return { store: new ProductCandidateStore(history), history };
  }
  function createProposed(store: ProductCandidateStore) {
    return store.create({
      product_name: "x", product_category: "y", problem_solved: "z", target_user: "w",
      capability_origin: [], source_provenance: [], evidence: [],
      useful_underlying_technique: "t", nex_interpretation: "i",
      proposed_nex_experience: "e", proposed_inputs: [], proposed_outputs: [],
      dependencies_summary: { notable: [], total_direct: 0, total_transitive: 0 },
      licence: { spdx_identifier: "MIT", copyleft_class: "permissive", nex_compatible: true, requires_legal_review: false },
      security: { risk_level: "low", notes: [] },
      runtime_purity: { is_pure_for_nex_runtime: true, notable_external_deps: [] },
      direct_reuse_verdict: { appropriate: false, reason: "r" },
      clean_rebuild_verdict: { possible: true, reason: "r" },
      novelty_assessment: { novelty_score: 0.6, rationale: "r" },
      user_relevance: 0.6, nex_relevance: 0.7,
      validation_gates: fullGates(),
      measurable_success: fullMeasurability(),
      actor: "test",
    });
  }

  it("PROPOSED → VALIDATING → VALIDATED → READY_FOR_ENGINEERING → BUILDING → LIVE valid", () => {
    const { store } = fresh();
    const c = createProposed(store);
    store.transitionStatus(c.candidate_id, "VALIDATING", "actor", "validation_started");
    store.transitionStatus(c.candidate_id, "VALIDATED", "actor", "validation_passed");
    store.transitionStatus(c.candidate_id, "READY_FOR_ENGINEERING", "actor", "engineering_started");
    store.transitionStatus(c.candidate_id, "BUILDING", "actor", "engineering_started");
    store.transitionStatus(c.candidate_id, "LIVE", "actor", "gone_live");
    expect(store.mustGet(c.candidate_id).status).toBe("LIVE");
  });

  it("PROPOSED → LIVE (skip) invalid · throws InvalidProductStatusTransitionError", () => {
    const { store } = fresh();
    const c = createProposed(store);
    expect(() => store.transitionStatus(c.candidate_id, "LIVE", "actor", "gone_live")).toThrow(InvalidProductStatusTransitionError);
  });

  it("PARKED is reversible (M23 doctrine · PARKED ≠ terminal)", () => {
    const { store } = fresh();
    const c = createProposed(store);
    store.transitionStatus(c.candidate_id, "PARKED", "actor", "parked");
    store.transitionStatus(c.candidate_id, "PROPOSED", "actor", "candidate_created");
    expect(store.mustGet(c.candidate_id).status).toBe("PROPOSED");
  });
});

// ═══ Multi-capability extraction ══════════════════════════════════════
describe("Wave 8.C · multi-capability extraction (§5)", () => {
  const stubRes: EcosystemResource = {
    ecosystem: "hugging_face", resource_kind: "space", id: "test/video-studio",
    source_url: "https://hf/x", metadata: {}, fetched_at_iso: new Date().toISOString(),
  };

  it("multi-signal source → multiple capabilities returned separately", () => {
    const code_sample = `
      import { VideoEncoder } from "webcodecs";
      const gl = canvas.getContext("webgl");
      const shader = gl.compileShader(shader_program);
      const timeline = new TrackManager(); timeline.addKeyframe(0, 100);
      // mask_layer composited over alpha_channel
      new particle_system({ emit_particle });
    `;
    const r = extractCapabilities({ resource: stubRes, code_sample });
    const cats = r.capabilities.map(c => c.capability_category).sort();
    // Expect at least: webcodecs_export, webgl_rendering, video_timeline, image_masking, particle_system
    expect(cats).toContain("webcodecs_export");
    expect(cats).toContain("webgl_rendering");
    expect(cats).toContain("video_timeline");
    expect(cats).toContain("image_masking");
    expect(cats).toContain("particle_system");
    expect(r.capabilities.length).toBeGreaterThanOrEqual(5);
  });

  it("single-signal source → single capability returned", () => {
    const r = extractCapabilities({ resource: stubRes, code_sample: "import Tesseract from 'tesseract.js';" });
    expect(r.capabilities.length).toBe(1);
    expect(r.capabilities[0].capability_category).toBe("OCR");
  });

  it("no-signal source → single unknown-category placeholder (honest fallback)", () => {
    const r = extractCapabilities({ resource: stubRes, code_sample: "console.log('hello world');" });
    expect(r.capabilities.length).toBe(1);
    expect(r.capabilities[0].capability_category).toBe("unknown");
    expect(r.capabilities[0].nex_rebuildable_natively).toBe(false);
  });
});

// ═══ Opportunity → Product Candidate bridge ═══════════════════════════
describe("Wave 8.C · Opportunity → Product Candidate bridge", () => {
  function fresh() {
    const candidate_store = new ProductCandidateStore(new ProductLifecycleLog());
    return { candidate_store };
  }

  it("REJECT disposition · disposition_blocked (no Candidate)", () => {
    const { candidate_store } = fresh();
    const outcome = bridgeOpportunityToProductCandidate({
      opportunity: stubOpportunity(),
      finding: stubFinding({ disposition: "REJECT" }),
      product_name: "x", product_category: "y", problem_solved: "z", target_user: "w",
      nex_interpretation: "i", proposed_nex_experience: "e",
      proposed_inputs: [], proposed_outputs: [],
      validation_gates: fullGates(),
      measurable_success: fullMeasurability(),
      actor: "test",
    }, { candidate_store });
    expect(outcome.kind).toBe("disposition_blocked");
    expect(candidate_store.size()).toBe(0);
  });

  it("insufficient gates · gates_insufficient (Opportunity remains · no Candidate)", () => {
    const { candidate_store } = fresh();
    const outcome = bridgeOpportunityToProductCandidate({
      opportunity: stubOpportunity(),
      finding: stubFinding(),
      product_name: "x", product_category: "y", problem_solved: "z", target_user: "w",
      nex_interpretation: "i", proposed_nex_experience: "e",
      proposed_inputs: [], proposed_outputs: [],
      validation_gates: vacuousGates(),
      measurable_success: fullMeasurability(),
      actor: "test",
    }, { candidate_store });
    expect(outcome.kind).toBe("gates_insufficient");
    if (outcome.kind === "gates_insufficient") {
      expect(outcome.missing_or_vacuous.length).toBe(10);
      expect(outcome.reason).toContain("§18");
    }
    expect(candidate_store.size()).toBe(0);
  });

  it("REBUILD + full gates + full triad · candidate_created + provenance preserved", () => {
    const { candidate_store } = fresh();
    const outcome = bridgeOpportunityToProductCandidate({
      opportunity: stubOpportunity(),
      finding: stubFinding(),
      product_name: "NEX Video Studio",
      product_category: "video_creation",
      problem_solved: "trades video capability without external AI",
      target_user: "field trades professionals",
      nex_interpretation: "NEX-native video pipeline attached to project evidence",
      proposed_nex_experience: "trim → caption → export inside NEX with evidence tags",
      proposed_inputs: ["mp4", "webm"],
      proposed_outputs: ["mp4", "webm", "gif"],
      validation_gates: fullGates(),
      measurable_success: fullMeasurability(),
      actor: "test",
    }, { candidate_store });
    expect(outcome.kind).toBe("candidate_created");
    if (outcome.kind === "candidate_created") {
      const c = outcome.candidate;
      expect(c.status).toBe("PROPOSED");
      expect(c.capability_origin.length).toBe(2);
      expect(c.capability_origin[0].kind).toBe("OPPORTUNITY");
      expect(c.capability_origin[1].kind).toBe("FINDING");
      expect(c.source_provenance[0].ecosystem).toBe("hugging_face");
      expect(c.licence.spdx_identifier).toBe("Apache-2.0");
      expect(c.runtime_purity.is_pure_for_nex_runtime).toBe(true);
      // M22 relevance carried through SEPARATELY
      expect(c.user_relevance).toBe(0.7);
      expect(c.nex_relevance).toBe(0.75);
      // Routes default not-yet-created
      expect(c.routes.product.status).toBe("not_yet_created");
    }
    expect(candidate_store.size()).toBe(1);
  });

  it("multi-capability source → one bridge call per capability yields multiple Candidates", () => {
    const { candidate_store } = fresh();

    // Simulate: the audit produced 3 capabilities from one source
    const capabilities: ReadonlyArray<string> = ["video_timeline", "webgl_rendering", "webcodecs_export"];
    for (const cap of capabilities) {
      const finding = stubFinding({
        finding_id: `ecofinding:${cap}`,
        verdict: {
          ...stubFinding().verdict,
          useful_technique: {
            checked_at_iso: new Date().toISOString(),
            capability_summary: `${cap} capability`,
            underlying_technique: cap,
            nex_reusable_directly: false,
            nex_rebuildable_natively: true,
            capability_category: cap,
            notes: [],
          },
        },
      });
      const opportunity = { ...stubOpportunity(), opportunity_id: `opp-${cap}` };
      const outcome = bridgeOpportunityToProductCandidate({
        opportunity, finding,
        product_name: `NEX ${cap.toUpperCase()} Studio`,
        product_category: cap,
        problem_solved: `NEX-native ${cap} without external AI`,
        target_user: "trades professionals",
        nex_interpretation: `NEX-native ${cap}`,
        proposed_nex_experience: `use ${cap} inside NEX`,
        proposed_inputs: ["input"], proposed_outputs: ["output"],
        validation_gates: fullGates(),
        measurable_success: fullMeasurability(),
        actor: "test",
      }, { candidate_store });
      expect(outcome.kind).toBe("candidate_created");
    }
    // §5 satisfied · one source → multiple product candidates
    expect(candidate_store.size()).toBe(3);
    const names = candidate_store.all().map(c => c.product_category).sort();
    expect(names).toEqual(["video_timeline", "webcodecs_export", "webgl_rendering"]);
  });
});
