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
// Wave 11 · Step 8 · F35 · shared finalization sequence.
import { finalizeWorkerJob, failWorkerJob } from "./_finalize";
// W-OBS-1 Path A Layer 1 · CID inherit from job.input_payload.
import { enterJobCorrelationScope } from "@/lib/nex/observability/correlation";
// F4 structured logger · Wave 3 H2.b · adopted 2026-08-10.
import { logger } from "@/lib/nex/observability/logger";

const log = logger("worker.voice-context");
void log; // reserved for future structured events; drift-catcher requires import.
// Wave 11 · Step 9 · F33 · shared canonical priority table.
import { sourcePriority } from "../priorities";
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

  // Step 1 · Blake audience classifier rebuild · 2026-08-10.
  //
  // Machine-readable classification metadata · first-class outcomes ·
  // NOT log strings. Precedence (locked):
  //   1. explicit metadata hint (input_payload.audience_hint)
  //   2. explicit in-body directive (parsed from dump content)
  //   3. source-type contract (chatgpt-approved → homeowner · etc.)
  //   4. contextual evidence (vote from context bundle · INFORMATIONAL
  //      · NEVER overrides a stronger signal above)
  //   5. default (homeowner)
  //
  // Rule: context is evidence, never authority over a stronger source
  // contract. When a stronger signal disagrees with context, the
  // stronger signal wins AND `classification_disagreement=true` is set
  // with a machine-friendly reason string. Disagreement is a first-
  // class outcome · downstream tooling reads it structurally.
  classification_source: "metadata_hint" | "explicit_body" | "source_contract" | "context_vote" | "default";
  classification_confidence: number;              // 0.0 .. 1.0
  classification_disagreement: boolean;
  classification_disagreement_reason: string | null;
  classification_context_vote: { audience: "homeowner" | "manufacturer" | "engineer"; weight: number } | null;
  classification_source_contract: "homeowner" | "manufacturer" | "engineer" | null;
  classification_explicit_phrase: string | null;  // when explicit_body wins · the matched directive
};

// ── Main entry ───────────────────────────────────────────────────────

export async function runVoiceContext(options: {
  lease_seconds?: number;
} = {}): Promise<{ job: WorkerJob | null; result?: WorkerResult; guide?: VoiceGuide }> {
  const store = brainStore();
  const job = await store.claimNextJob("voice-context", WORKER_ID, options.lease_seconds ?? 30);
  if (!job) return { job: null };
  enterJobCorrelationScope(job);  // W-OBS-1 Path A Layer 1 · CID inherit

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
    // Step 1 · Blake rebuild · resolve full audience classification.
    // Reads: metadata hint (input_payload.audience_hint) · in-body directive
    // (parses contentPreview) · source-type contract · context vote · default.
    // Precedence + disagreement flagging: see resolveAudienceClassification.
    const metadataHint = parseAudienceHintFromMetadata(job.input_payload);
    const audienceClassification = resolveAudienceClassification({
      body: inlineContent,
      metadataHint,
      source,
      contextBundle,
    });
    const primaryAudience = audienceClassification.primary_audience;
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
      // Step 1 · machine-readable audience classification metadata.
      classification_source:              audienceClassification.classification_source,
      classification_confidence:          audienceClassification.classification_confidence,
      classification_disagreement:        audienceClassification.classification_disagreement,
      classification_disagreement_reason: audienceClassification.classification_disagreement_reason,
      classification_context_vote:        audienceClassification.classification_context_vote,
      classification_source_contract:     audienceClassification.classification_source_contract,
      classification_explicit_phrase:     audienceClassification.classification_explicit_phrase,
    };

    // Wave 11 · Step 8 · F35 · shared finalization sequence.
    const result = await finalizeWorkerJob(store, {
      job,
      resultInput: {
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
      },
      nextJob: {
        // Enqueue Learning Context with the accumulated bundles ·
        // Learning Context retrieves past feedback + enqueues the
        // Extractor with all three bundles attached.
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
      },
      finalAudit: {
        entity_type: "worker_jobs",
        entity_id: inboxItemId,
        action: "voice-guide-assembled",
        actor: WORKER_ID,
        before_state: null,
        after_state: {
          brand_terms_applicable:             applicable.map((a) => a.key),
          primary_audience:                   primaryAudience,
          content_class:                      contentClass,
          // Step 1 · classification metadata exposed in audit for downstream review.
          classification_source:              audienceClassification.classification_source,
          classification_confidence:          audienceClassification.classification_confidence,
          classification_disagreement:        audienceClassification.classification_disagreement,
          classification_disagreement_reason: audienceClassification.classification_disagreement_reason,
          classification_context_vote:        audienceClassification.classification_context_vote,
          classification_source_contract:     audienceClassification.classification_source_contract,
          classification_explicit_phrase:     audienceClassification.classification_explicit_phrase,
        },
        notes:
          `Voice guide produced with ${applicable.length} brand term(s); ` +
          `primary audience: ${primaryAudience} (source=${audienceClassification.classification_source}, ` +
          `confidence=${audienceClassification.classification_confidence.toFixed(2)}` +
          (audienceClassification.classification_disagreement ? `, disagreement=${audienceClassification.classification_disagreement_reason}` : ``) +
          `); class: ${contentClass}`,
      },
    });
    return { job, result, guide };
  } catch (err) {
    await failWorkerJob(store, job, err, "voice-context");
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

// Step 1 · Blake audience classifier rebuild · 2026-08-10.
//
// Precedence (locked · Philip 2026-08-10 acceptance contract):
//   1. metadata_hint       — input_payload.audience_hint (structured)
//   2. explicit_body       — dump body carries a directive phrase
//   3. source_contract     — source-type contract (chatgpt-approved → homeowner · etc.)
//   4. context_vote        — vote from Mason's contextBundle · INFORMATIONAL ONLY
//   5. default             — homeowner
//
// Context is evidence · never authority over a stronger signal above it.
// Disagreements produce a first-class flag with a machine-readable reason ·
// they never silently switch the winning audience.

type AudienceValue = "homeowner" | "manufacturer" | "engineer";

type AudienceClassification = {
  primary_audience:                   AudienceValue;
  classification_source:              "metadata_hint" | "explicit_body" | "source_contract" | "context_vote" | "default";
  classification_confidence:          number;
  classification_disagreement:        boolean;
  classification_disagreement_reason: string | null;
  classification_context_vote:        { audience: AudienceValue; weight: number } | null;
  classification_source_contract:     AudienceValue | null;
  classification_explicit_phrase:     string | null;
};

// Explicit in-body directive patterns · narrow · high-precision.
// Order matters only within a class · first hit per class wins.
// Adding here is a governance change · patterns must be unambiguous.
const EXPLICIT_BODY_PATTERNS: Array<{ audience: AudienceValue; pattern: RegExp; label: string }> = [
  // Homeowner / customer directives
  { audience: "homeowner",    pattern: /\*?\*?(?:primary\s+)?audience\*?\*?\s*[:=]\s*(?:homeowner|customer|customer-facing)\b/i,                            label: "audience:homeowner" },
  { audience: "homeowner",    pattern: /keep\s+(?:the\s+content|this)?\s*customer[-\s]?facing/i,                                                            label: "keep customer-facing" },
  { audience: "homeowner",    pattern: /content\s+should\s+be\s+customer[-\s]?facing/i,                                                                     label: "content should be customer-facing" },
  { audience: "homeowner",    pattern: /do\s+not\s+(?:automatically\s+)?classify\s+this\s+as\s+manufacturer/i,                                              label: "do not classify as manufacturer" },
  { audience: "homeowner",    pattern: /customer[-\s]?facing\s+(?:staircase\s+)?(?:design\s+)?knowledge/i,                                                  label: "customer-facing knowledge" },
  // Manufacturer / trade directives
  { audience: "manufacturer", pattern: /\*?\*?(?:primary\s+)?audience\*?\*?\s*[:=]\s*(?:manufacturer|trade|joiner|workshop)\b/i,                            label: "audience:manufacturer" },
  // Engineer / regulatory directives
  { audience: "engineer",     pattern: /\*?\*?(?:primary\s+)?audience\*?\*?\s*[:=]\s*(?:engineer|engineering|regulatory)\b/i,                              label: "audience:engineer" },
];

function parseAudienceHintFromMetadata(payload: unknown): AudienceValue | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const hint = p.audience_hint;
  if (hint === "homeowner" || hint === "manufacturer" || hint === "engineer") return hint;
  return null;
}

function parseExplicitBodyDirective(body: string | undefined): { audience: AudienceValue; phrase: string; conflicting_hits: AudienceValue[] } | null {
  if (!body) return null;
  // Scan the first 20K chars — dumps universally place directives near the top.
  const scan = body.slice(0, 20_000);
  const hits: Array<{ audience: AudienceValue; label: string }> = [];
  for (const p of EXPLICIT_BODY_PATTERNS) {
    if (p.pattern.test(scan)) hits.push({ audience: p.audience, label: p.label });
  }
  if (hits.length === 0) return null;
  const first = hits[0];
  const conflicting = hits.filter((h) => h.audience !== first.audience).map((h) => h.audience);
  return { audience: first.audience, phrase: first.label, conflicting_hits: conflicting };
}

function sourceContractAudience(source: KnowledgeSource): AudienceValue | null {
  // Source-type contract · well-defined per source · returns null when
  // the source-type doesn't imply a specific audience (rare · every
  // documented source has a contract).
  switch (source) {
    case "gov-standards":       return "engineer";
    case "customer-qa":         return "homeowner";
    case "chatgpt-approved":    return "homeowner";
    case "claude-generated":    return "homeowner";
    case "raw-research":        return "manufacturer";
    case "internet-article":    return "manufacturer";
    case "needs-verification":  return null;                // no strong contract
    case "personal-ideas":      return null;                // no strong contract
    default:                    return null;
  }
}

function voteAudienceFromContext(contextBundle: ContextBundle | undefined): { audience: AudienceValue; weight: number; top2_gap: number } | null {
  if (!contextBundle || contextBundle.records.length === 0) return null;
  const votes = new Map<AudienceValue, number>();
  for (const r of contextBundle.records) {
    const aud = r.primary_audience;
    if (aud !== "homeowner" && aud !== "manufacturer" && aud !== "engineer") continue;
    votes.set(aud, (votes.get(aud) ?? 0) + r.score);
  }
  if (votes.size === 0) return null;
  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = sorted;
  const gap = top[1] - (second?.[1] ?? 0);
  return { audience: top[0], weight: top[1], top2_gap: gap };
}

function resolveAudienceClassification(input: {
  body: string | undefined;
  metadataHint: AudienceValue | null;
  source: KnowledgeSource;
  contextBundle: ContextBundle | undefined;
}): AudienceClassification {
  const explicitBody = parseExplicitBodyDirective(input.body);
  const contract = sourceContractAudience(input.source);
  const vote = voteAudienceFromContext(input.contextBundle);
  const contextVote = vote ? { audience: vote.audience, weight: vote.weight } : null;

  // Level 1 · metadata hint (explicit structured declaration)
  if (input.metadataHint) {
    const disagreement =
      (explicitBody && explicitBody.audience !== input.metadataHint) ||
      (contract     && contract              !== input.metadataHint) ||
      (vote         && vote.audience         !== input.metadataHint);
    let reason: string | null = null;
    if (explicitBody && explicitBody.audience !== input.metadataHint) reason = "metadata_hint_disagrees_with_explicit_body";
    else if (contract && contract !== input.metadataHint)             reason = "metadata_hint_disagrees_with_source_contract";
    else if (vote && vote.audience !== input.metadataHint)            reason = "metadata_hint_disagrees_with_context_vote";
    return {
      primary_audience:                   input.metadataHint,
      classification_source:              "metadata_hint",
      classification_confidence:          disagreement ? 0.85 : 0.95,
      classification_disagreement:        Boolean(disagreement),
      classification_disagreement_reason: reason,
      classification_context_vote:        contextVote,
      classification_source_contract:     contract,
      classification_explicit_phrase:     explicitBody?.phrase ?? null,
    };
  }

  // Level 2 · explicit in-body directive
  if (explicitBody) {
    const disagreesWithContract = contract     && contract              !== explicitBody.audience;
    const disagreesWithVote     = vote         && vote.audience         !== explicitBody.audience;
    const disagreesInternally   = explicitBody.conflicting_hits.length > 0;
    const disagreement = Boolean(disagreesWithContract || disagreesWithVote || disagreesInternally);
    let reason: string | null = null;
    if (disagreesInternally)        reason = "explicit_body_contains_conflicting_directives";
    else if (disagreesWithContract) reason = "explicit_body_disagrees_with_source_contract";
    else if (disagreesWithVote)     reason = "explicit_body_disagrees_with_context_vote";
    return {
      primary_audience:                   explicitBody.audience,
      classification_source:              "explicit_body",
      classification_confidence:          disagreement ? 0.80 : 0.90,
      classification_disagreement:        disagreement,
      classification_disagreement_reason: reason,
      classification_context_vote:        contextVote,
      classification_source_contract:     contract,
      classification_explicit_phrase:     explicitBody.phrase,
    };
  }

  // Level 3 · source-type contract
  if (contract) {
    const disagreesWithVote = vote && vote.audience !== contract;
    return {
      primary_audience:                   contract,
      classification_source:              "source_contract",
      classification_confidence:          disagreesWithVote ? 0.65 : 0.75,
      classification_disagreement:        Boolean(disagreesWithVote),
      classification_disagreement_reason: disagreesWithVote ? "context_vote_disagrees_with_source_contract" : null,
      classification_context_vote:        contextVote,
      classification_source_contract:     contract,
      classification_explicit_phrase:     null,
    };
  }

  // Level 4 · context vote (only reached when metadata/body/contract all absent)
  if (vote) {
    // Ambiguous context (close vote between top 2 audiences) lowers confidence.
    const ambiguous = vote.top2_gap < vote.weight * 0.25;
    return {
      primary_audience:                   vote.audience,
      classification_source:              "context_vote",
      classification_confidence:          ambiguous ? 0.40 : 0.55,
      classification_disagreement:        ambiguous,
      classification_disagreement_reason: ambiguous ? "conflicting_context_evidence" : null,
      classification_context_vote:        contextVote,
      classification_source_contract:     null,
      classification_explicit_phrase:     null,
    };
  }

  // Level 5 · default
  return {
    primary_audience:                   "homeowner",
    classification_source:              "default",
    classification_confidence:          0.30,
    classification_disagreement:        false,
    classification_disagreement_reason: null,
    classification_context_vote:        null,
    classification_source_contract:     null,
    classification_explicit_phrase:     null,
  };
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

// Wave 11 · Step 9 · F33 · sourcePriority now imported from the
// canonical `src/lib/nex/brain/priorities.ts` (see imports at top).
