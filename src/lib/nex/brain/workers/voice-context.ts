// NEX Brain · Voice & Brand Context Worker
//
// Philip 2026-08-06 doctrine:
//   "Brand language should never override factual accuracy. If a record
//   is purely technical or regulatory, it should stay precise. Brand
//   terminology should enhance the explanation, not replace it."
//
// The Voice Context Worker is the second retrieval specialist in the
// pipeline (after Knowledge Context). Its job:
//
//   Receive the topic + inbox content + context bundle.
//   Detect which registered brand terms are applicable.
//   Determine the primary audience (from the context bundle's records).
//   Classify the content (customer-facing / technical / regulatory / mixed).
//   Produce a voice_guide bundle telling the Extractor:
//     - which NEX brand terms to use where appropriate
//     - when NOT to use them (technical / regulatory content stays precise)
//     - which audience voice to adopt
//     - which tone principles apply
//
// The guide is a lookup + heuristic pass — no LLM call, ~5ms.
//
// Pipeline position:
//
//   inbox_item
//        │
//        ▼
//   knowledge-context      (records NEX already knows)
//        │
//        ▼
//   voice-context          ← THIS worker
//        │
//        ▼
//   knowledge-extractor    (authors with BOTH bundles)
//        │
//        ▼
//   quality-checker

import { brainStore, nowIso } from "../storage";
import {
  brandTerm,
  brandTermPlain,
  customerExplanation,
  technicalTerm,
  type BrandingKey,
} from "../../branding/terminology";
import type {
  KnowledgeSource,
  WorkerJob,
  WorkerResult,
} from "../types";
import type { ContextBundle } from "./knowledge-context";

const WORKER_ID = `voice-context@${process.pid}`;

// Trigger keywords per brand key. Case-insensitive substring match on
// the inbox content or on any retrieved context record's summary.
// Add triggers here whenever a new brand term is registered in
// terminology.ts. Keep triggers narrow so we don't over-apply.
const BRAND_TRIGGERS: Record<BrandingKey, string[]> = {
  "closed-string": [
    "closed string",
    "housed string",
    "solid string",
    "traditional string",
    "closed-string",
    "closed housed string",
  ],
  "split-newel": [
    "split newel",
    "split-base newel",
    "two-part newel",
    "newel post",
    "starting newel",
  ],
  "connected-staircase": [
    "connected staircase",
    "staircase family",
    "essentials tier",
    "classic tier",
    "heritage tier",
    "contemporary tier",
    "signature tier",
    "coordinated staircase",
  ],
  "nex-premium": [
    "premium specification",
    "premium tier",
    "architectural-grade",
    "premium presentation",
    "luxury specification",
  ],
};

export type VoiceGuideBrandTerm = {
  key: BrandingKey;
  brand: string;
  brand_plain: string;
  technical: string;
  customer_explanation: string;
  triggers_matched: string[];
  usage_note: string;
};

export type VoiceGuide = {
  inbox_item_id: string;
  input_source: KnowledgeSource;
  applicable_brand_terms: VoiceGuideBrandTerm[];
  primary_audience: "homeowner" | "manufacturer" | "engineer";
  audience_voice_note: string;
  content_class: "customer-facing" | "technical" | "regulatory" | "mixed";
  brand_use_policy: string;   // Philip's rule verbatim
  voice_tone_principles: string[];
  method: "keyword-v1";
};

// ── Main entry ───────────────────────────────────────────────────────

export async function runVoiceContext(options: {
  lease_seconds?: number;
} = {}): Promise<{ job: WorkerJob | null; result?: WorkerResult; guide?: VoiceGuide }> {
  const store = brainStore();
  const job = await store.claimNextJob("voice-context", WORKER_ID, options.lease_seconds ?? 30);
  if (!job) return { job: null };

  try {
    const inboxItemId = job.input_ref;
    const source = (job.input_payload?.source as KnowledgeSource | undefined) ?? "raw-research";
    const title = String(job.input_payload?.title ?? "untitled");
    const kind = (job.input_payload?.kind as string | undefined) ?? "text";
    const contentPath = job.input_payload?.contentPath as string | undefined;
    const inlineContent = job.input_payload?.content as string | undefined;
    const url = job.input_payload?.url as string | undefined;
    const filePath = job.input_payload?.filePath as string | undefined;
    // Phase 3a · NEX Object Storage reference propagation.
    const objectBucket = job.input_payload?.objectBucket as string | undefined;
    const objectKey    = job.input_payload?.objectKey    as string | undefined;
    const mimeType = job.input_payload?.mimeType as string | undefined;
    const contextBundle = job.input_payload?.context_bundle as ContextBundle | undefined;

    // Assemble scannable text: title + content preview + context summaries
    const contentPreview = (inlineContent ?? "").slice(0, 20_000);
    const contextSummaries = (contextBundle?.records ?? [])
      .map((r) => `${r.title}: ${r.summary}`)
      .join("\n");
    const scanText = `${title}\n${contentPreview}\n${contextSummaries}`;

    const applicable = detectApplicableBrandTerms(scanText);
    const primaryAudience = detectPrimaryAudience(contextBundle, source);
    const contentClass = classifyContent(scanText, applicable, primaryAudience);
    const audienceVoice = audienceVoiceNote(primaryAudience);
    const tonePrinciples = voiceTonePrinciples(source, primaryAudience);

    const guide: VoiceGuide = {
      inbox_item_id: inboxItemId,
      input_source: source,
      applicable_brand_terms: applicable,
      primary_audience: primaryAudience,
      audience_voice_note: audienceVoice,
      content_class: contentClass,
      brand_use_policy:
        "Brand language enhances the explanation — it never overrides factual accuracy. " +
        "For customer-facing content, use brand form first (with the ™ symbol) then plain form; " +
        "always bridge to the technical term on first mention. " +
        "For technical or regulatory content, use the industry term throughout — brand terms are optional " +
        "and only in section framings, never in normative rules. (Philip 2026-08-06)",
      voice_tone_principles: tonePrinciples,
      method: "keyword-v1",
    };

    // Log
    const result = await store.insertResult({
      job_id: job.id,
      worker_type: "voice-context",
      worker_id: WORKER_ID,
      output_kind: "voice_guide",
      output_payload: guide as unknown as Record<string, unknown>,
      overall_confidence: applicable.length > 0 ? 0.9 : 0.5,
      llm_provider: "no-llm",
      llm_model: null,
      llm_tokens_in: null,
      llm_tokens_out: null,
      llm_ms: null,
      flags: applicable.length === 0 ? ["no-brand-terms-applicable"] : [],
    });

    // Enqueue Learning Context with the accumulated bundles.
    // Learning Context will retrieve past feedback + enqueue the
    // Extractor with all three bundles attached.
    await store.enqueueJob({
      worker_type: "learning-context",
      priority: sourcePriority(source),
      input_kind: "inbox_item",
      input_ref: inboxItemId,
      input_payload: {
        source,
        title,
        kind,
        contentPath: contentPath ?? null,
        content: inlineContent ?? null,
        url: url ?? null,
        filePath: filePath ?? null,
        objectBucket: objectBucket ?? null,   // Phase 3a
        objectKey:    objectKey    ?? null,   // Phase 3a
        mimeType: mimeType ?? null,
        knowledge_job_id: (job.input_payload as { knowledge_job_id?: string | null } | null)?.knowledge_job_id ?? null,
        context_bundle: contextBundle,
        voice_guide: guide,
      },
    });

    await store.insertAudit({
      entity_type: "worker_jobs",
      entity_id: inboxItemId,
      action: "voice-guide-assembled",
      actor: WORKER_ID,
      before_state: null,
      after_state: {
        brand_terms_applicable: applicable.map((a) => a.key),
        primary_audience: primaryAudience,
        content_class: contentClass,
      },
      notes: `Voice guide produced with ${applicable.length} brand term(s); primary audience: ${primaryAudience}; class: ${contentClass}`,
    });

    await store.completeJob(job.id, result.id);
    return { job, result, guide };
  } catch (err) {
    const message = (err as Error).message;
    console.error("[voice-context] failed:", message);
    await store.failJob(job.id, message);
    return { job };
  }
}

// ── Brand term detection ────────────────────────────────────────────

function detectApplicableBrandTerms(scanText: string): VoiceGuideBrandTerm[] {
  const lower = scanText.toLowerCase();
  const applicable: VoiceGuideBrandTerm[] = [];
  for (const [key, triggers] of Object.entries(BRAND_TRIGGERS) as Array<[BrandingKey, string[]]>) {
    const matched = triggers.filter((t) => lower.includes(t.toLowerCase()));
    if (matched.length > 0) {
      applicable.push({
        key,
        brand: brandTerm(key),
        brand_plain: brandTermPlain(key),
        technical: technicalTerm(key),
        customer_explanation: customerExplanation(key),
        triggers_matched: matched,
        usage_note: usageNoteFor(key),
      });
    }
  }
  return applicable;
}

function usageNoteFor(key: BrandingKey): string {
  switch (key) {
    case "closed-string":
      return "Customer-facing surfaces use NexString™ first, NexString plain subsequently, with 'closed string staircase' as the industry bridge. Engineering docs and regulatory records use 'closed string' throughout.";
    case "split-newel":
      return "Customer-facing surfaces use Nex Newel™ Split Base Design first, Nex Newel Split Base subsequently. Engineering and joinery specifications use 'split newel post' throughout.";
    case "connected-staircase":
      return "Use Connected Staircase™ when framing the family of tiers (Essentials/Classic/Heritage/Contemporary/Signature). Do not use for isolated technical descriptions.";
    case "nex-premium":
      return "Use NEX Premium™ as a presentation layer header. Not a tier itself — can be applied to any Connected Staircase™ tier. Optional even on premium content.";
  }
}

// ── Audience detection ─────────────────────────────────────────────

function detectPrimaryAudience(
  contextBundle: ContextBundle | undefined,
  source: KnowledgeSource
): "homeowner" | "manufacturer" | "engineer" {
  // Vote by top-scoring records' audience
  if (contextBundle && contextBundle.records.length > 0) {
    const votes = new Map<string, number>();
    for (const r of contextBundle.records) {
      const w = r.score;
      votes.set(r.primary_audience, (votes.get(r.primary_audience) ?? 0) + w);
    }
    const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (winner) {
      const aud = winner[0];
      if (aud === "homeowner" || aud === "manufacturer" || aud === "engineer") return aud;
    }
  }
  // Fall back to source-implied default
  switch (source) {
    case "gov-standards":
      return "engineer";
    case "customer-qa":
      return "homeowner";
    case "chatgpt-approved":
    case "claude-generated":
      return "homeowner";
    case "raw-research":
    case "internet-article":
      return "manufacturer";
    default:
      return "homeowner";
  }
}

function audienceVoiceNote(audience: "homeowner" | "manufacturer" | "engineer"): string {
  switch (audience) {
    case "homeowner":
      return "Warm, cheeky, down-to-earth conversational tone. Explain like a knowledgeable friend across the kitchen table. Prefer NEX brand terms with a bridge to the industry term on first mention.";
    case "manufacturer":
      return "Peer-to-peer trade voice. Confident, precise, respectful of the craft. Assume the reader is a working joiner or workshop owner. Use technical terminology primarily; brand terms in section framings only.";
    case "engineer":
      return "Expert-defensible precision. Assume the reader will challenge every claim. Cite standards and named specifications. Use industry vocabulary throughout — brand terms are optional and only for high-level orientation.";
  }
}

// ── Content classification ─────────────────────────────────────────

function classifyContent(
  scanText: string,
  applicable: VoiceGuideBrandTerm[],
  audience: "homeowner" | "manufacturer" | "engineer"
): "customer-facing" | "technical" | "regulatory" | "mixed" {
  const lower = scanText.toLowerCase();
  const regulatorySignals = [
    "approved document",
    "regulation",
    "part k",
    "part b",
    "building regs",
    "bs 5395",
    "bs 6180",
    "coshh",
    "cites",
    "iarc",
    "compliance",
    "must not exceed",
    "must not be less than",
    "shall be",
  ];
  const regHits = regulatorySignals.filter((s) => lower.includes(s)).length;
  if (regHits >= 2) return "regulatory";

  const technicalSignals = [
    "dimension",
    "millimetre",
    "specification",
    "moisture content",
    "kiln",
    "janka",
    "density",
    "structural",
    "load capacity",
    "workshop",
    "manufactur",
    "specify",
  ];
  const techHits = technicalSignals.filter((s) => lower.includes(s)).length;

  if (audience === "engineer" || techHits >= 4) return "technical";
  if (audience === "homeowner" && techHits < 2) return "customer-facing";
  return "mixed";
}

// ── Voice tone principles ──────────────────────────────────────────

function voiceTonePrinciples(
  source: KnowledgeSource,
  audience: "homeowner" | "manufacturer" | "engineer"
): string[] {
  const base = [
    "Never use 'At NEX, we…' phrasing (HARD LAW).",
    "Never invent facts — mark uncertainty as 'design_opinion' with low confidence.",
    "Prefer active voice over passive.",
    "Short sentences over long compound ones.",
  ];
  const audienceSpecific: Record<typeof audience, string[]> = {
    homeowner: [
      "Warm and slightly cheeky — Nex's personality shines through.",
      "Explain jargon in the same sentence you introduce it.",
      "Address the reader as 'you'; use 'we' sparingly (never 'we at NEX').",
      "Use NEX brand terms first-mention, plain subsequently, with an industry-term bridge.",
    ],
    manufacturer: [
      "Peer-to-peer respect — this reader knows the craft.",
      "Assume familiarity with joinery vocabulary.",
      "Use technical terminology as the primary; brand terms only in section framings.",
      "Cite manufacturer specs and industry references where relevant.",
    ],
    engineer: [
      "Expert-defensible — every claim should be traceable to a source.",
      "Precision beats warmth. Never soften a load figure or a regulation.",
      "Use industry vocabulary throughout. Brand terms are optional.",
      "Cite BS / EN / Approved Document references in normative claims.",
    ],
  };
  const sourceSpecific: Partial<Record<KnowledgeSource, string[]>> = {
    "gov-standards": [
      "Defer to the authoritative text — quote it, do not paraphrase.",
      "Every dimensional or load claim must cite its Approved Document / BS reference.",
    ],
    "chatgpt-approved": [
      "Preserve the source wording where correct; enhance with brand terms only where content is customer-facing.",
    ],
    "personal-ideas": [
      "Store as NEX_concept classification only; never mix with industry-standard claims.",
    ],
  };
  return [...base, ...audienceSpecific[audience], ...(sourceSpecific[source] ?? [])];
}

// ── Priority mapping (mirrors manager.ts) ───────────────────────────

function sourcePriority(source: KnowledgeSource): number {
  switch (source) {
    case "gov-standards":      return 1;
    case "chatgpt-approved":   return 2;
    case "claude-generated":   return 2;
    case "customer-qa":        return 3;
    case "raw-research":       return 4;
    case "internet-article":   return 5;
    case "personal-ideas":     return 6;
    case "needs-verification": return 7;
    default:                   return 5;
  }
}
