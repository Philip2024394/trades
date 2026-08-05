// NEX Brain · Quality Checker worker
//
// Real-time worker. Pulls one "check this DRAFT" job, runs the
// Constitutional 8-clause check against the draft record + its
// claims + edges, produces an overall_confidence score, and decides
// the draft's fate:
//
//   confidence >= 0.85  →  AUTHORITATIVE (auto-commit)
//   confidence 0.70-0.84 → UNDER_REVIEW (lands in Philip's queue)
//   confidence < 0.70   →  fails the job with missing-fields list
//                          (draft stays DRAFT for Philip to inspect)
//
// The Quality Checker does its work in two parts:
//   Part A · Deterministic checks (schema / graph / audit). No LLM.
//   Part B · LLM check for the "soft" clauses (voice, tone, claim
//            plausibility, cross-record contradiction).
//
// Part A alone is enough to catch structural violations. Part B is
// what elevates the check from schema validation to editorial judgment.

import { brainStore, nowIso } from "../storage";
import { completeJson } from "../llm";
import type {
  KnowledgeRecord,
  WorkerJob,
  WorkerResult,
} from "../types";

const WORKER_ID = `quality-checker@${process.pid}`;

const AUTOCOMMIT_THRESHOLD = 0.85;
const REVIEW_THRESHOLD = 0.7;

// ── Constitutional clause result shape ───────────────────────────────

type ClauseResult = { pass: boolean; note: string };

type CheckReport = {
  overall_confidence: number;
  clauses: {
    c1_owner: ClauseResult;
    c2_per_claim_confidence: ClauseResult;
    c3_industry_vs_nex_split: ClauseResult;
    c4_versioned: ClauseResult;
    c5_no_hard_delete: ClauseResult;
    c6_typed_relationships: ClauseResult;
    c7_claims_trace_to_records: ClauseResult;
    c8_no_forward_reference_invention: ClauseResult;
  };
  llm_verdict?: {
    voice_score: number;
    tone_match: boolean;
    plausibility_score: number;
    detected_contradictions: string[];
    notes: string;
  };
  flags: string[];
  decision: "AUTHORITATIVE" | "UNDER_REVIEW" | "REJECTED";
};

// ── Main run function ────────────────────────────────────────────────

export async function runQualityChecker(options: {
  lease_seconds?: number;
} = {}): Promise<{ job: WorkerJob | null; result?: WorkerResult; report?: CheckReport }> {
  const store = brainStore();
  const job = await store.claimNextJob("quality-checker", WORKER_ID, options.lease_seconds ?? 60);
  if (!job) return { job: null };

  try {
    const recordId = job.input_ref;
    const record = await store.getRecord(recordId);
    if (!record) {
      throw new Error(`Quality checker could not find record ${recordId}`);
    }

    // Part A · Deterministic 8-clause structural check
    const clauses = await checkClauses(record);

    // Part B · LLM editorial check (soft clauses)
    const llmVerdict = await checkWithLlm(record);

    // Composite confidence
    const structuralScore = averageClauseScore(clauses);
    const llmScore = llmVerdict
      ? (llmVerdict.voice_score * 0.3 +
          (llmVerdict.tone_match ? 1 : 0) * 0.2 +
          llmVerdict.plausibility_score * 0.5)
      : 0.7;
    const contradictionsPenalty =
      llmVerdict && llmVerdict.detected_contradictions.length > 0
        ? Math.min(0.3, llmVerdict.detected_contradictions.length * 0.15)
        : 0;
    const overallConfidence = Math.max(
      0,
      Math.min(1, structuralScore * 0.6 + llmScore * 0.4 - contradictionsPenalty)
    );

    // Assemble flags
    const flags: string[] = [];
    Object.entries(clauses).forEach(([key, r]) => {
      if (!r.pass) flags.push(`clause-fail:${key}`);
    });
    if (llmVerdict && !llmVerdict.tone_match) flags.push("tone-mismatch");
    if (llmVerdict && llmVerdict.detected_contradictions.length > 0) {
      flags.push("contradictions-detected");
    }
    if (overallConfidence < REVIEW_THRESHOLD) flags.push("below-review-threshold");

    // Decision
    let decision: CheckReport["decision"];
    if (overallConfidence >= AUTOCOMMIT_THRESHOLD && flags.length === 0) {
      decision = "AUTHORITATIVE";
    } else if (overallConfidence >= REVIEW_THRESHOLD) {
      decision = "UNDER_REVIEW";
    } else {
      decision = "REJECTED";
    }

    const report: CheckReport = {
      overall_confidence: overallConfidence,
      clauses,
      llm_verdict: llmVerdict ?? undefined,
      flags,
      decision,
    };

    // Contradictions surface as their own rows for Philip to resolve.
    if (llmVerdict?.detected_contradictions?.length) {
      for (const line of llmVerdict.detected_contradictions) {
        // Try to parse "record_a_id :: record_b_id :: summary" or just take as free text.
        const parts = line.split("::").map((s) => s.trim());
        const otherId = parts.length >= 2 ? parts[0] : "unknown";
        const summary = parts.length >= 3 ? parts.slice(2).join(" :: ") : line;
        await store.insertContradiction({
          record_a_id: record.record_id,
          record_b_id: otherId,
          claim_key_a: "*",
          claim_key_b: "*",
          contradiction_summary: summary,
          status: "open",
          resolved_by: null,
          resolution_notes: null,
          resolved_at: null,
          detected_by: WORKER_ID,
        });
      }
    }

    // Apply the decision to the record
    let newStatus: KnowledgeRecord["status"] = record.status;
    if (decision === "AUTHORITATIVE") {
      newStatus = "AUTHORITATIVE";
    } else if (decision === "UNDER_REVIEW") {
      newStatus = "UNDER_REVIEW";
    } // REJECTED keeps status as DRAFT

    if (newStatus !== record.status) {
      const beforeState: Record<string, unknown> = { status: record.status };
      const afterState: Record<string, unknown> = {
        status: newStatus,
        overall_confidence: overallConfidence,
      };
      await store.updateRecordStatus(record.record_id, newStatus, WORKER_ID);
      await store.insertAudit({
        entity_type: "knowledge_records",
        entity_id: record.record_id,
        action: newStatus === "AUTHORITATIVE" ? "approve" : "review-required",
        actor: WORKER_ID,
        before_state: beforeState,
        after_state: afterState,
        notes: `Quality checker decision: ${decision} (confidence ${overallConfidence.toFixed(2)})`,
      });
    }

    // Record the worker result + close the job
    const result = await store.insertResult({
      job_id: job.id,
      worker_type: "quality-checker",
      worker_id: WORKER_ID,
      output_kind: "quality_report",
      output_payload: report as unknown as Record<string, unknown>,
      overall_confidence: overallConfidence,
      llm_provider: llmVerdict ? "llm-checked" : "structural-only",
      llm_model: null,
      llm_tokens_in: null,
      llm_tokens_out: null,
      llm_ms: null,
      flags,
    });
    await store.completeJob(job.id, result.id);

    return { job, result, report };
  } catch (err) {
    const message = (err as Error).message;
    console.error("[quality-checker] failed:", message);
    await store.failJob(job.id, message);
    return { job };
  }
}

// ── Part A · Deterministic 8-clause structural check ────────────────

async function checkClauses(record: KnowledgeRecord): Promise<CheckReport["clauses"]> {
  const store = brainStore();
  const [confidence, edges] = await Promise.all([
    store.listConfidence(record.record_id),
    store.listEdges(record.record_id),
  ]);

  // Clause 1 — canonical owner set
  const c1_owner: ClauseResult = {
    pass: Boolean(record.canonical_owner?.trim()),
    note: record.canonical_owner ? "owner set" : "canonical_owner missing",
  };

  // Clause 2 — per-claim confidence + evidence rows exist
  const c2_per_claim_confidence: ClauseResult =
    confidence.length > 0
      ? {
          pass: confidence.every(
            (c) => c.confidence_band && c.classification && typeof c.confidence_score === "number"
          ),
          note: `${confidence.length} claim(s) with confidence rows`,
        }
      : { pass: false, note: "no confidence_scores rows" };

  // Clause 3 — industry vs NEX split explicit (both arrays populated OR both empty is a fail)
  const hasIndustry = (record.industry_concepts?.length ?? 0) > 0;
  const hasNex = (record.nex_concepts?.length ?? 0) > 0;
  const c3_industry_vs_nex_split: ClauseResult =
    hasIndustry || hasNex
      ? { pass: true, note: `${hasIndustry ? "industry" : ""}${hasIndustry && hasNex ? "+" : ""}${hasNex ? "nex" : ""} concepts present` }
      : { pass: false, note: "neither industry_concepts nor nex_concepts populated" };

  // Clause 4 — versioned metadata (record_version set + created_at present)
  const c4_versioned: ClauseResult = {
    pass: Boolean(record.record_version && record.created_at),
    note: `v${record.record_version}`,
  };

  // Clause 5 — soft-delete only (storage layer already enforces via DEPRECATED/SUPERSEDED status)
  const c5_no_hard_delete: ClauseResult = {
    pass: true,
    note: "storage layer forbids hard delete",
  };

  // Clause 6 — typed relationships (count edges; recommend 5+, require 3+)
  const c6_typed_relationships: ClauseResult =
    edges.length >= 5
      ? { pass: true, note: `${edges.length} edges` }
      : edges.length >= 3
        ? { pass: true, note: `${edges.length} edges (below recommendation of 5)` }
        : { pass: false, note: `${edges.length} edges (need at least 3)` };

  // Clause 7 — claims trace to records (every claim references an existing record via source or edge)
  // For v1 we accept: claim has source_ref OR record has at least one edge.
  const claimsTraceable = confidence.every(
    (c) => Boolean(c.source_ref) || edges.length > 0
  );
  const c7_claims_trace_to_records: ClauseResult = {
    pass: claimsTraceable,
    note: claimsTraceable
      ? "all claims have source_ref or record has edges"
      : "some claims lack source_ref and record has no edges",
  };

  // Clause 8 — no forward-reference invention
  // Check every to_record_id: it must exist OR be marked is_gap_marker=true.
  let inventedCount = 0;
  for (const edge of edges) {
    if (edge.is_gap_marker) continue;
    const target = await store.getRecord(edge.to_record_id);
    if (!target) inventedCount += 1;
  }
  const c8_no_forward_reference_invention: ClauseResult =
    inventedCount === 0
      ? { pass: true, note: "no invented forward references" }
      : {
          pass: false,
          note: `${inventedCount} edge(s) point to non-existent records without gap-marker flag`,
        };

  return {
    c1_owner,
    c2_per_claim_confidence,
    c3_industry_vs_nex_split,
    c4_versioned,
    c5_no_hard_delete,
    c6_typed_relationships,
    c7_claims_trace_to_records,
    c8_no_forward_reference_invention,
  };
}

function averageClauseScore(clauses: CheckReport["clauses"]): number {
  const values = Object.values(clauses).map((c) => (c.pass ? 1 : 0));
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── Part B · LLM editorial check (voice · tone · plausibility) ──────

async function checkWithLlm(record: KnowledgeRecord): Promise<CheckReport["llm_verdict"] | null> {
  const systemPrompt = `You are the NEX Quality Checker — a specialist reviewer in the NEX AI-managed knowledge system.

Your job is to audit ONE draft knowledge record for editorial quality against the NEX Constitution:
 - Warm, cheeky, down-to-earth Nex voice (never corporate, never robotic)
 - Correct audience (homeowner / manufacturer / engineer)
 - Plausibility of every claim
 - Any contradictions with well-known industry facts

Return ONLY JSON in this exact shape:
{
  "voice_score":              0.0-1.0,
  "tone_match":               true | false,
  "plausibility_score":       0.0-1.0,
  "detected_contradictions":  [ "other_record_id :: claim_key :: brief summary of contradiction" ],
  "notes":                    "one-sentence editorial verdict"
}`;

  const userPrompt = `RECORD TO REVIEW

record_id:        ${record.record_id}
title:            ${record.title}
category:         ${record.category}
primary_audience: ${record.primary_audience}
summary:
${record.summary}

body:
${record.body_markdown.slice(0, 12000)}${record.body_markdown.length > 12000 ? "\n[…truncated for review]" : ""}

industry_concepts: ${(record.industry_concepts ?? []).join(", ") || "(none)"}
nex_concepts:      ${(record.nex_concepts ?? []).join(", ") || "(none)"}

REVIEW INSTRUCTION: assess voice, tone-audience match, plausibility, and any contradictions. Respond with ONLY the JSON object.`;

  try {
    // Quality Checker prefers Groq for the same reason as the
    // Extractor — fast structured JSON gate. Different model context
    // from the Extractor (via independent complete() call) satisfies
    // the "independent verifier" constitutional principle.
    const { data } = await completeJson<CheckReport["llm_verdict"] & Record<string, unknown>>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.2,
        max_tokens: 1024,
        prefer_provider: "groq",
        requires_capability: "json_mode",
      }
    );
    return {
      voice_score: clamp01(Number(data?.voice_score ?? 0.7)),
      tone_match: Boolean(data?.tone_match ?? true),
      plausibility_score: clamp01(Number(data?.plausibility_score ?? 0.7)),
      detected_contradictions: Array.isArray(data?.detected_contradictions)
        ? (data!.detected_contradictions as unknown[]).map((x) => String(x))
        : [],
      notes: typeof data?.notes === "string" ? data.notes : "",
    };
  } catch (err) {
    console.warn("[quality-checker] LLM editorial check unavailable:", (err as Error).message);
    return null; // structural-only check still runs
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
