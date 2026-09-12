// src/lib/nex/knowledge-acquisition/pipeline.ts
//
// P1 REDIRECT · Knowledge Acquisition Capability · pipeline
// (Philip 2026-09-05 · corrective authorization)
//
// The 7-stage machinery: SOURCE → SNAPSHOT → EXTRACT → PROVENANCE
// → VERIFY → PROMOTE → RETRIEVE.
//
// Every stage:
//   1. Emits evidence into the append-only run history
//   2. Updates last_progress_at on the PipelineRun
//   3. NEVER sets its own final_status (deferred to status.ts)
//
// Composition with Operational Truth doctrine §16:
//   "A component can claim success. NEX must verify success."
// The pipeline emits raw evidence. The status evaluator verifies.
//
// Storage: filesystem JSON under data/knowledge-acquisition/
//   sources.json               - Stage 1
//   source-snapshots/          - Stage 2 (one file per snapshot)
//   candidate-claims.json      - Stage 3
//   provenance.json            - Stage 4
//   verifications.json         - Stage 5
//   promoted-knowledge.json    - Stage 6
//   runs.json                  - operational history (append-only)
//
// No database migration. Reversible. Composes with existing knowledge.ts
// loader for Stage 7 retrieval.

import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXTRACTORS, getExtractor } from "./extractors";
import type {
  CandidateClaim,
  PipelineResult,
  PipelineRun,
  PromotedKnowledge,
  Provenance,
  RunStage,
  Source,
  SourceSnapshot,
  VerificationOutcome,
} from "./types";

// ─── Storage layout ──────────────────────────────────────────────

function acquisitionDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../data/knowledge-acquisition");
}

const ACQ_ROOT = acquisitionDir();
const P_SOURCES = () => path.join(ACQ_ROOT, "sources.json");
const P_SNAPSHOTS_DIR = () => path.join(ACQ_ROOT, "source-snapshots");
const P_CLAIMS = () => path.join(ACQ_ROOT, "candidate-claims.json");
const P_PROV = () => path.join(ACQ_ROOT, "provenance.json");
const P_VERIF = () => path.join(ACQ_ROOT, "verifications.json");
const P_PROMOTED = () => path.join(ACQ_ROOT, "promoted-knowledge.json");
const P_RUNS = () => path.join(ACQ_ROOT, "runs.json");
const P_FIXTURES_DIR = () => path.join(ACQ_ROOT, "_fixtures");

function ensureDir(): void {
  if (!existsSync(ACQ_ROOT)) mkdirSync(ACQ_ROOT, { recursive: true });
  if (!existsSync(P_SNAPSHOTS_DIR())) mkdirSync(P_SNAPSHOTS_DIR(), { recursive: true });
  if (!existsSync(P_FIXTURES_DIR())) mkdirSync(P_FIXTURES_DIR(), { recursive: true });
}

function readJson<T>(p: string, fallback: T): T {
  try {
    if (!existsSync(p)) return fallback;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(p: string, data: unknown): void {
  ensureDir();
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function appendJsonArray<T>(p: string, item: T): void {
  const current = readJson<T[]>(p, []);
  current.push(item);
  writeJson(p, current);
}

// ─── Stage 1 · Source registry ───────────────────────────────────

export function registerSource(source: Source): void {
  const existing = readJson<Source[]>(P_SOURCES(), []);
  const idx = existing.findIndex((s) => s.source_id === source.source_id);
  if (idx >= 0) existing[idx] = source;
  else existing.push(source);
  writeJson(P_SOURCES(), existing);
}

export function listSources(): Source[] {
  return readJson<Source[]>(P_SOURCES(), []);
}

export function getSource(source_id: string): Source | null {
  return listSources().find((s) => s.source_id === source_id) ?? null;
}

// ─── Stage 2 · Snapshots ────────────────────────────────────────

export type IngestInput = {
  source_id: string;
  content?: string;
  structured?: unknown;
};

export function ingestSnapshot(input: IngestInput): SourceSnapshot {
  const rawText = input.content ?? (input.structured ? JSON.stringify(input.structured) : "");
  const content_hash = createHash("sha256").update(rawText).digest("hex");
  const snapshot: SourceSnapshot = {
    snapshot_id: randomUUID(),
    source_id: input.source_id,
    retrieved_at: new Date().toISOString(),
    content_ref: "",
    content_hash,
    bytes: Buffer.byteLength(rawText, "utf8"),
    content: input.content,
    structured: input.structured,
  };
  // Persist raw content for provenance audit
  ensureDir();
  const contentPath = path.join(P_SNAPSHOTS_DIR(), `${snapshot.snapshot_id}.json`);
  writeJson(contentPath, {
    snapshot_id: snapshot.snapshot_id,
    source_id: snapshot.source_id,
    retrieved_at: snapshot.retrieved_at,
    content_hash: snapshot.content_hash,
    bytes: snapshot.bytes,
    content: input.content ?? null,
    structured: input.structured ?? null,
  });
  snapshot.content_ref = contentPath;
  return snapshot;
}

// ─── Stage 3 · Extraction ────────────────────────────────────────

export function extractClaims(snapshot: SourceSnapshot, extractorIds: string[]): CandidateClaim[] {
  const claims: CandidateClaim[] = [];
  for (const id of extractorIds) {
    const ex = getExtractor(id);
    if (!ex) continue;
    claims.push(...ex.extract(snapshot));
  }
  // Persist candidates append-only
  if (claims.length > 0) {
    const existing = readJson<CandidateClaim[]>(P_CLAIMS(), []);
    writeJson(P_CLAIMS(), [...existing, ...claims]);
  }
  return claims;
}

// ─── Stage 4 · Provenance attribution ───────────────────────────

export function attributeProvenance(
  claims: CandidateClaim[],
  snapshot: SourceSnapshot,
): Provenance[] {
  const provs: Provenance[] = claims.map((c) => ({
    provenance_id: randomUUID(),
    claim_id: c.claim_id,
    source_id: snapshot.source_id,
    snapshot_id: snapshot.snapshot_id,
    extractor_id: c.extractor_id,
    attributed_at: new Date().toISOString(),
  }));
  if (provs.length > 0) {
    const existing = readJson<Provenance[]>(P_PROV(), []);
    writeJson(P_PROV(), [...existing, ...provs]);
  }
  return provs;
}

// ─── Stage 5 · Verification ─────────────────────────────────────

export type VerifyInput = {
  candidate: CandidateClaim;
  provenance: Provenance[];
  otherSnapshots: SourceSnapshot[];
  existingKnowledge: PromotedKnowledge[];
};

export function verifyClaim(input: VerifyInput): VerificationOutcome {
  const { candidate, provenance, otherSnapshots, existingKnowledge } = input;

  // Rule 3 · explicit contradiction check (from existing knowledge for same subject)
  const subjectLower = candidate.subject.toLowerCase();
  const predicateLower = candidate.predicate.toLowerCase();
  for (const k of existingKnowledge) {
    if (k.subject.toLowerCase() !== subjectLower) continue;
    if (!k.contradictions || k.contradictions.length === 0) continue;
    for (const forbidden of k.contradictions) {
      if (predicateLower.includes(forbidden.toLowerCase())) {
        return {
          claim_id: candidate.claim_id,
          outcome: "CONTRADICTED",
          contradicting_provenance: [],
          against: k.knowledge_id,
          verified_at: new Date().toISOString(),
          rule: 3,
        };
      }
    }
  }

  // Rule 4 · knowledge contradiction (different predicate for same subject)
  for (const k of existingKnowledge) {
    if (k.subject.toLowerCase() !== subjectLower) continue;
    if (k.predicate.toLowerCase() === predicateLower) continue;
    // Same subject, different predicate. Check if the new source is
    // higher authority (from provenance's snapshot's source authority tier).
    const provSourceIds = new Set(provenance.map((p) => p.source_id));
    const newSourceAuthorities = otherSnapshots
      .filter((s) => provSourceIds.has(s.source_id))
      .map((s) => (getSource(s.source_id)?.authority_tier ?? "community"));
    const newHasPrimary = newSourceAuthorities.includes("primary");
    if (!newHasPrimary) {
      return {
        claim_id: candidate.claim_id,
        outcome: "CONTRADICTED",
        contradicting_provenance: [],
        against: k.knowledge_id,
        verified_at: new Date().toISOString(),
        rule: 4,
      };
    }
    // Otherwise fall through — new primary source may supersede existing
  }

  // Rule 1 · multi-source agreement
  const provenanceSourceIds = new Set(provenance.map((p) => p.source_id));
  if (provenanceSourceIds.size >= 2) {
    return {
      claim_id: candidate.claim_id,
      outcome: "VERIFIED",
      supporting_provenance: provenance.map((p) => p.provenance_id),
      confidence: 0.85,
      verified_at: new Date().toISOString(),
      rule: 1,
    };
  }

  // Rule 2 · single primary-authority source
  const provSourceObjs = [...provenanceSourceIds].map((sid) => getSource(sid));
  const hasPrimaryAuthority = provSourceObjs.some((s) => s?.authority_tier === "primary");
  if (hasPrimaryAuthority) {
    return {
      claim_id: candidate.claim_id,
      outcome: "VERIFIED",
      supporting_provenance: provenance.map((p) => p.provenance_id),
      confidence: 0.9,
      verified_at: new Date().toISOString(),
      rule: 2,
    };
  }

  // Rule 5 · insufficient evidence
  return {
    claim_id: candidate.claim_id,
    outcome: "INSUFFICIENT_EVIDENCE",
    verified_at: new Date().toISOString(),
    rule: 5,
  };
}

export function persistVerifications(vs: VerificationOutcome[]): void {
  if (vs.length === 0) return;
  const existing = readJson<VerificationOutcome[]>(P_VERIF(), []);
  writeJson(P_VERIF(), [...existing, ...vs]);
}

// ─── Stage 6 · Promotion gate ───────────────────────────────────

export type PromotionInput = {
  candidate: CandidateClaim;
  verification: VerificationOutcome;
  provenance: Provenance[];
  run_id: string;
  from_source_tier: "authoritative" | "fixture";
  now?: string;
};

export function considerPromotion(input: PromotionInput): PromotedKnowledge | null {
  const { candidate, verification, provenance, run_id, from_source_tier } = input;
  const now = input.now ?? new Date().toISOString();

  const MIN_CONFIDENCE = Number(process.env.NEX_P1_PROMOTION_CONFIDENCE_MIN ?? "0.75");

  if (verification.outcome !== "VERIFIED") return null;
  if (verification.confidence < MIN_CONFIDENCE) return null;

  // Check freshness of the underlying snapshot(s) implicit via provenance timestamps
  // (skipped in v0 · promotion at time-of-run inherits its retrieval_at)

  // Determine stability from qualifiers (default stable)
  const qualifierStability = candidate.qualifiers?.stability as
    | "stable" | "seasonal" | "time_sensitive"
    | undefined;
  const stability = qualifierStability ?? "stable";

  return {
    knowledge_id: randomUUID(),
    claim_id: candidate.claim_id,
    subject: candidate.subject,
    predicate: candidate.predicate,
    qualifiers: candidate.qualifiers,
    confidence: verification.confidence,
    stability,
    promoted_at: now,
    from_run_id: run_id,
    from_provenance_ids: provenance.map((p) => p.provenance_id),
    provenance_kind: from_source_tier,
    contradictions: candidate.contradictions,
    superseded_at: null,
  };
}

export function persistPromotion(promoted: PromotedKnowledge): void {
  const existing = readJson<PromotedKnowledge[]>(P_PROMOTED(), []);
  // Supersession: if a live (non-superseded) promotion exists for the same subject+predicate, mark it superseded
  const now = promoted.promoted_at;
  const updated = existing.map((p) => {
    if (
      p.superseded_at === null &&
      p.subject.toLowerCase() === promoted.subject.toLowerCase() &&
      p.predicate.toLowerCase() !== promoted.predicate.toLowerCase()
    ) {
      return { ...p, superseded_at: now };
    }
    return p;
  });
  updated.push(promoted);
  writeJson(P_PROMOTED(), updated);
}

export function listPromoted(): PromotedKnowledge[] {
  return readJson<PromotedKnowledge[]>(P_PROMOTED(), []);
}

// ─── Operational history · append-only run records ───────────────

export function readRuns(): PipelineRun[] {
  return readJson<PipelineRun[]>(P_RUNS(), []);
}

export function persistRun(run: PipelineRun): void {
  const existing = readRuns();
  const idx = existing.findIndex((r) => r.run_id === run.run_id);
  if (idx >= 0) existing[idx] = run;
  else existing.push(run);
  writeJson(P_RUNS(), existing);
}

function emitStage(run: PipelineRun, stage: RunStage): void {
  run.last_progress_at = new Date().toISOString();
  run.evidence_pointers.push(`${stage}@${run.last_progress_at}`);
  // Persist incrementally so a crash mid-run leaves evidence for the
  // status evaluator to detect silence.
  persistRun(run);
}

// ─── Pipeline runner (composes stages 1-7) ───────────────────────

export type RunInput = {
  source_id: string;
  extractor_ids: string[];
  ingest: IngestInput;
  from_source_tier?: "authoritative" | "fixture";
  /** Test hook: throw before this stage to simulate a crash.
   *  Used by adversarial-silence tests · never used in production. */
  crashBeforeStage?: RunStage;
};

export function runPipeline(input: RunInput): PipelineResult {
  const run: PipelineRun = {
    run_id: randomUUID(),
    started_at: new Date().toISOString(),
    last_progress_at: new Date().toISOString(),
    completed_at: null,
    source_id: null,
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
    final_status: null,                  // NEVER set by pipeline · derived by status.ts
    evidence_pointers: [],
  };
  emitStage(run, "RUN_CREATED");
  const throwIfMatch = (stage: RunStage) => {
    if (input.crashBeforeStage === stage) {
      throw new Error(`__test_crash_before_${stage}`);
    }
  };

  try {
    // Stage 1 · Source access
    throwIfMatch("SOURCE_ACCESS");
    const source = getSource(input.source_id);
    if (!source) {
      run.failure_stage = "SOURCE_ACCESS";
      run.failure_reason = `unknown source_id ${input.source_id}`;
      persistRun(run);
      return { run, candidates: [], verifications: [], promoted: [] };
    }
    run.source_id = source.source_id;
    emitStage(run, "SOURCE_ACCESS");

    // Stage 2 · Snapshot
    throwIfMatch("SNAPSHOT_SUCCESS");
    const snapshot = ingestSnapshot(input.ingest);
    run.snapshot_id = snapshot.snapshot_id;
    run.snapshot_status = "SUCCESS";
    emitStage(run, "SNAPSHOT_SUCCESS");

    // Stage 3 · Extract
    throwIfMatch("EXTRACTION_SUCCESS");
    const claims = extractClaims(snapshot, input.extractor_ids);
    run.claims_extracted = claims.length;
    emitStage(run, "EXTRACTION_SUCCESS");

    // Stage 4 · Provenance
    throwIfMatch("CLAIMS_FOUND");
    const provs = attributeProvenance(claims, snapshot);
    emitStage(run, "CLAIMS_FOUND");

    // Stage 5 · Verify
    throwIfMatch("VERIFICATION_COMPLETED");
    const existingKnowledge = listPromoted();
    const verifications: VerificationOutcome[] = [];
    for (const c of claims) {
      const provsForClaim = provs.filter((p) => p.claim_id === c.claim_id);
      const v = verifyClaim({
        candidate: c,
        provenance: provsForClaim,
        otherSnapshots: [snapshot],
        existingKnowledge,
      });
      verifications.push(v);
    }
    persistVerifications(verifications);
    run.claims_verified = verifications.filter((v) => v.outcome === "VERIFIED").length;
    run.claims_rejected = verifications.filter(
      (v) => v.outcome === "CONTRADICTED" || v.outcome === "INSUFFICIENT_EVIDENCE" || v.outcome === "UNVERIFIED",
    ).length;
    emitStage(run, "VERIFICATION_COMPLETED");

    // Stage 6 · Promotion
    throwIfMatch("PROMOTION_DECISION");
    const promoted: PromotedKnowledge[] = [];
    const from_source_tier = input.from_source_tier ?? "authoritative";
    for (const c of claims) {
      const v = verifications.find((x) => x.claim_id === c.claim_id);
      if (!v) continue;
      const p = considerPromotion({
        candidate: c,
        verification: v,
        provenance: provs.filter((pr) => pr.claim_id === c.claim_id),
        run_id: run.run_id,
        from_source_tier,
      });
      if (p) {
        persistPromotion(p);
        promoted.push(p);
      }
    }
    run.claims_promoted = promoted.length;
    emitStage(run, "PROMOTION_DECISION");

    // Stage 7 · Complete
    throwIfMatch("RUN_COMPLETED");
    run.completed_at = new Date().toISOString();
    emitStage(run, "RUN_COMPLETED");

    return { run, candidates: claims, verifications, promoted };
  } catch (e) {
    // Mark failure stage from where we last emitted
    const lastStage = run.evidence_pointers.length > 0
      ? (run.evidence_pointers[run.evidence_pointers.length - 1].split("@")[0] as RunStage)
      : "RUN_CREATED";
    run.failure_stage = lastStage;
    run.failure_reason = e instanceof Error ? e.message : String(e);
    persistRun(run);
    // Re-throw only if the caller passed a crash-hint (test)
    if (input.crashBeforeStage) throw e;
    return { run, candidates: [], verifications: [], promoted: [] };
  }
}

// ─── Retrieval bridge (§7) ───────────────────────────────────────

/** Read promoted knowledge that qualifies for NEX retrieval.
 *  Fixture-derived knowledge is filtered out unless the env flag is set.
 *  Superseded records are always filtered out. */
export function readPromotedForRetrieval(): PromotedKnowledge[] {
  const all = listPromoted();
  const allowFixtures = process.env.NEX_P1_ALLOW_FIXTURE_KNOWLEDGE === "true";
  return all.filter((p) => {
    if (p.superseded_at !== null) return false;
    if (p.provenance_kind === "fixture" && !allowFixtures) return false;
    return true;
  });
}

// ─── Test hook (reset all persisted state) ──────────────────────

export function _resetPipelineStateForTests(): void {
  if (existsSync(P_SOURCES())) writeJson(P_SOURCES(), []);
  if (existsSync(P_CLAIMS())) writeJson(P_CLAIMS(), []);
  if (existsSync(P_PROV())) writeJson(P_PROV(), []);
  if (existsSync(P_VERIF())) writeJson(P_VERIF(), []);
  if (existsSync(P_PROMOTED())) writeJson(P_PROMOTED(), []);
  if (existsSync(P_RUNS())) writeJson(P_RUNS(), []);
}

/** Available extractor IDs (for callers building RunInput). */
export const EXTRACTOR_IDS = EXTRACTORS.map((e) => e.id);
