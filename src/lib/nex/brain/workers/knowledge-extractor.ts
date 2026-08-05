// NEX Brain · Knowledge Extractor worker
//
// Real-time worker. Pulls one "extract from inbox item" job, sends the
// inbox item's content to the LLM with the NEX Golden Rule template
// system prompt, parses the structured output into one or more
// candidate KnowledgeRecord drafts, writes them (status = DRAFT),
// writes typed graph edges + per-claim confidence rows + source
// lineage, then enqueues a quality-check job for each new draft.
//
// The Extractor does NOT commit records as AUTHORITATIVE — that is
// the Quality Checker's job. It authors the draft and hands off.
//
// Contract:
//   input_kind = 'inbox_item'
//   input_ref  = the inbox item's id (from data/knowledge-inbox/*)
//   input_payload = optional snapshot of the item (title, source, content)

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { brainStore, nowIso } from "../storage";
import { complete, completeJson } from "../llm";
import type {
  Audience,
  ClaimClassification,
  ConfidenceBand,
  KnowledgeSource,
  WorkerJob,
  WorkerResult,
} from "../types";

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

const SYSTEM_PROMPT = `You are the NEX Knowledge Extractor — a specialist worker in the NEX AI-managed knowledge system for the UK trades industry (staircases, kitchens, doors, flooring). Your ONE job is to extract structured, governed knowledge from raw source material and emit valid JSON that conforms exactly to the schema below.

RULES:
1. You are NOT answering the user. You are authoring knowledge records.
2. Never fabricate. If a fact is not clearly established, mark it "design_opinion" or "experimental_concept" with low confidence.
3. Every claim gets: classification, confidence_band (high/medium/low), confidence_score (0.0-1.0), source_type, rationale.
4. Every edge must be typed (composes_material, regulated_by, used_for, part_of, references, etc.).
5. Industry concepts stay separate from NEX concepts (never mix in the same claim).
6. Never use "At NEX, we…" phrasing.
7. Prefer splitting into multiple focused records over one giant record.
8. Sustainability alerts (ash dieback, CITES status, etc.) must be surfaced when relevant.

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

export async function runKnowledgeExtractor(options: {
  lease_seconds?: number;
} = {}): Promise<{ job: WorkerJob | null; result?: WorkerResult; draftRecordIds: string[] }> {
  const store = brainStore();
  const job = await store.claimNextJob("knowledge-extractor", WORKER_ID, options.lease_seconds ?? 60);
  if (!job) return { job: null, draftRecordIds: [] };

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

    // 2 · Call the LLM with the Golden Rule system prompt
    const userMessage = buildUserMessage({
      inbox_id: inboxItemId,
      source,
      title: inboxTitle,
      content,
    });

    const { data, raw } = await completeJson<ExtractorOutput>(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.3, max_tokens: 8192 }
    );

    // 3 · Write each candidate record + its claims + edges + source
    const draftRecordIds: string[] = [];
    for (const rec of data.candidate_records ?? []) {
      const draft = await store.insertRecord({
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
    const result = await store.insertResult({
      job_id: job.id,
      worker_type: "knowledge-extractor",
      worker_id: WORKER_ID,
      output_kind: "record_draft",
      output_payload: {
        draft_record_ids: draftRecordIds,
        overall_notes: data.overall_notes ?? "",
      },
      overall_confidence: draftRecordIds.length > 0 ? 0.8 : 0,
      llm_provider: raw.provider,
      llm_model: raw.model,
      llm_tokens_in: raw.tokens_in,
      llm_tokens_out: raw.tokens_out,
      llm_ms: raw.ms,
      flags: draftRecordIds.length === 0 ? ["no-records-extracted"] : [],
    });
    await store.completeJob(job.id, result.id);

    return { job, result, draftRecordIds };
  } catch (err) {
    const message = (err as Error).message;
    console.error("[knowledge-extractor] failed:", message);
    await store.failJob(job.id, message);
    return { job, draftRecordIds: [] };
  }
}

// ── User message composition ────────────────────────────────────────

function buildUserMessage(input: {
  inbox_id: string;
  source: KnowledgeSource;
  title: string;
  content: string;
}): string {
  // Truncate very long content to keep within reasonable token budgets.
  // The Knowledge Inbox may hold multi-MB dumps; the Extractor works
  // on chunks up to ~80KB per call.
  const CONTENT_LIMIT = 80_000;
  const content =
    input.content.length > CONTENT_LIMIT
      ? input.content.slice(0, CONTENT_LIMIT) +
        `\n\n[…truncated at ${CONTENT_LIMIT.toLocaleString()} chars — Manager will re-enqueue remainder]`
      : input.content;

  return `INBOX ITEM METADATA
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

RAW CONTENT:
${content}

TASK: Extract structured knowledge records per the schema. Aim for 1-5 focused records rather than 1 giant record. Every claim must have classification + confidence. Every relationship to another record must be a typed edge. Respond with ONLY the JSON object.`;
}
