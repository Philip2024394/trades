// src/lib/nex/knowledge-acquisition/pipeline.test.ts
//
// P1 REDIRECT · Knowledge Acquisition Capability · unit + §OP tests
// (Philip 2026-09-05 · corrective authorization)

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerSource,
  listSources,
  ingestSnapshot,
  extractClaims,
  attributeProvenance,
  verifyClaim,
  considerPromotion,
  persistPromotion,
  listPromoted,
  readPromotedForRetrieval,
  runPipeline,
  readRuns,
  _resetPipelineStateForTests,
  EXTRACTOR_IDS,
} from "./pipeline";
import { deriveStatus, defaultStatusConfig } from "./status";
import {
  regexDefinitionalExtractor,
  structuredJsonExtractor,
  manualControlledExtractor,
} from "./extractors";
import type { CandidateClaim, PipelineRun, PromotedKnowledge, Source } from "./types";
import { randomUUID } from "node:crypto";

beforeEach(() => {
  _resetPipelineStateForTests();
});

// ─── §OP.2 · Type + registry sanity ──────────────────────────────

describe("P1 · source registry", () => {
  it("registerSource + listSources · rejects nothing but upserts by id", () => {
    const s1: Source = {
      source_id: "wco.hs2022",
      authority: "WCO",
      authority_tier: "primary",
      retrieval_policy: "static_reference",
      covers_domain: ["seafood.hs"],
    };
    registerSource(s1);
    expect(listSources()).toHaveLength(1);
    // Re-register with different payload → upserts
    registerSource({ ...s1, authority: "WCO-updated" });
    const list = listSources();
    expect(list).toHaveLength(1);
    expect(list[0].authority).toBe("WCO-updated");
  });
});

// ─── Extractors ───────────────────────────────────────────────────

describe("P1 · regex.definitional extractor", () => {
  it("extracts SUBJECT is/refers-to/covers PREDICATE claims from prose", () => {
    const snapshot = ingestSnapshot({
      source_id: "test-src",
      content:
        "HS heading 0304 covers fish fillets and other fish meat, fresh, chilled or frozen. Canned fish is HS 1604.",
    });
    const claims = regexDefinitionalExtractor.extract(snapshot);
    expect(claims.length).toBeGreaterThan(0);
    const subjectStrings = claims.map((c) => c.subject.toLowerCase());
    expect(subjectStrings.some((s) => s.includes("0304"))).toBe(true);
    for (const c of claims) {
      expect(c.status).toBe("candidate");
      expect(c.extractor_id).toBe("regex.definitional");
      expect(c.extracted_from).toBe(snapshot.snapshot_id);
    }
  });

  it("returns [] on empty content", () => {
    const snapshot = ingestSnapshot({ source_id: "test-src", content: "" });
    expect(regexDefinitionalExtractor.extract(snapshot)).toHaveLength(0);
  });
});

describe("P1 · structured.json extractor", () => {
  it("passes structured claims through unchanged (as candidates)", () => {
    const snapshot = ingestSnapshot({
      source_id: "test-src",
      structured: [
        { subject: "HS 0304", predicate: "fish fillets and other fish meat", contradictions: ["canned"] },
        { subject: "HS 1604", predicate: "prepared or preserved fish" },
      ],
    });
    const claims = structuredJsonExtractor.extract(snapshot);
    expect(claims).toHaveLength(2);
    expect(claims[0].contradictions).toContain("canned");
    expect(claims[0].extractor_id).toBe("structured.json");
  });

  it("returns [] on non-array structured payload", () => {
    const snapshot = ingestSnapshot({
      source_id: "test-src",
      structured: { not: "an array" },
    });
    expect(structuredJsonExtractor.extract(snapshot)).toHaveLength(0);
  });
});

describe("P1 · manual.controlled extractor", () => {
  it("honours the manual extractor_id marker for hand-authored claims", () => {
    const snapshot = ingestSnapshot({
      source_id: "test-src",
      structured: [{ subject: "TEST-1", predicate: "hand-authored fixture" }],
    });
    const claims = manualControlledExtractor.extract(snapshot);
    expect(claims).toHaveLength(1);
    expect(claims[0].extractor_id).toBe("manual.controlled");
  });
});

// ─── Provenance ──────────────────────────────────────────────────

describe("P1 · provenance attribution", () => {
  it("produces one provenance row per candidate + snapshot pair", () => {
    const snapshot = ingestSnapshot({
      source_id: "src-a",
      content: "HS 0304 refers to fish fillets. HS 0303 refers to frozen fish.",
    });
    const claims = regexDefinitionalExtractor.extract(snapshot);
    const provs = attributeProvenance(claims, snapshot);
    expect(provs).toHaveLength(claims.length);
    for (const p of provs) {
      expect(p.snapshot_id).toBe(snapshot.snapshot_id);
      expect(p.source_id).toBe("src-a");
      expect(p.claim_id).toBeTruthy();
    }
  });
});

// ─── Verification rules ──────────────────────────────────────────

describe("P1 · verification rules", () => {
  const baseCandidate = (): CandidateClaim => ({
    claim_id: randomUUID(),
    subject: "HS 0304",
    predicate: "fish fillets and other fish meat",
    extracted_from: "snap-1",
    extractor_id: "structured.json",
    extracted_at: new Date().toISOString(),
    status: "candidate",
  });

  it("Rule 1 · multi-source agreement → VERIFIED conf 0.85", () => {
    registerSource({ source_id: "src-a", authority: "A", authority_tier: "research", retrieval_policy: "manual_snapshot", covers_domain: [] });
    registerSource({ source_id: "src-b", authority: "B", authority_tier: "research", retrieval_policy: "manual_snapshot", covers_domain: [] });
    const candidate = baseCandidate();
    const provenance = [
      { provenance_id: "p1", claim_id: candidate.claim_id, source_id: "src-a", snapshot_id: "s-a", extractor_id: "structured.json", attributed_at: new Date().toISOString() },
      { provenance_id: "p2", claim_id: candidate.claim_id, source_id: "src-b", snapshot_id: "s-b", extractor_id: "structured.json", attributed_at: new Date().toISOString() },
    ];
    const v = verifyClaim({ candidate, provenance, otherSnapshots: [], existingKnowledge: [] });
    expect(v.outcome).toBe("VERIFIED");
    if (v.outcome === "VERIFIED") {
      expect(v.rule).toBe(1);
      expect(v.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("Rule 2 · single primary authority → VERIFIED conf 0.9", () => {
    registerSource({ source_id: "wco.hs2022", authority: "WCO", authority_tier: "primary", retrieval_policy: "static_reference", covers_domain: ["seafood.hs"] });
    const candidate = baseCandidate();
    const provenance = [
      { provenance_id: "p1", claim_id: candidate.claim_id, source_id: "wco.hs2022", snapshot_id: "s-1", extractor_id: "structured.json", attributed_at: new Date().toISOString() },
    ];
    const v = verifyClaim({ candidate, provenance, otherSnapshots: [], existingKnowledge: [] });
    expect(v.outcome).toBe("VERIFIED");
    if (v.outcome === "VERIFIED") expect(v.rule).toBe(2);
  });

  it("Rule 3 · explicit contradiction match → CONTRADICTED", () => {
    registerSource({ source_id: "src-a", authority: "A", authority_tier: "research", retrieval_policy: "manual_snapshot", covers_domain: [] });
    const existing: PromotedKnowledge[] = [{
      knowledge_id: "k1",
      claim_id: "c-prior",
      subject: "HS 0304",
      predicate: "fish fillets and other fish meat, fresh, chilled or frozen",
      confidence: 0.9,
      stability: "stable",
      promoted_at: new Date().toISOString(),
      from_run_id: "r0",
      from_provenance_ids: [],
      provenance_kind: "authoritative",
      contradictions: ["canned", "prepared or preserved"],
      superseded_at: null,
    }];
    const candidate: CandidateClaim = {
      ...baseCandidate(),
      predicate: "canned fish products",
    };
    const provenance = [
      { provenance_id: "p1", claim_id: candidate.claim_id, source_id: "src-a", snapshot_id: "s-a", extractor_id: "structured.json", attributed_at: new Date().toISOString() },
    ];
    const v = verifyClaim({ candidate, provenance, otherSnapshots: [], existingKnowledge: existing });
    expect(v.outcome).toBe("CONTRADICTED");
    if (v.outcome === "CONTRADICTED") expect(v.rule).toBe(3);
  });

  it("Rule 5 · single research-tier source → INSUFFICIENT_EVIDENCE", () => {
    registerSource({ source_id: "blog.a", authority: "some-blog", authority_tier: "community", retrieval_policy: "manual_snapshot", covers_domain: [] });
    const candidate = baseCandidate();
    const provenance = [
      { provenance_id: "p1", claim_id: candidate.claim_id, source_id: "blog.a", snapshot_id: "s-1", extractor_id: "structured.json", attributed_at: new Date().toISOString() },
    ];
    const v = verifyClaim({ candidate, provenance, otherSnapshots: [], existingKnowledge: [] });
    expect(v.outcome).toBe("INSUFFICIENT_EVIDENCE");
  });
});

// ─── Promotion gate ──────────────────────────────────────────────

describe("P1 · promotion gate", () => {
  it("only VERIFIED + confidence + no-contradiction → promoted", () => {
    const candidate: CandidateClaim = {
      claim_id: randomUUID(),
      subject: "HS 0304",
      predicate: "fish fillets and other fish meat",
      extracted_from: "s1",
      extractor_id: "structured.json",
      extracted_at: new Date().toISOString(),
      status: "candidate",
    };
    const okPromotion = considerPromotion({
      candidate,
      verification: {
        claim_id: candidate.claim_id,
        outcome: "VERIFIED",
        supporting_provenance: ["p1"],
        confidence: 0.9,
        verified_at: new Date().toISOString(),
        rule: 2,
      },
      provenance: [],
      run_id: "r1",
      from_source_tier: "authoritative",
    });
    expect(okPromotion).not.toBeNull();

    const rejected = considerPromotion({
      candidate,
      verification: {
        claim_id: candidate.claim_id,
        outcome: "INSUFFICIENT_EVIDENCE",
        verified_at: new Date().toISOString(),
        rule: 5,
      },
      provenance: [],
      run_id: "r1",
      from_source_tier: "authoritative",
    });
    expect(rejected).toBeNull();
  });

  it("supersession · newer promotion on same subject marks older superseded", () => {
    persistPromotion({
      knowledge_id: "k1",
      claim_id: "c1",
      subject: "HS 0304",
      predicate: "OLD predicate",
      confidence: 0.9,
      stability: "stable",
      promoted_at: "2026-09-01T00:00:00Z",
      from_run_id: "r0",
      from_provenance_ids: [],
      provenance_kind: "authoritative",
      superseded_at: null,
    });
    persistPromotion({
      knowledge_id: "k2",
      claim_id: "c2",
      subject: "HS 0304",
      predicate: "NEW predicate",
      confidence: 0.9,
      stability: "stable",
      promoted_at: "2026-09-05T00:00:00Z",
      from_run_id: "r1",
      from_provenance_ids: [],
      provenance_kind: "authoritative",
      superseded_at: null,
    });
    const all = listPromoted();
    const old = all.find((p) => p.knowledge_id === "k1")!;
    const fresh = all.find((p) => p.knowledge_id === "k2")!;
    expect(old.superseded_at).not.toBeNull();
    expect(fresh.superseded_at).toBeNull();
  });
});

// ─── Retrieval filter ────────────────────────────────────────────

describe("P1 · retrieval filter", () => {
  it("fixture-tagged promotion does NOT surface without env flag", () => {
    persistPromotion({
      knowledge_id: "kf",
      claim_id: "cf",
      subject: "test",
      predicate: "fixture data",
      confidence: 0.9,
      stability: "stable",
      promoted_at: new Date().toISOString(),
      from_run_id: "r-fix",
      from_provenance_ids: [],
      provenance_kind: "fixture",
      superseded_at: null,
    });
    delete process.env.NEX_P1_ALLOW_FIXTURE_KNOWLEDGE;
    expect(readPromotedForRetrieval()).toHaveLength(0);
    process.env.NEX_P1_ALLOW_FIXTURE_KNOWLEDGE = "true";
    expect(readPromotedForRetrieval()).toHaveLength(1);
    delete process.env.NEX_P1_ALLOW_FIXTURE_KNOWLEDGE;
  });

  it("superseded promotion is filtered out", () => {
    persistPromotion({
      knowledge_id: "kold",
      claim_id: "cold",
      subject: "test",
      predicate: "old",
      confidence: 0.9,
      stability: "stable",
      promoted_at: "2026-09-01T00:00:00Z",
      from_run_id: "r0",
      from_provenance_ids: [],
      provenance_kind: "authoritative",
      superseded_at: "2026-09-05T00:00:00Z",
    });
    expect(readPromotedForRetrieval()).toHaveLength(0);
  });
});

// ─── §OP · Operational Proof · pipeline-run history ──────────────

describe("§OP · pipeline run history", () => {
  it("every runPipeline invocation persists a PipelineRun with completed_at + counts", () => {
    registerSource({ source_id: "wco.hs2022", authority: "WCO", authority_tier: "primary", retrieval_policy: "static_reference", covers_domain: ["seafood.hs"] });
    const result = runPipeline({
      source_id: "wco.hs2022",
      extractor_ids: ["structured.json"],
      ingest: {
        source_id: "wco.hs2022",
        structured: [
          { subject: "HS 0304", predicate: "fish fillets and other fish meat, fresh, chilled or frozen" },
        ],
      },
      from_source_tier: "authoritative",
    });
    expect(result.run.completed_at).not.toBeNull();
    expect(result.run.snapshot_status).toBe("SUCCESS");
    expect(result.run.claims_extracted).toBe(1);
    expect(result.run.claims_verified).toBe(1);
    expect(result.run.claims_promoted).toBe(1);
    expect(result.run.evidence_pointers.length).toBeGreaterThanOrEqual(7);

    const persistedRuns = readRuns();
    expect(persistedRuns).toHaveLength(1);
    expect(persistedRuns[0].run_id).toBe(result.run.run_id);
  });

  it("pipeline NEVER sets its own final_status", () => {
    registerSource({ source_id: "wco.hs2022", authority: "WCO", authority_tier: "primary", retrieval_policy: "static_reference", covers_domain: [] });
    const result = runPipeline({
      source_id: "wco.hs2022",
      extractor_ids: ["structured.json"],
      ingest: { source_id: "wco.hs2022", structured: [{ subject: "X", predicate: "y" }] },
    });
    expect(result.run.final_status).toBeNull();
    const persisted = readRuns()[0];
    expect(persisted.final_status).toBeNull();
  });

  it("emitStage discipline · progress evidence appears in the run record before completion", () => {
    // Register + partial run that crashes mid-way
    registerSource({ source_id: "wco.hs2022", authority: "WCO", authority_tier: "primary", retrieval_policy: "static_reference", covers_domain: [] });
    try {
      runPipeline({
        source_id: "wco.hs2022",
        extractor_ids: ["structured.json"],
        ingest: { source_id: "wco.hs2022", structured: [{ subject: "X", predicate: "y" }] },
        crashBeforeStage: "EXTRACTION_SUCCESS",
      });
    } catch { /* expected */ }
    const persisted = readRuns()[0];
    // Prior stages (RUN_CREATED, SOURCE_ACCESS, SNAPSHOT_SUCCESS) all emitted evidence
    expect(persisted.evidence_pointers.some((e) => e.startsWith("RUN_CREATED"))).toBe(true);
    expect(persisted.evidence_pointers.some((e) => e.startsWith("SOURCE_ACCESS"))).toBe(true);
    expect(persisted.evidence_pointers.some((e) => e.startsWith("SNAPSHOT_SUCCESS"))).toBe(true);
    expect(persisted.evidence_pointers.some((e) => e.startsWith("EXTRACTION_SUCCESS"))).toBe(false);
    expect(persisted.failure_stage).toBe("SNAPSHOT_SUCCESS"); // last emitted stage before crash
    expect(persisted.completed_at).toBeNull();
  });
});

// ─── §OP · Derived status ────────────────────────────────────────

describe("§OP · derived status (evidence-first · never self-asserted)", () => {
  const config = (nowMs: number) => ({
    ...defaultStatusConfig(nowMs),
    staleProgressMs: 60_000,             // 1 min for tests
    workDeadlineMs: 5 * 60_000,          // 5 min for tests
    invocationWindowMs: 60 * 60_000,     // 1h for tests
  });

  it("empty runs → NEVER_PROVEN", () => {
    const r = deriveStatus([], config(Date.now()));
    expect(r.status).toBe("NEVER_PROVEN");
  });

  it("recent successful run → PROVEN_HEALTHY", () => {
    const now = Date.parse("2026-09-05T12:00:00Z");
    const run: PipelineRun = {
      run_id: "r1",
      started_at: new Date(now - 60_000).toISOString(),
      last_progress_at: new Date(now - 60_000).toISOString(),
      completed_at: new Date(now - 30_000).toISOString(),
      source_id: "s1",
      snapshot_id: "sn1",
      snapshot_status: "SUCCESS",
      claims_extracted: 2,
      claims_verified: 2,
      claims_rejected: 0,
      claims_promoted: 2,
      failure_stage: null,
      failure_reason: null,
      retry_count: 0,
      recovery_result: "NOT_ATTEMPTED",
      final_status: null,
      evidence_pointers: [],
    };
    const r = deriveStatus([run], config(now));
    expect(r.status).toBe("PROVEN_HEALTHY");
  });

  it("stale run (silence > staleProgressMs) → FAILED (adversarial-silence detection)", () => {
    const now = Date.parse("2026-09-05T12:00:00Z");
    const staleRun: PipelineRun = {
      run_id: "rs",
      started_at: new Date(now - 10 * 60_000).toISOString(),
      last_progress_at: new Date(now - 10 * 60_000).toISOString(), // 10min old · > 1min stale threshold
      completed_at: null,                                          // never completed
      source_id: "s1",
      snapshot_id: null,
      snapshot_status: "PENDING",
      claims_extracted: 0,
      claims_verified: 0,
      claims_rejected: 0,
      claims_promoted: 0,
      failure_stage: null,
      failure_reason: null,
      retry_count: 0,
      recovery_result: "NOT_ATTEMPTED",
      final_status: null,
      evidence_pointers: ["RUN_CREATED@..."],
    };
    const r = deriveStatus([staleRun], config(now));
    expect(r.status).toBe("FAILED");
    expect(r.reason).toMatch(/stale|silence/i);
  });

  it("recovery exhausted → FAILED", () => {
    const now = Date.parse("2026-09-05T12:00:00Z");
    const run: PipelineRun = {
      run_id: "rx",
      started_at: new Date(now - 60_000).toISOString(),
      last_progress_at: new Date(now - 30_000).toISOString(),
      completed_at: null,
      source_id: "s1",
      snapshot_id: null,
      snapshot_status: "FAILED",
      claims_extracted: 0,
      claims_verified: 0,
      claims_rejected: 0,
      claims_promoted: 0,
      failure_stage: "SNAPSHOT_SUCCESS",
      failure_reason: "http timeout",
      retry_count: 3,
      recovery_result: "EXHAUSTED",
      final_status: null,
      evidence_pointers: [],
    };
    const r = deriveStatus([run], config(now));
    expect(r.status).toBe("FAILED");
    expect(r.reason).toMatch(/recovery exhausted/i);
  });

  it("last successful run beyond workDeadline → FAILED", () => {
    const now = Date.parse("2026-09-05T12:00:00Z");
    const oldSuccessful: PipelineRun = {
      run_id: "old",
      started_at: new Date(now - 60 * 60_000).toISOString(),
      last_progress_at: new Date(now - 60 * 60_000).toISOString(),
      completed_at: new Date(now - 60 * 60_000).toISOString(),  // 1h ago · > 5min workDeadline
      source_id: "s1",
      snapshot_id: "sn1",
      snapshot_status: "SUCCESS",
      claims_extracted: 1,
      claims_verified: 1,
      claims_rejected: 0,
      claims_promoted: 1,
      failure_stage: null,
      failure_reason: null,
      retry_count: 0,
      recovery_result: "NOT_ATTEMPTED",
      final_status: null,
      evidence_pointers: [],
    };
    const r = deriveStatus([oldSuccessful], config(now));
    expect(r.status).toBe("FAILED");
    expect(r.reason).toMatch(/work deadline/i);
  });
});

// ─── End-to-end pipeline proof on fixture-shaped data ────────────

describe("P1 · end-to-end pipeline on fixture data (no manual seafood knowledge in production)", () => {
  it("SOURCE → SNAPSHOT → EXTRACT → PROVENANCE → VERIFY → PROMOTE end-to-end", () => {
    registerSource({
      source_id: "fixture.wco.hs",
      authority: "WCO-fixture",
      authority_tier: "primary",
      retrieval_policy: "static_reference",
      covers_domain: ["seafood.hs"],
    });
    const result = runPipeline({
      source_id: "fixture.wco.hs",
      extractor_ids: ["structured.json"],
      ingest: {
        source_id: "fixture.wco.hs",
        structured: [
          { subject: "HS 0304", predicate: "fish fillets and other fish meat, fresh, chilled or frozen", contradictions: ["canned", "prepared or preserved"] },
          { subject: "HS 1604", predicate: "prepared or preserved fish including canned tuna" },
        ],
      },
      from_source_tier: "fixture",
    });
    expect(result.run.completed_at).not.toBeNull();
    expect(result.candidates).toHaveLength(2);
    expect(result.verifications.every((v) => v.outcome === "VERIFIED")).toBe(true);
    expect(result.promoted).toHaveLength(2);
    for (const p of result.promoted) {
      expect(p.provenance_kind).toBe("fixture");
    }
  });

  it("contradiction fixture · newer 'canned' claim on HS 0304 is REJECTED against existing contradictions", () => {
    // Seed correct HS 0304 knowledge as if from an earlier run
    persistPromotion({
      knowledge_id: "k-0304",
      claim_id: "c-0304",
      subject: "HS 0304",
      predicate: "fish fillets and other fish meat, fresh, chilled or frozen",
      confidence: 0.9,
      stability: "stable",
      promoted_at: "2026-09-05T00:00:00Z",
      from_run_id: "r-seed",
      from_provenance_ids: [],
      provenance_kind: "fixture",
      contradictions: ["canned", "canning", "prepared or preserved"],
      superseded_at: null,
    });
    registerSource({
      source_id: "fixture.bad",
      authority: "bad-source",
      authority_tier: "community",
      retrieval_policy: "manual_snapshot",
      covers_domain: [],
    });
    const result = runPipeline({
      source_id: "fixture.bad",
      extractor_ids: ["structured.json"],
      ingest: {
        source_id: "fixture.bad",
        structured: [{ subject: "HS 0304", predicate: "canned processed fish products" }],
      },
      from_source_tier: "fixture",
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.verifications[0].outcome).toBe("CONTRADICTED");
    expect(result.promoted).toHaveLength(0);
    expect(result.run.claims_rejected).toBe(1);
    expect(result.run.claims_promoted).toBe(0);
  });
});
