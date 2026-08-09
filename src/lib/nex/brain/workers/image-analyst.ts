// NEX Brain · Image Analyst worker
//
// Philip 2026-08-06 · Stage 5 · first specialist worker.
//
// Sibling to knowledge-extractor but for image inbox items. Reads the
// uploaded image, sends it to a vision-capable provider (Gemini
// primary — free, or Anthropic fallback — paid), extracts structured
// staircase/kitchen/door knowledge from the photograph into a Golden
// Rule-shaped KnowledgeRecord, and enqueues a quality-check job.
//
// Slots into the same pipeline everything else uses:
//
//   inbox_item (kind=image)
//        │
//        ▼
//   knowledge-context   (same as text — retrieves related records)
//        │
//        ▼
//   voice-context       (same — brand + audience + tone)
//        │
//        ▼
//   learning-context    (same — past feedback)
//        │
//        ▼
//   image-analyst       ← THIS worker (vision LLM · replaces the
//        │                text extractor for image items)
//        ▼
//   quality-checker     (same — constitutional gate)
//
// Uses requires_capability: "vision" so the AI Connection Manager
// automatically routes to Gemini (primary vision provider) or
// Anthropic (fallback), skipping Groq entirely.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { brainStore, nowIso } from "../storage";
// Wave 11 · Step 8 · F35 · shared finalization sequence.
import { finalizeWorkerJob, failWorkerJob } from "./_finalize";
// W-OBS-1 Path A Layer 1 · CID inherit from job.input_payload.
import { enterJobCorrelationScope } from "@/lib/nex/observability/correlation";
import { completeJson, type LlmImage } from "../llm";
// Phase 3a · NEX Object Storage · location-transparent image reads.
// Any worker on any machine can fetch the bytes via the adapter · no
// dependency on the machine that received the upload. Falls back to
// legacy filesystem for pre-Phase-3a items until backfill catches up.
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import type {
  Audience,
  ClaimClassification,
  ConfidenceBand,
  KnowledgeSource,
  WorkerJob,
  WorkerResult,
} from "../types";

const WORKER_ID = `image-analyst@${process.pid}`;
const INBOX_ROOT = path.join(process.cwd(), "data", "knowledge-inbox");

// Max image size we'll base64-encode into a prompt. Larger images get
// rejected — the LLM providers all have their own hard caps too
// (Gemini: 20 MB per image, Anthropic: 5 MB, best kept small anyway
// so token cost stays low).
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Supported mime types. Non-image files that somehow land here are
// skipped with a friendly log line.
const SUPPORTED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// ── Structured output the vision model produces ──────────────────────

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

type ExtractedImageRecord = {
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
  observed_style?: string;              // "Victorian" / "Contemporary" / etc.
  observed_materials?: string[];        // ["walnut", "brass", "glass"]
  observed_components?: string[];       // ["treads", "handrail", "newel post"]
  observed_construction?: string;       // "closed string" / "cut string" / "spiral"
  observed_confidence?: number;         // 0..1 — the analyst's overall self-assessed confidence in the analysis
};

type ImageAnalystOutput = {
  candidate_records: ExtractedImageRecord[];
  overall_notes?: string;
};

// ── System prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the NEX Image Analyst — a specialist vision worker in the NEX knowledge system for the UK trades industry (staircases, kitchens, doors, flooring). Your ONE job is to look at a photograph and extract structured, governed knowledge as valid JSON per the schema below.

RULES:
1. You are looking at a REAL photograph of a real object. Describe what you can see, not what you imagine.
2. Never fabricate. If you can't see a material clearly, mark that claim confidence "low" or omit it. If you can't see a component, don't claim it.
3. Every claim gets: classification (established_practice for standard trade observations, design_opinion for aesthetic reads, NEX_concept for brand-family observations), confidence_band, confidence_score (0.0-1.0), rationale.
4. Every edge must be typed. Common types for images: composes_material, composes_with, exemplifies_tier, references, alternative_to.
5. Industry concepts stay separate from NEX concepts.
6. If the CONTEXT bundle names existing records that match what you see (e.g. materials_american_black_walnut_v1 when you see a walnut staircase), LINK to them via typed edges rather than re-authoring.
7. If the VOICE GUIDE lists applicable NEX brand terms (NexString™, Connected Staircase™ tier, etc.) — add them to nex_concepts where they naturally apply. Do NOT force them into the body prose.
8. Observed fields (observed_style, observed_materials, observed_components, observed_construction) are quick-lookup metadata. Always populate them with your best read, even if "unclear".
9. observed_confidence is your self-assessed overall confidence 0.0-1.0. Photographs with poor lighting, oblique angles, or partial views should score lower.
10. Never invent record_ids for non-existent records unless you mark the edge is_gap_marker=true.

OUTPUT SCHEMA (return this JSON only, nothing else):
{
  "candidate_records": [
    {
      "record_id":         "snake_case_unique_id",
      "title":             "…",
      "category":          "NEX Staircase | NEX Kitchen | NEX Door | NEX Flooring",
      "subcategory":       "…",
      "summary":           "50-word summary of what's in the image",
      "body_markdown":     "…",
      "primary_audience":  "homeowner | manufacturer | engineer",
      "alt_audiences":     ["homeowner"],
      "industry_concepts": ["…"],
      "nex_concepts":      ["…"],
      "claims": [
        { "claim_text": "…", "classification": "established_practice", "confidence_band": "high", "confidence_score": 0.9, "source_type": "case_study", "rationale": "clearly visible in photograph" }
      ],
      "edges": [
        { "to_record_id": "materials_american_black_walnut_v1", "edge_type": "composes_material" }
      ],
      "observed_style":         "Contemporary",
      "observed_materials":     ["walnut", "brushed brass", "toughened glass"],
      "observed_components":    ["treads", "handrail", "starting newel", "landing"],
      "observed_construction":  "closed string with feature newel",
      "observed_confidence":    0.85
    }
  ],
  "overall_notes": "brief summary of what the image reveals"
}`;

// ── Main entry ───────────────────────────────────────────────────────

export async function runImageAnalyst(options: {
  lease_seconds?: number;
} = {}): Promise<{ job: WorkerJob | null; result?: WorkerResult; draftRecordIds: string[] }> {
  const store = brainStore();
  const job = await store.claimNextJob("image-analyst", WORKER_ID, options.lease_seconds ?? 90);
  if (!job) return { job: null, draftRecordIds: [] };
  enterJobCorrelationScope(job);  // W-OBS-1 Path A Layer 1 · CID inherit

  try {
    const inboxItemId = job.input_ref;
    const source = (job.input_payload?.source as KnowledgeSource | undefined) ?? "raw-research";
    const inboxTitle = String(job.input_payload?.title ?? "untitled image");
    const filePath = job.input_payload?.filePath as string | undefined;
    const mimeType = (job.input_payload?.mimeType as string | undefined) ?? "image/jpeg";
    const contextBundle = job.input_payload?.context_bundle;
    const voiceGuide = job.input_payload?.voice_guide;
    const learningBundle = job.input_payload?.learning_bundle;
    // Phase 3a · NEX Object Storage reference · location-transparent.
    // When present, prefer this over the legacy machine-local filePath.
    const objectBucket = job.input_payload?.objectBucket as string | undefined;
    const objectKey    = job.input_payload?.objectKey    as string | undefined;

    if (!filePath && !(objectBucket && objectKey)) {
      throw new Error(`Image Analyst received no filePath and no objectBucket/objectKey for inbox item ${inboxItemId}`);
    }
    if (!SUPPORTED_MIMES.has(mimeType.toLowerCase())) {
      throw new Error(`Image Analyst: unsupported mime type ${mimeType}`);
    }

    // Load bytes. Phase 3a preference order:
    //   1. NEX Object Storage (location-transparent) if objectBucket/Key present
    //   2. Local filesystem fallback (legacy pre-Phase-3a items)
    // The "byteSource" telemetry marker lets the audit trail confirm
    // which path served the bytes.
    let bytes: Buffer;
    let byteSource: "nex-object-storage" | "filesystem-legacy";
    if (objectBucket && objectKey) {
      const obj = await getObjectStorage().get(objectBucket, objectKey);
      if (!obj) {
        throw new Error(`Image Analyst: NEX Object Storage returned null for ${objectBucket}/${objectKey}`);
      }
      bytes = obj.body;
      byteSource = "nex-object-storage";
    } else {
      const absPath = path.join(INBOX_ROOT, filePath!);
      bytes = await fs.readFile(absPath);
      byteSource = "filesystem-legacy";
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(
        `Image Analyst: image too large (${bytes.length} bytes; max ${MAX_IMAGE_BYTES})`
      );
    }
    const image: LlmImage = {
      mime: mimeType,
      data: bytes.toString("base64"),
    };

    // Compose user message: text prompt + image
    const userMessage = buildUserMessage({
      inbox_id: inboxItemId,
      source,
      title: inboxTitle,
      context: contextBundle,
      voice: voiceGuide,
      learning: learningBundle,
    });

    // Call vision-capable provider — Gemini primary (free), Anthropic fallback.
    // Skip Groq automatically via requires_capability: "vision".
    const { data, raw } = await completeJson<ImageAnalystOutput>(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage, images: [image] },
      ],
      {
        temperature: 0.2,
        max_tokens: 6144,
        prefer_provider: "gemini",
        requires_capability: "vision",
      }
    );

    // Persist each candidate record + claims + edges + source
    const draftRecordIds: string[] = [];
    for (const rec of data.candidate_records ?? []) {
      const draft = await store.insertRecord({
        record_id: rec.record_id,
        record_version: "1.0.0",
        status: "DRAFT",
        supersedes: null,
        canonical_owner: `NEX ${rec.category} · Image Analyst`,
        authored_by: `worker:image-analyst@${nowIso()}`,
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
        sustainability_alert: null,
        embedding: null,
        last_reviewed_at: null,
        review_due_at: null,
        deprecated_at: null,
      });
      draftRecordIds.push(draft.record_id);

      // Claims
      for (const [i, claim] of (rec.claims ?? []).entries()) {
        await store.insertConfidence({
          record_id: draft.record_id,
          claim_key: claim.claim_key ?? `observation_${i + 1}`,
          claim_text: claim.claim_text,
          classification: claim.classification,
          confidence_band: claim.confidence_band,
          confidence_score: claim.confidence_score,
          source_type: claim.source_type ?? "case_study",
          source_ref: claim.source_ref ?? `image:${inboxItemId}`,
          verification_date: null,
          rationale: claim.rationale ?? null,
        });
      }

      // Edges
      for (const edge of rec.edges ?? []) {
        await store.insertEdge({
          from_record_id: draft.record_id,
          to_record_id: edge.to_record_id,
          edge_type: edge.edge_type,
          confidence: null,
          provenance: edge.provenance ?? `image-analyst:${inboxItemId}`,
          is_gap_marker: Boolean(edge.is_gap_marker),
        });
      }

      // Source lineage — image_analysis pipeline
      await store.insertSource({
        record_id: draft.record_id,
        inbox_item_id: inboxItemId,
        source_tier: source,
        source_url: null,
        source_hash: null,
        excerpt:
          `Image analysis · ${rec.observed_style ?? "unclear style"} · ` +
          `materials: ${(rec.observed_materials ?? []).join(", ") || "unclear"} · ` +
          `components: ${(rec.observed_components ?? []).join(", ") || "unclear"} · ` +
          `construction: ${rec.observed_construction ?? "unclear"} · ` +
          `analyst confidence ${((rec.observed_confidence ?? 0.5) * 100).toFixed(0)}%`,
      });

      // Enqueue quality check
      await store.enqueueJob({
        worker_type: "quality-checker",
        priority: 3,
        input_kind: "record_draft",
        input_ref: draft.record_id,
        input_payload: { source, image_analyst_job_id: job.id },
      });

      // Audit
      await store.insertAudit({
        entity_type: "knowledge_records",
        entity_id: draft.record_id,
        action: "insert",
        actor: WORKER_ID,
        before_state: null,
        after_state: {
          status: "DRAFT",
          record_id: draft.record_id,
          observed_style: rec.observed_style,
          observed_materials: rec.observed_materials,
        },
        notes: `Image-authored draft from inbox item ${inboxItemId} (source: ${source})`,
      });
    }

    // Wave 11 · Step 8 · F35 · shared finalization sequence.
    // No `finalAudit` — image-analyst emits per-record audits inside
    // the for-loop above, matching the original divergence. That
    // divergence is genuine domain logic and stays inline; only the
    // insertResult → completeJob bracket converges.
    const result = await finalizeWorkerJob(store, {
      job,
      resultInput: {
        worker_type: "image-analyst",
        worker_id: WORKER_ID,
        output_kind: "record_draft",
        output_payload: {
          draft_record_ids: draftRecordIds,
          overall_notes: data.overall_notes ?? "",
          observed_summary: (data.candidate_records ?? []).map((r) => ({
            record_id: r.record_id,
            style: r.observed_style,
            materials: r.observed_materials,
            construction: r.observed_construction,
            confidence: r.observed_confidence,
          })),
        },
        overall_confidence: draftRecordIds.length > 0 ? 0.8 : 0,
        llm_provider: raw.provider,
        llm_model: raw.model,
        llm_tokens_in: raw.tokens_in,
        llm_tokens_out: raw.tokens_out,
        llm_ms: raw.ms,
        // Phase 3a · include byteSource so the audit trail proves whether
        // the image bytes came from NEX Object Storage (location-transparent)
        // or from the legacy per-machine filesystem. Every completed
        // image-analyst worker_result now carries a "bytes:<source>" flag.
        flags: [
          `bytes:${byteSource}`,
          ...(draftRecordIds.length === 0 ? ["no-records-extracted"] : []),
        ],
      },
    });
    return { job, result, draftRecordIds };
  } catch (err) {
    await failWorkerJob(store, job, err, "image-analyst");
    return { job, draftRecordIds: [] };
  }
}

// ── User message composition ─────────────────────────────────────────

function buildUserMessage(input: {
  inbox_id: string;
  source: KnowledgeSource;
  title: string;
  context?: {
    records?: Array<{
      record_id: string;
      title: string;
      category: string;
      summary: string;
      nex_concepts?: string[];
      industry_concepts?: string[];
    }>;
    gaps?: string[];
  };
  voice?: {
    applicable_brand_terms?: Array<{ brand: string; brand_plain: string; technical: string }>;
    primary_audience?: string;
    content_class?: string;
  };
  learning?: { examples?: Array<{ kind: string; lesson?: string | null; correction?: string | null }>; overall_lesson?: string };
}): string {
  const lines: string[] = [];
  lines.push(`INBOX IMAGE`);
  lines.push(`inbox_id: ${input.inbox_id}`);
  lines.push(`source:   ${input.source}`);
  lines.push(`title:    ${input.title}`);
  lines.push(``);

  // Compact context — only the record ids + summaries the analyst can link to.
  if (input.context?.records?.length) {
    lines.push(`RECORDS NEX ALREADY KNOWS (link via typed edges — don't re-author):`);
    for (const r of input.context.records.slice(0, 8)) {
      lines.push(`  · ${r.record_id} — ${r.title} — ${r.summary.slice(0, 120)}`);
    }
    if (input.context.gaps?.length) {
      lines.push(``);
      lines.push(`GAP KEYWORDS (candidates for new records if visible in image): ${input.context.gaps.slice(0, 12).join(", ")}`);
    }
    lines.push(``);
  }

  // Compact voice guide
  if (input.voice) {
    lines.push(`VOICE`);
    if (input.voice.primary_audience) lines.push(`  audience: ${input.voice.primary_audience}`);
    if (input.voice.content_class) lines.push(`  class:    ${input.voice.content_class}`);
    if (input.voice.applicable_brand_terms?.length) {
      lines.push(`  brand terms available:`);
      for (const t of input.voice.applicable_brand_terms.slice(0, 6)) {
        lines.push(`    · ${t.brand} (technical: ${t.technical})`);
      }
    }
    lines.push(``);
  }

  // Compact learning — just the summary + one lesson if present
  if (input.learning?.overall_lesson && input.learning.examples?.length) {
    lines.push(`PAST HUMAN FEEDBACK (weigh heavily): ${input.learning.overall_lesson}`);
    const topLesson = input.learning.examples.find((e) => e.lesson || e.correction);
    if (topLesson) {
      lines.push(`  Example: ${(topLesson.lesson ?? topLesson.correction ?? "").slice(0, 240)}`);
    }
    lines.push(``);
  }

  lines.push(
    `TASK: Look at the attached image. Extract structured knowledge per the schema. ` +
    `Aim for 1-2 focused records rather than one giant record. Prefer edges to existing records over re-authoring. ` +
    `Populate observed_style, observed_materials, observed_components, observed_construction with your best read even if partially uncertain. ` +
    `Respond with ONLY the JSON object.`
  );

  return lines.join("\n");
}
