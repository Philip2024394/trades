// NEX Brain · Knowledge Extractor worker
//
// Real-time worker. Pulls one "extract from inbox item" job, sends the
// inbox item's content to the LLM with the NEX Golden Rule template
// system prompt PLUS the context bundle produced by the upstream
// Knowledge Context Worker (Philip 2026-08-06 · "NEX writes with
// memory, not in isolation"), parses the structured output into one
// or more candidate KnowledgeRecord drafts, writes them (status = DRAFT),
// writes typed graph edges + per-claim confidence rows + source
// lineage, then enqueues a quality-check job for each new draft.
//
// The Extractor does NOT commit records as AUTHORITATIVE — that is
// the Quality Checker's job. It authors the draft and hands off.
//
// Corpus-awareness contract (v2 · post-Context-Worker):
//   input_payload.context_bundle contains up to 10 related existing
//   records. The Extractor MUST prefer typed edges to those over
//   re-authoring their content. Only NEW information becomes a new
//   record; overlapping information becomes an edge.
//
// Contract:
//   input_kind = 'inbox_item'
//   input_ref  = the inbox item's id
//   input_payload = { source, title, contentPath|content|url,
//                     context_bundle: ContextBundle }

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { brainStore, nowIso } from "../storage";
// Wave 11 · Step 8 · F35 · shared finalization sequence.
import { finalizeWorkerJob, failWorkerJob } from "./_finalize";
// W-OBS-1 Path A Layer 1 · CID inherit from job.input_payload.
import { enterJobCorrelationScope } from "@/lib/nex/observability/correlation";
// F4 structured logger · Wave 3 H2.b · adopted 2026-08-10.
import { logger } from "@/lib/nex/observability/logger";

const log = logger("worker.knowledge-extractor");
import { complete, completeJson } from "../llm";
import type {
  Audience,
  ClaimClassification,
  ConfidenceBand,
  KnowledgeSource,
  WorkerJob,
  WorkerResult,
} from "../types";
import { updateJob as updateKnowledgeJob } from "@/lib/nex/jobs/fs-store";
// Wave 11 · Phase 5 · W-C-COMPANION storage-contract extension.
// Terminal transitions of the linked KnowledgeJob are routed through the
// idempotent helper so every claimed→completed / claimed→failed transition
// leaves a paired audit_log row (entity_type='knowledge_jobs' · entity_id=kjid).
// Closes the Phase-1 forensic gap where KJ terminal writes left zero
// Supabase audit trail. See:
//   docs/headquarters-production-readiness/
//     WORLD-CLASS-OPS-W-C-STORAGE-CONTRACT-EXTENSION-DESIGN.md §3.5
//     WORLD-CLASS-OPS-W-C-COMPANION-SUPERVISOR-DESIGN-V2.md §4.3
import { applyTerminalKnowledgeJobTransition } from "@/lib/nex/jobs/terminal-transition";
// Step 2 · prompt-size telemetry · 2026-08-10. Uses the existing
// enterprise event bus (see src/lib/nex/events/fs-store.ts). Every
// LLM call attempt emits `extractor_prompt_assembled` BEFORE the call
// with the exact per-block character counts and estimated tokens ·
// so failures like the Groq 413 are diagnosable via database query
// rather than code inspection.
import { emitEventSafe } from "@/lib/nex/events/fs-store";

// ── Structured output shape expected from the LLM ────────────────────

type ExtractedClaim = {
  claim_text: string;
  claim_key?: string;
  classification: ClaimClassification;
  confidence_band: ConfidenceBand;
  confidence_score: number;
  source_type?: string;
  source_ref?: string;
  rationale?: string;
};

type ExtractedEdge = {
  to_record_id: string;
  edge_type: string;
  is_gap_marker?: boolean;
  provenance?: string;
};

type ExtractedRecord = {
  record_id: string;
  title: string;
  category: string;
  subcategory?: string;
  summary: string;
  body_markdown?: string;
  primary_audience: Audience;
  alt_audiences?: Audience[];
  industry_concepts?: string[];
  nex_concepts?: string[];
  claims: ExtractedClaim[];
  edges: ExtractedEdge[];
  sustainability_alert?: { active: boolean; severity?: string; notes?: string };
};

type ExtractorOutput = {
  candidate_records: ExtractedRecord[];
  overall_notes?: string;
};

// ── The system prompt ────────────────────────────────────────────────

// Step 5 · Avery SYSTEM_PROMPT reduction · 2026-08-10 (Philip GO).
// Applied the audited diff · no governance/schema/Truth-Law rule removed.
// Removals:
//   · S5 rule 1  (role duplicated with S1)
//   · S5 rule 9  (duplicated with S2 "good outcome" line)
//   · S3 tail paragraph "Weight past decisions heavily…" (Rowan renderLearning header carries this)
//   · S5 rule 12 (duplicated with removed S3 tail + Rowan header)
//   · S4 brand-use policy paragraph → replaced by one-line pointer to Voice Guide (Blake voice.brand_use_policy is authoritative)
//   · S5 rule 10 shortened to reference the Voice Guide (Blake voice.audience_voice_note is authoritative)
// Remaining rules renumbered 1-9. Rule 11 (nex_concepts vs industry_concepts array mechanic) retained per audit.
const SYSTEM_PROMPT = `You are the NEX Knowledge Extractor — a specialist worker in the NEX AI-managed knowledge system for the UK trades industry (staircases, kitchens, doors, flooring). Your ONE job is to extract structured, governed knowledge from raw source material and emit valid JSON that conforms exactly to the schema below.

CRITICAL — NEX ALREADY KNOWS THINGS (Knowledge Context):
You will be given a CONTEXT bundle listing existing records NEX has already authored. Your job is NOT to re-author what NEX already knows. Your job is to:
  (a) IDENTIFY overlaps with existing records → create TYPED EDGES to them rather than re-authoring their content
  (b) IDENTIFY genuinely NEW information not covered by existing records → author a focused new record for that specific angle
  (c) IDENTIFY gaps flagged in the context (keywords with no existing coverage) → these are candidates for new records

A good outcome looks like: 1-2 focused new records + 5-15 typed edges to existing records + a note in overall_notes about what the source added over the existing corpus.

CRITICAL — NEX LEARNS FROM HUMAN FEEDBACK (Past Decisions):
You will be given a LEARNING BUNDLE listing recent decisions Philip made on prior drafts:
  · edits    → "you produced X, Philip changed to Y" — highest-signal; emulate what Philip wrote
  · approvals → "this pattern was correct" — reinforce
  · rejections → "this pattern was wrong" — avoid the shape
  · corrections → specific factual fixes to remember
  · voice_drift → tone/audience mismatches to avoid repeating

CRITICAL — NEX HAS A VOICE (Voice & Brand Guide):
You will be given a VOICE GUIDE listing:
  · Applicable NEX brand terms (NexString™, Nex Newel™ Split Base Design, Connected Staircase™, NEX Premium™)
  · Primary audience (homeowner / manufacturer / engineer)
  · Content class (customer-facing / technical / regulatory / mixed)
  · Voice tone principles

See the BRAND-USE POLICY delivered in the VOICE GUIDE (user message below).

RULES:
1. Never fabricate. If a fact is not clearly established, mark it "design_opinion" or "experimental_concept" with low confidence.
2. Every claim gets: classification, confidence_band (high/medium/low), confidence_score (0.0-1.0), source_type, rationale.
3. Every edge must be typed. Valid edge types include: composes_material, composes_with, composes_from, regulated_by, used_for, part_of, references, extends, becomes, alternative_to, alternative_for, compared_with, replaces, sustainability_alert_from.
4. Industry concepts stay separate from NEX concepts (never mix in the same claim).
5. Never use "At NEX, we…" phrasing (HARD LAW).
6. Prefer splitting into multiple focused records over one giant record.
7. Sustainability alerts (ash dieback, CITES status, etc.) must be surfaced when relevant.
8. Follow the voice tone principles delivered in the VOICE GUIDE for the given primary audience.
9. Add brand terms to the record's nex_concepts array WHERE they are applicable per the guide. Add industry equivalents to industry_concepts. Never mix these.

OUTPUT SCHEMA (return this JSON, nothing else):
{
  "candidate_records": [
    {
      "record_id":         "snake_case_unique_id",
      "title":             "…",
      "category":          "NEX Materials | NEX Components | NEX Customer Guidance | …",
      "subcategory":       "…",
      "summary":           "50-word summary",
      "body_markdown":     "full record body in markdown (optional; will fall back to summary if omitted)",
      "primary_audience":  "homeowner | manufacturer | engineer",
      "alt_audiences":     ["homeowner", "manufacturer"],
      "industry_concepts": ["…", "…"],
      "nex_concepts":      ["…", "…"],
      "claims": [
        {
          "claim_text":       "…",
          "claim_key":        "short_snake_key",
          "classification":   "established_practice | industry_consensus | design_opinion | experimental_concept | NEX_concept",
          "confidence_band":  "high | medium | low",
          "confidence_score": 0.85,
          "source_type":      "industry_standard | manufacturer_specification | trade_reference | case_study | NEX_authored | anecdotal | inferred",
          "source_ref":       "…",
          "rationale":        "…"
        }
      ],
      "edges": [
        { "to_record_id": "materials_beech_v1", "edge_type": "composes_material", "is_gap_marker": false }
      ],
      "sustainability_alert": { "active": false }
    }
  ],
  "overall_notes": "optional summary of extraction"
}`;

// ── Main run function ────────────────────────────────────────────────

const WORKER_ID = `knowledge-extractor@${process.pid}`;
const INBOX_ROOT = path.join(process.cwd(), "data", "knowledge-inbox");

// Phase 10.4 · Fix B + A · authoritative taxonomy · MUST match:
//   TypeScript · src/lib/nex/brain/types.ts (ClaimClassification)
//   Database   · db/migrations/001_nex_brain_schema.sql lines 308-314
// Do NOT widen this list. If the LLM returns something outside these
// five values the whole extractor job is failed with the offending
// value recorded verbatim in worker_jobs.last_error.
const VALID_CLASSIFICATIONS: readonly ClaimClassification[] = [
  "established_practice",
  "industry_consensus",
  "design_opinion",
  "experimental_concept",
  "NEX_concept",
];

export async function runKnowledgeExtractor(options: {
  lease_seconds?: number;
} = {}): Promise<{ job: WorkerJob | null; result?: WorkerResult; draftRecordIds: string[] }> {
  const store = brainStore();
  const job = await store.claimNextJob("knowledge-extractor", WORKER_ID, options.lease_seconds ?? 60);
  if (!job) return { job: null, draftRecordIds: [] };
  enterJobCorrelationScope(job);  // W-OBS-1 Path A Layer 1 · CID inherit

  // Phase 10.2 · Fix #2B · linked KnowledgeJob transitions to
  // `processing` the moment the extractor actually starts work.
  const knowledgeJobId = (job.input_payload as { knowledge_job_id?: string | null } | null)?.knowledge_job_id ?? null;
  if (knowledgeJobId) {
    try {
      await updateKnowledgeJob(knowledgeJobId, { status: "processing", progress: 50 });
    } catch (e) {
      log.warn("kjob_processing_sync_failed", { kjid: knowledgeJobId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  try {
    // 1 · Resolve input — the inbox item id + payload
    const inboxItemId = job.input_ref;
    const source = (job.input_payload?.source as KnowledgeSource | undefined) ?? "raw-research";
    const inboxTitle = String(job.input_payload?.title ?? "untitled");
    const contentPath = job.input_payload?.contentPath as string | undefined;
    const inlineContent = job.input_payload?.content as string | undefined;

    let content = inlineContent ?? "";
    if (!content && contentPath) {
      try {
        content = await fs.readFile(path.join(INBOX_ROOT, contentPath), "utf8");
      } catch (err) {
        throw new Error(
          `Extractor could not read content for inbox item ${inboxItemId}: ${(err as Error).message}`
        );
      }
    }
    if (!content) {
      throw new Error(`Extractor received empty content for inbox item ${inboxItemId}`);
    }

    // 2 · Read the context bundle + voice guide from the job payload
    // (produced by the upstream Knowledge Context + Voice Context Workers).
    // If either is missing — because the job was enqueued before those
    // Workers existed, or someone bypassed the pipeline — proceed but
    // log a warning.
    const contextBundle = job.input_payload?.context_bundle as
      | { records: Array<{
          record_id: string;
          title: string;
          category: string;
          summary: string;
          nex_concepts: string[];
          industry_concepts: string[];
          primary_audience: string;
          sample_edges: Array<{ edge_type: string; to: string }>;
        }>; gaps: string[]; keywords: string[] }
      | undefined;
    if (!contextBundle) {
      log.warn("no_context_bundle", { inbox_item_id: inboxItemId });
    }

    const voiceGuide = job.input_payload?.voice_guide as
      | {
          applicable_brand_terms: Array<{
            key: string;
            brand: string;
            brand_plain: string;
            technical: string;
            customer_explanation: string;
            usage_note: string;
          }>;
          primary_audience: "homeowner" | "manufacturer" | "engineer";
          audience_voice_note: string;
          content_class: "customer-facing" | "technical" | "regulatory" | "mixed";
          brand_use_policy: string;
          voice_tone_principles: string[];
        }
      | undefined;
    if (!voiceGuide) {
      log.warn("no_voice_guide", { inbox_item_id: inboxItemId });
    }

    const learningBundle = job.input_payload?.learning_bundle as
      | {
          examples: Array<{
            kind: string;
            severity: string;
            question?: string | null;
            nex_answer?: string | null;
            correction?: string | null;
            lesson?: string | null;
            domain?: string | null;
            topic_tags?: string[];
            created_at: string;
          }>;
          overall_lesson: string;
          candidates_scanned: number;
          window_days: number;
        }
      | undefined;
    if (!learningBundle) {
      log.warn("no_learning_bundle", { inbox_item_id: inboxItemId });
    }

    // 3 · Call the LLM with the Golden Rule system prompt + all three bundles
    const { userMessage, block_chars } = buildUserMessage({
      inbox_id: inboxItemId,
      source,
      title: inboxTitle,
      content,
      context: contextBundle,
      voice: voiceGuide,
      learning: learningBundle,
    });

    // ── Step 2 · prompt-size telemetry ─────────────────────────────
    // Emit BEFORE the LLM call so telemetry is captured regardless of
    // whether the call succeeds or fails (e.g. Groq 413). Payload is
    // machine-friendly · no personal data · no source body content ·
    // just per-block character counts + estimated tokens + provider.
    //
    // Token estimate is char/3.5 (Llama-family rough) · NOT tokenizer
    // output. When a tokenizer library lands, replace estimator only.
    const CHARS_PER_TOKEN_ESTIMATE = 3.5;
    const MAX_OUTPUT_TOKENS = 8192;
    const PREFER_PROVIDER = "groq" as const;
    const REQUIRES_CAPABILITY = "json_mode" as const;
    const system_chars = SYSTEM_PROMPT.length;
    const total_input_chars = system_chars + block_chars.total_user_message_chars;
    const promptTelemetry = {
      kj_id:                            knowledgeJobId ?? null,
      inbox_item_id:                    inboxItemId,
      source:                           source,
      // Per-block character counts (VERIFIED · measured from strings actually composed)
      system_chars,
      context_chars:                    block_chars.context_chars,
      voice_chars:                      block_chars.voice_chars,
      learning_chars:                   block_chars.learning_chars,
      raw_content_chars:                block_chars.raw_content_chars,
      raw_content_original_chars:       block_chars.raw_content_original_chars,
      raw_content_truncated:            block_chars.raw_content_truncated,
      user_message_chars:               block_chars.total_user_message_chars,
      total_input_chars,
      // Estimated tokens (rough · char-based estimator · not tokenizer)
      estimator_kind:                   "chars_per_token_ratio",
      estimator_chars_per_token:        CHARS_PER_TOKEN_ESTIMATE,
      estimated_input_tokens:           Math.round(total_input_chars / CHARS_PER_TOKEN_ESTIMATE),
      max_output_tokens:                MAX_OUTPUT_TOKENS,
      estimated_total_tokens:           Math.round(total_input_chars / CHARS_PER_TOKEN_ESTIMATE) + MAX_OUTPUT_TOKENS,
      // Provider preference (actual selected provider recorded post-call via worker_result.llm_provider)
      prefer_provider:                  PREFER_PROVIDER,
      requires_capability:              REQUIRES_CAPABILITY,
      // Bundle presence signals (for quick filtering in analysis)
      context_records_count:            contextBundle?.records?.length ?? 0,
      context_gap_keywords_count:       (contextBundle?.gaps?.length ?? 0),
      voice_brand_terms_count:          voiceGuide?.applicable_brand_terms?.length ?? 0,
      voice_primary_audience:           voiceGuide?.primary_audience ?? null,
      learning_examples_count:          learningBundle?.examples?.length ?? 0,
      // Emit metadata
      assembled_at:                     nowIso(),
    };
    emitEventSafe({
      event_type:          "extractor_prompt_assembled",
      source:              "knowledge-extractor",
      related_job:         knowledgeJobId ?? null,
      related_department:  "brain",
      outcome:             "pending",
      payload:             promptTelemetry,
    });

    // Provider preference: Groq is best at fast structured JSON at
    // 70B parameter scale for the Golden Rule extraction pattern.
    // Requires json_mode capability. Fallback chain still applies.
    const { data, raw } = await completeJson<ExtractorOutput>(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      {
        temperature: 0.3,
        max_tokens: MAX_OUTPUT_TOKENS,
        prefer_provider: PREFER_PROVIDER,
        requires_capability: REQUIRES_CAPABILITY,
      }
    );

    // Phase 10.4 · Fix B + A · strict classification validation.
    //
    // The DB CHECK constraint on confidence_scores.classification permits
    // exactly five values (see db/migrations/001_nex_brain_schema.sql
    // lines 308-314). Before we insert anything, walk every claim on
    // every candidate record and reject the whole job if any claim's
    // classification is outside the taxonomy. The offending value(s) are
    // recorded verbatim in the thrown Error's message so the failure is
    // diagnosable from failJob() / worker_jobs.last_error alone — no more
    // opaque "violates check constraint" errors that don't say which
    // value was rejected. Do NOT silently coerce or widen the taxonomy;
    // the LLM must conform to NEX's vocabulary.
    //
    // Prior behaviour: raw passthrough → DB rejected → no diagnostic.
    // Adversarial regression: src/lib/nex/brain/tests/confidence-scores-classification.test.mjs
    const badClaims: Array<{ record_id: string; claim_key: string; classification: string }> = [];
    for (const rec of data.candidate_records ?? []) {
      for (const [i, claim] of (rec.claims ?? []).entries()) {
        if (!VALID_CLASSIFICATIONS.includes(claim.classification as ClaimClassification)) {
          badClaims.push({
            record_id:      rec.record_id,
            claim_key:      claim.claim_key ?? `claim_${i + 1}`,
            classification: String(claim.classification),
          });
        }
      }
    }
    if (badClaims.length > 0) {
      throw new Error(
        `invalid_classification: LLM returned ${badClaims.length} claim(s) with a classification outside the NEX taxonomy. ` +
        `Valid values: [${VALID_CLASSIFICATIONS.join(", ")}]. ` +
        `Offenders: ${JSON.stringify(badClaims)}`,
      );
    }

    // 3 · Write each candidate record + its claims + edges + source
    // Idempotent · repeated extraction of the same record_id is a no-op
    // instead of a duplicate-key crash. Dependent inserts (claims, edges,
    // source, quality-check) are ONLY made for genuinely new records so
    // we don't accumulate duplicate claims against an existing record.
    const draftRecordIds:  string[] = [];
    const noOpRecordIds:   string[] = [];
    for (const rec of data.candidate_records ?? []) {
      const { record: draft, created } = await store.insertRecordIdempotent({
        record_id: rec.record_id,
        record_version: "1.0.0",
        status: "DRAFT",
        supersedes: null,
        canonical_owner: `NEX ${rec.category} · Knowledge Extractor`,
        authored_by: `worker:knowledge-extractor@${nowIso()}`,
        authorised_by: null,
        reviewed_by: null,
        title: rec.title,
        category: rec.category,
        subcategory: rec.subcategory ?? null,
        summary: rec.summary,
        body_markdown: rec.body_markdown ?? rec.summary,
        industry_concepts: rec.industry_concepts ?? [],
        nex_concepts: rec.nex_concepts ?? [],
        primary_audience: rec.primary_audience,
        alt_audiences: rec.alt_audiences ?? [],
        sustainability_alert: rec.sustainability_alert ?? null,
        embedding: null,
        last_reviewed_at: null,
        review_due_at: null,
        deprecated_at: null,
      });
      draftRecordIds.push(draft.record_id);
      if (!created) {
        noOpRecordIds.push(draft.record_id);
        continue;
      }

      // Claims → confidence_scores
      for (const [i, claim] of (rec.claims ?? []).entries()) {
        await store.insertConfidence({
          record_id: draft.record_id,
          claim_key: claim.claim_key ?? `claim_${i + 1}`,
          claim_text: claim.claim_text,
          classification: claim.classification,
          confidence_band: claim.confidence_band,
          confidence_score: claim.confidence_score,
          source_type: claim.source_type ?? null,
          source_ref: claim.source_ref ?? null,
          verification_date: null,
          rationale: claim.rationale ?? null,
        });
      }

      // Edges → graph_edges
      for (const edge of rec.edges ?? []) {
        await store.insertEdge({
          from_record_id: draft.record_id,
          to_record_id: edge.to_record_id,
          edge_type: edge.edge_type,
          confidence: null,
          provenance: edge.provenance ?? `extractor:${inboxItemId}`,
          is_gap_marker: Boolean(edge.is_gap_marker),
        });
      }

      // Source lineage → sources
      await store.insertSource({
        record_id: draft.record_id,
        inbox_item_id: inboxItemId,
        source_tier: source,
        source_url: null,
        source_hash: null,
        excerpt: content.slice(0, 400),
      });

      // Enqueue Quality Check job for this draft
      await store.enqueueJob({
        worker_type: "quality-checker",
        priority: 3,
        input_kind: "record_draft",
        input_ref: draft.record_id,
        input_payload: { source, extractor_job_id: job.id },
      });

      // Audit
      await store.insertAudit({
        entity_type: "knowledge_records",
        entity_id: draft.record_id,
        action: "insert",
        actor: WORKER_ID,
        before_state: null,
        after_state: { status: "DRAFT", record_id: draft.record_id },
        notes: `Drafted from inbox item ${inboxItemId} (source: ${source})`,
      });
    }

    // 4 · Record the worker_result + complete the job
    // no_op flags: all_no_op = every candidate record already existed;
    // partial_no_op = some candidates were duplicates but at least one
    // new record was created. Consumers (Living Timeline, HQ dashboards)
    // can distinguish "did nothing but succeeded" from "produced drafts".
    const allNoOp     = draftRecordIds.length > 0 && noOpRecordIds.length === draftRecordIds.length;
    const partialNoOp = noOpRecordIds.length > 0 && !allNoOp;
    const flags: string[] = [];
    if (draftRecordIds.length === 0) flags.push("no-records-extracted");
    if (allNoOp)                     flags.push("no-op:record_already_exists");
    if (partialNoOp)                 flags.push("partial-no-op:some_records_already_exist");
    // Wave 11 · Step 8 · F35 · shared finalization sequence.
    // Extractor emits per-record audits inside insertRecordIdempotent
    // above · no `finalAudit` here (matches image-analyst · genuine
    // divergence). Only insertResult + completeJob converge.
    const result = await finalizeWorkerJob(store, {
      job,
      resultInput: {
        worker_type: "knowledge-extractor",
        worker_id: WORKER_ID,
        output_kind: "record_draft",
        output_payload: {
          draft_record_ids: draftRecordIds,
          no_op_record_ids: noOpRecordIds,
          no_op:            allNoOp || undefined,
          no_op_reason:     allNoOp ? "record_already_exists" : undefined,
          overall_notes: data.overall_notes ?? "",
        },
        overall_confidence: draftRecordIds.length > 0 ? 0.8 : 0,
        llm_provider: raw.provider,
        llm_model: raw.model,
        llm_tokens_in: raw.tokens_in,
        llm_tokens_out: raw.tokens_out,
        llm_ms: raw.ms,
        flags,
      },
    });

    // Phase 10.2 · Fix #2B · close the Knowledge Dump job loop.
    // Move the linked KnowledgeJob to `completed`. Non-fatal · a
    // fs-store failure here must NOT roll back the successful extractor
    // work. (knowledgeJobId captured before the try block.)
    //
    // Wave 11 · Phase 5 · routed through applyTerminalKnowledgeJobTransition
    // for idempotency + paired transition audit. If KJ already terminal,
    // helper is a no-op (no duplicate audit row).
    if (knowledgeJobId) {
      try {
        await applyTerminalKnowledgeJobTransition(store, {
          kjid: knowledgeJobId,
          patch: {
            status: "completed",
            progress: 100,
            completion_result: {
              memories_added: draftRecordIds.length - noOpRecordIds.length,
              brains_linked: [],
            },
          },
          actor: `worker:knowledge-extractor@${process.pid}`,
          reason: "extractor-terminal-success",
          worker_job_id: job.id,
          metadata: {
            draft_record_ids_count: draftRecordIds.length,
            no_op_record_ids_count: noOpRecordIds.length,
          },
        });
      } catch (e) {
        log.warn("kjob_completion_sync_failed", { kjid: knowledgeJobId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return { job, result, draftRecordIds };
  } catch (err) {
    // Wave 11 · Step 8 · F35 · shared failure path. Returns the
    // extracted message so the downstream KnowledgeJob sync doesn't
    // re-derive it.
    const message = await failWorkerJob(store, job, err, "knowledge-extractor");

    // Phase 10.2 · Fix #2B · propagate failure to the linked KnowledgeJob.
    // Wave 11 · Phase 5 · routed through the idempotent helper (same
    // reasoning as the success path above).
    if (knowledgeJobId) {
      try {
        await applyTerminalKnowledgeJobTransition(store, {
          kjid: knowledgeJobId,
          patch: {
            status: "failed",
            completion_result: { error: message },
          },
          actor: `worker:knowledge-extractor@${process.pid}`,
          reason: "extractor-terminal-failure",
          worker_job_id: job.id,
          metadata: { error_head: message.slice(0, 200) },
        });
      } catch (e) {
        log.warn("kjob_failure_sync_failed", { kjid: knowledgeJobId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return { job, draftRecordIds: [] };
  }
}

// ── User message composition ────────────────────────────────────────

function buildUserMessage(input: {
  inbox_id: string;
  source: KnowledgeSource;
  title: string;
  content: string;
  context?: {
    records: Array<{
      record_id: string;
      title: string;
      category: string;
      summary: string;
      nex_concepts: string[];
      industry_concepts: string[];
      primary_audience: string;
      sample_edges: Array<{ edge_type: string; to: string }>;
    }>;
    gaps: string[];
    keywords: string[];
  };
  voice?: {
    applicable_brand_terms: Array<{
      key: string;
      brand: string;
      brand_plain: string;
      technical: string;
      customer_explanation: string;
      usage_note: string;
    }>;
    primary_audience: "homeowner" | "manufacturer" | "engineer";
    audience_voice_note: string;
    content_class: "customer-facing" | "technical" | "regulatory" | "mixed";
    brand_use_policy: string;
    voice_tone_principles: string[];
  };
  learning?: {
    examples: Array<{
      kind: string;
      severity: string;
      question?: string | null;
      nex_answer?: string | null;
      correction?: string | null;
      lesson?: string | null;
      domain?: string | null;
      topic_tags?: string[];
      created_at: string;
    }>;
    overall_lesson: string;
    candidates_scanned: number;
    window_days: number;
  };
}): { userMessage: string; block_chars: PromptBlockChars } {
  // Truncate very long content to keep within reasonable token budgets.
  const CONTENT_LIMIT = 80_000;
  const contentOriginalChars = input.content.length;
  const contentTruncated = input.content.length > CONTENT_LIMIT;
  const content = contentTruncated
    ? input.content.slice(0, CONTENT_LIMIT) +
      `\n\n[…truncated at ${CONTENT_LIMIT.toLocaleString()} chars — Manager will re-enqueue remainder]`
    : input.content;

  const contextBlock = renderContext(input.context);
  const voiceBlock = renderVoiceGuide(input.voice);
  const learningBlock = renderLearning(input.learning);

  const userMessage = `INBOX ITEM METADATA
inbox_id: ${input.inbox_id}
source:   ${input.source}
title:    ${input.title}

SOURCE-SPECIFIC HANDLING NOTES:
- chatgpt-approved / claude-generated → Trust the wording. Do NOT rewrite. Split into records, add metadata, cross-reference. Only flag factual claims that need verification.
- gov-standards → Treat as authoritative. Use to update/verify existing records. Never paraphrase; cite directly.
- raw-research → Extract facts, structure them, cross-reference. Build FAQs.
- internet-article → Cautious extraction. Verify before promoting to high confidence.
- needs-verification → Extract as low-confidence claims; keep out of AUTHORITATIVE.
- customer-qa → Use to generate FAQ candidates and identify knowledge gaps.
- personal-ideas → Store as NEX_concept only; never mix with industry claims.

${contextBlock}

${voiceBlock}

${learningBlock}

RAW CONTENT:
${content}

TASK: Extract structured knowledge records per the schema. When CONTEXT records above cover the same ground as the RAW CONTENT, LINK to them via typed edges rather than re-authoring. Apply the VOICE GUIDE — use NEX brand terms where the content class permits, use industry terms where it demands precision. Apply the LEARNING BUNDLE — never repeat a pattern Philip corrected, always emulate patterns Philip approved. Author focused new records ONLY for genuinely new information or for the gap keywords listed. Aim for MORE typed edges than new records. Respond with ONLY the JSON object.`;

  // Step 2 · block-size telemetry · zero effect on the assembled string.
  // Computed from the exact strings that were composed into userMessage above.
  const block_chars: PromptBlockChars = {
    context_chars:                contextBlock.length,
    voice_chars:                  voiceBlock.length,
    learning_chars:               learningBlock.length,
    raw_content_chars:            content.length,           // post-truncation
    raw_content_original_chars:   contentOriginalChars,     // pre-truncation
    raw_content_truncated:        contentTruncated,
    total_user_message_chars:     userMessage.length,       // authoritative sum of all above + template overhead
  };
  return { userMessage, block_chars };
}

// Step 2 · shape of the per-block character counts emitted with every
// prompt-assembly event. Consumed by the extractor's telemetry emit
// below · not exposed to the LLM.
export type PromptBlockChars = {
  context_chars:              number;
  voice_chars:                number;
  learning_chars:             number;
  raw_content_chars:          number;
  raw_content_original_chars: number;
  raw_content_truncated:      boolean;
  total_user_message_chars:   number;
};

function renderLearning(
  learning?: {
    examples: Array<{
      kind: string;
      severity: string;
      question?: string | null;
      nex_answer?: string | null;
      correction?: string | null;
      lesson?: string | null;
      domain?: string | null;
      topic_tags?: string[];
      created_at: string;
    }>;
    overall_lesson: string;
    candidates_scanned: number;
    window_days: number;
  }
): string {
  if (!learning || learning.examples.length === 0) {
    return `LEARNING BUNDLE — past decisions by Philip:
  (no relevant prior feedback yet — author from scratch using the other bundles)`;
  }
  // Step 7 · Rowan render reduction · 2026-08-10 (Philip GO · post-Step-6).
  // Bundle shape, DB storage, audit fields, and selection metadata are all
  // unchanged · this reduction is ONLY at the point where Rowan's output
  // is projected into Avery's prompt. Removed fields are Rowan's internal
  // selection metadata that Avery has no rule keyed against:
  //   · severity  · scoring-only boost inside Rowan's scoreFeedback
  //   · date      · Rowan already applies age decay before selection
  //   · Domain    · duplicated by Mason's context bundle
  //   · Topics    · duplicated by Mason's context bundle
  // Question and NEX-said trims narrowed 300→200 · correction (300) and
  // lesson (240) are the highest-signal fields · kept at full length.
  const lines: string[] = [];
  lines.push(`LEARNING BUNDLE — past decisions by Philip (${learning.examples.length} example${learning.examples.length === 1 ? "" : "s"}):`);
  lines.push(``);
  lines.push(`Synthesis: ${learning.overall_lesson}`);
  lines.push(``);
  lines.push(`Weight these examples heavily. Do NOT repeat patterns Philip corrected.`);
  lines.push(`DO emulate patterns Philip approved.`);
  lines.push(``);
  for (const ex of learning.examples) {
    lines.push(`━━━ ${ex.kind.toUpperCase()} ━━━`);
    if (ex.question) lines.push(`Question: ${trim(ex.question, 200)}`);
    if (ex.nex_answer) lines.push(`NEX said: ${trim(ex.nex_answer, 200)}`);
    if (ex.correction) lines.push(`Philip corrected to: ${trim(ex.correction, 300)}`);
    if (ex.lesson) lines.push(`Lesson: ${trim(ex.lesson, 240)}`);
    lines.push(``);
  }
  return lines.join("\n");
}

function trim(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function renderVoiceGuide(
  voice?: {
    applicable_brand_terms: Array<{
      key: string;
      brand: string;
      brand_plain: string;
      technical: string;
      customer_explanation: string;
      usage_note: string;
    }>;
    primary_audience: "homeowner" | "manufacturer" | "engineer";
    audience_voice_note: string;
    content_class: "customer-facing" | "technical" | "regulatory" | "mixed";
    brand_use_policy: string;
    voice_tone_principles: string[];
  }
): string {
  if (!voice) {
    return `VOICE GUIDE:
  (none — write in a neutral professional tone; avoid brand terminology)`;
  }
  const lines: string[] = [];
  lines.push(`VOICE & BRAND GUIDE:`);
  lines.push(``);
  lines.push(`Primary audience: ${voice.primary_audience}`);
  lines.push(`Content class:    ${voice.content_class}`);
  lines.push(`Audience voice:   ${voice.audience_voice_note}`);
  lines.push(``);
  lines.push(`Brand-use policy:`);
  lines.push(`  ${voice.brand_use_policy}`);
  lines.push(``);
  if (voice.applicable_brand_terms.length > 0) {
    lines.push(`Applicable NEX brand terms (use per policy):`);
    for (const t of voice.applicable_brand_terms) {
      lines.push(`  · ${t.brand} · plain: ${t.brand_plain} · technical: ${t.technical}`);
      lines.push(`    Bridge:    ${t.customer_explanation}`);
      lines.push(`    Use when:  ${t.usage_note}`);
    }
    lines.push(``);
  } else {
    lines.push(`Applicable NEX brand terms: none for this content — use industry terms only.`);
    lines.push(``);
  }
  lines.push(`Voice tone principles:`);
  for (const p of voice.voice_tone_principles.slice(0, 8)) {
    lines.push(`  · ${p}`);
  }
  return lines.join("\n");
}

function renderContext(
  ctx?: {
    records: Array<{
      record_id: string;
      title: string;
      category: string;
      summary: string;
      nex_concepts: string[];
      industry_concepts: string[];
      primary_audience: string;
      sample_edges: Array<{ edge_type: string; to: string }>;
    }>;
    gaps: string[];
    keywords: string[];
  }
): string {
  if (!ctx || ctx.records.length === 0) {
    return `CONTEXT (records NEX already knows about):
  (none returned — this may be a new topic for NEX)`;
  }
  const lines: string[] = [];
  lines.push(`CONTEXT — records NEX already knows about (${ctx.records.length}):`);
  lines.push("");
  lines.push("You MUST NOT re-author these. Use typed edges to link to them instead.");
  lines.push("");
  // Step 8 · Mason render reduction · 2026-08-10 (Philip GO · post-Step-7).
  // Presentation-only trims · ContextBundle shape, selection logic, record
  // count (10), gap keyword count (20), and record filter (AUTH/UR only)
  // are all unchanged. Three trims:
  //   · fold Category + Audience onto one line (label overhead only)
  //   · Summary cap 300 → 220 (Truth-Law regression-verified · content preserved
  //     under 220 · captured for over-220 truncations)
  //   · Sample edges 5 → 3 (edge_type whitelist authoritative in SYSTEM_PROMPT ·
  //     3 samples still demonstrate current edge topology per record)
  // Preserved verbatim: record_id header · Title · NEX/Industry concepts ·
  // imperative "MUST NOT re-author" · GAP KEYWORDS section.
  for (const r of ctx.records) {
    lines.push(`━━━ ${r.record_id} ━━━`);
    lines.push(`Title:            ${r.title}`);
    lines.push(`Category: ${r.category} · Audience: ${r.primary_audience}`);
    const summary = r.summary.replace(/\s+/g, " ").slice(0, 220);
    lines.push(`Summary:          ${summary}${r.summary.length > 220 ? "…" : ""}`);
    if (r.nex_concepts.length > 0) {
      lines.push(`NEX concepts:     ${r.nex_concepts.slice(0, 8).join(", ")}`);
    }
    if (r.industry_concepts.length > 0) {
      lines.push(`Industry concepts:${r.industry_concepts.slice(0, 8).join(", ")}`);
    }
    if (r.sample_edges.length > 0) {
      lines.push(
        `Sample edges:     ${r.sample_edges
          .slice(0, 3)
          .map((e) => `${e.edge_type}→${e.to}`)
          .join(", ")}`
      );
    }
    lines.push("");
  }
  if (ctx.gaps.length > 0) {
    lines.push(`GAP KEYWORDS (not covered by any existing record — candidates for new authoring):`);
    lines.push(`  ${ctx.gaps.slice(0, 20).join(", ")}`);
  }
  return lines.join("\n");
}
