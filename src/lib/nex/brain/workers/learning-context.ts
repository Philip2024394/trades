// NEX Brain · Learning Context Worker
//
// Philip 2026-08-06 doctrine · milestone #3 (self-improvement loop):
// "Learning from your approved edits" — every correction, approval, edit,
// or rejection is a signal. The system should USE those signals to
// improve future authoring.
//
// The Learning Context Worker is the third retrieval specialist in the
// pipeline (after Knowledge Context and Voice Context). Its job:
//
//   Receive the topic + inbox content + prior bundles.
//   Read recent knowledge_feedback rows (approvals, edits, rejections,
//     corrections, voice_drift flags).
//   Score by relevance to the current topic (keyword overlap on the
//     feedback's domain/topic_tags/question/nex_answer).
//   Return the top N most relevant as a learning_bundle.
//   Enqueue the Extractor with all three bundles attached.
//
// The bundle format is designed for direct injection as few-shot
// examples in the Extractor's prompt: "PAST DECISIONS BY PHILIP · when
// Groq produced X, Philip approved / edited / rejected."
//
// Feedback types the worker uses:
//   · approval        → "keep doing this" reinforcement examples
//   · edit            → "you produced X, Philip changed to Y" — the
//                        highest-signal type; each edit contains the
//                        specific improvement Philip wanted
//   · rejection       → "this pattern was wrong" avoidance examples
//   · correction      → specific claim was wrong; here's the right answer
//   · voice_drift     → tone/voice needed adjustment
//   · gap             → NEX didn't know something; note the gap
//
// Pipeline position (v3):
//
//   inbox_item
//        │
//        ▼
//   knowledge-context      (records NEX already knows)
//        │
//        ▼
//   voice-context          (brand terms + audience + tone)
//        │
//        ▼
//   learning-context       ← THIS worker · past human decisions
//        │
//        ▼
//   knowledge-extractor    (authors with ALL THREE bundles)
//        │
//        ▼
//   quality-checker

import { brainStore, nowIso } from "../storage";
import type {
  KnowledgeFeedback,
  KnowledgeSource,
  WorkerJob,
  WorkerResult,
} from "../types";
import type { ContextBundle } from "./knowledge-context";
import type { VoiceGuide } from "./voice-context";

const WORKER_ID = `learning-context@${process.pid}`;

// Philip 2026-08-06 caution: "Don't blindly reinforce every approval.
// If you approved a pattern 18 months ago, but regulations have
// changed, the Learning Context shouldn't always inject that lesson."
//
// Weighting rules baked into the scorer below:
//   · Age decay      — score drops linearly from 1.0 (fresh) toward
//                       0.2 over ~180 days; nothing below the FLOOR
//                       is injected at all.
//   · Confirmation   — the same lesson (matching lesson_text) appearing
//                       repeatedly in the window gets a per-repeat boost.
//   · Supersession   — feedback tied to a record whose status is now
//                       DEPRECATED or SUPERSEDED is skipped entirely.
//   · Domain scoping — currently a soft boost via keyword overlap;
//                       when the corpus grows we can tighten this.
const RECENT_WINDOW_DAYS = 180;
const AGE_HARD_FLOOR_DAYS = 365;      // older than this → not injected at all
const AGE_FULL_WEIGHT_DAYS = 14;      // within this → no decay
const MAX_BUNDLE_SIZE = 8;
const CANDIDATE_POOL_SIZE = 100;      // fetch this many then rank

export type LearningExample = {
  kind: KnowledgeFeedback["feedback_kind"];
  severity: KnowledgeFeedback["severity"];
  question?: string | null;
  nex_answer?: string | null;
  correction?: string | null;
  lesson?: string | null;
  record_id?: string | null;
  domain?: string | null;
  topic_tags?: string[];
  submitted_by?: string | null;
  created_at: string;
  relevance_score: number;
};

export type LearningBundle = {
  inbox_item_id: string;
  input_source: KnowledgeSource;
  method: "keyword-v1";
  window_days: number;
  candidates_scanned: number;
  examples: LearningExample[];
  overall_lesson: string; // one-line synthesis when possible
};

// ── Main entry ───────────────────────────────────────────────────────

export async function runLearningContext(options: {
  lease_seconds?: number;
} = {}): Promise<{ job: WorkerJob | null; result?: WorkerResult; bundle?: LearningBundle }> {
  const store = brainStore();
  const job = await store.claimNextJob("learning-context", WORKER_ID, options.lease_seconds ?? 30);
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
    const mimeType = job.input_payload?.mimeType as string | undefined;
    const contextBundle = job.input_payload?.context_bundle as ContextBundle | undefined;
    const voiceGuide = job.input_payload?.voice_guide as VoiceGuide | undefined;

    // Get scannable text — title + first 20K of content + related record titles
    const contentPreview = (inlineContent ?? "").slice(0, 20_000);
    const contextTitles = (contextBundle?.records ?? []).map((r) => r.title).join(" ");
    const scanText = `${title}\n${contentPreview}\n${contextTitles}`;
    const topicKeywords = extractTopicKeywords(scanText);
    const relatedRecordIds = new Set((contextBundle?.records ?? []).map((r) => r.record_id));

    // Fetch a candidate pool of recent feedback (already sorted newest-first)
    const allFeedback = await store.listFeedback({ limit: CANDIDATE_POOL_SIZE });
    const cutoffMs = Date.now() - AGE_HARD_FLOOR_DAYS * 24 * 60 * 60 * 1000;
    const recent = allFeedback.filter(
      (f) => new Date(f.created_at).getTime() >= cutoffMs
    );

    // Compute confirmation counts — same lesson text appearing multiple
    // times gets a per-repeat boost. This is how "repeatedly confirmed"
    // lessons naturally carry more weight than one-offs.
    const confirmationCounts = countConfirmations(recent);

    // Find records that have been superseded/deprecated so we can skip
    // any approvals tied to them (their guidance is stale by definition).
    const supersededRecordIds = new Set<string>();
    const allRecords = await store.listRecords({ limit: 5000 });
    for (const r of allRecords) {
      if (r.status === "DEPRECATED" || r.status === "SUPERSEDED") {
        supersededRecordIds.add(r.record_id);
      }
    }

    // Score by relevance × age × confirmation, skipping superseded feedback
    const scored: LearningExample[] = [];
    for (const f of recent) {
      // Supersession skip
      if (f.record_id && supersededRecordIds.has(f.record_id)) continue;

      const rawScore = scoreFeedback(f, topicKeywords, relatedRecordIds, source);
      if (rawScore <= 0) continue;

      const ageWeight = ageDecay(f.created_at);
      const confirmations = confirmationCounts.get(lessonKey(f)) ?? 1;
      const confirmationBoost = 1 + Math.log2(confirmations); // 1x for one, ~2x for four, ~2.6x for eight

      const weightedScore = rawScore * ageWeight * confirmationBoost;

      scored.push({
        kind: f.feedback_kind,
        severity: f.severity,
        question: f.question ?? null,
        nex_answer: f.nex_answer ?? null,
        correction: f.correction ?? null,
        lesson: f.lesson ?? null,
        record_id: f.record_id ?? null,
        domain: f.domain ?? null,
        topic_tags: f.topic_tags ?? [],
        submitted_by: f.submitted_by ?? null,
        created_at: f.created_at,
        relevance_score: Math.round(weightedScore * 100) / 100,
      });
    }

    // Sort by relevance desc + severity boost
    scored.sort((a, b) => b.relevance_score - a.relevance_score);
    const examples = scored.filter((e) => e.relevance_score > 0).slice(0, MAX_BUNDLE_SIZE);

    const overallLesson = summariseLesson(examples);

    const bundle: LearningBundle = {
      inbox_item_id: inboxItemId,
      input_source: source,
      method: "keyword-v1",
      window_days: RECENT_WINDOW_DAYS,
      candidates_scanned: recent.length,
      examples,
      overall_lesson: overallLesson,
    };

    // Log the result
    const result = await store.insertResult({
      job_id: job.id,
      worker_type: "learning-context",
      worker_id: WORKER_ID,
      output_kind: "learning_bundle",
      output_payload: bundle as unknown as Record<string, unknown>,
      overall_confidence: examples.length > 0 ? Math.min(1, examples[0].relevance_score / 20) : 0.5,
      llm_provider: "no-llm",
      llm_model: null,
      llm_tokens_in: null,
      llm_tokens_out: null,
      llm_ms: null,
      flags: examples.length === 0
        ? recent.length === 0
          ? ["no-feedback-in-window"]
          : ["no-relevant-feedback"]
        : [],
    });

    // Route the final authoring stage by inbox item kind:
    //   image → image-analyst (vision-capable LLM)
    //   text/url (and everything else) → knowledge-extractor
    // Voice notes and file uploads will grow their own specialist workers
    // later; until then they route to knowledge-extractor which handles
    // them gracefully by treating any content as text.
    const nextWorker = kind === "image" ? "image-analyst" : "knowledge-extractor";
    await store.enqueueJob({
      worker_type: nextWorker,
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
        mimeType: mimeType ?? null,
        knowledge_job_id: (job.input_payload as { knowledge_job_id?: string | null } | null)?.knowledge_job_id ?? null,
        context_bundle: contextBundle,
        voice_guide: voiceGuide,
        learning_bundle: bundle,
      },
    });

    // Mark selected feedback rows as applied so we can see the loop
    // completing (feedback → prompt influence → future improvements)
    for (const ex of examples) {
      // Find the original by matching creation timestamp (fs backend has
      // no query-by-id shortcut here, but the shape is enough).
      const original = allFeedback.find((f) => f.created_at === ex.created_at && f.feedback_kind === ex.kind);
      if (original && !original.applied_to_prompts) {
        await store.markFeedbackApplied(original.id);
      }
    }

    await store.insertAudit({
      entity_type: "worker_jobs",
      entity_id: inboxItemId,
      action: "learning-bundle-assembled",
      actor: WORKER_ID,
      before_state: null,
      after_state: {
        candidates_scanned: recent.length,
        examples_selected: examples.length,
        window_days: RECENT_WINDOW_DAYS,
      },
      notes: `Learning bundle produced with ${examples.length}/${recent.length} feedback examples relevant to topic`,
    });

    await store.completeJob(job.id, result.id);
    return { job, result, bundle };
  } catch (err) {
    const message = (err as Error).message;
    console.error("[learning-context] failed:", message);
    await store.failJob(job.id, message);
    return { job };
  }
}

// ── Scoring ──────────────────────────────────────────────────────────

function scoreFeedback(
  f: KnowledgeFeedback,
  topicKeywords: Set<string>,
  relatedRecordIds: Set<string>,
  source: KnowledgeSource
): number {
  let score = 0;

  // Direct record match — feedback about a record the current topic
  // touches is highly relevant.
  if (f.record_id && relatedRecordIds.has(f.record_id)) score += 15;

  // Domain match (e.g. current dump about staircases, past feedback
  // about staircases)
  if (f.domain) {
    const domainLower = f.domain.toLowerCase();
    for (const kw of topicKeywords) {
      if (domainLower.includes(kw)) {
        score += 5;
        break;
      }
    }
  }

  // Topic-tag match
  if (f.topic_tags) {
    for (const tag of f.topic_tags) {
      if (topicKeywords.has(tag.toLowerCase())) score += 4;
    }
  }

  // Content match on question / nex_answer / correction / lesson
  const contentBlob = [
    f.question ?? "",
    f.nex_answer ?? "",
    f.correction ?? "",
    f.lesson ?? "",
  ]
    .join(" ")
    .toLowerCase();
  let contentHits = 0;
  for (const kw of topicKeywords) {
    if (contentBlob.includes(kw)) contentHits += 1;
  }
  score += Math.min(10, contentHits * 2);

  // Severity boost — critical and moderate corrections matter more
  if (f.severity === "critical") score += 6;
  else if (f.severity === "moderate") score += 2;

  // Kind boost — edits are the highest signal (Philip explicitly rewrote
  // what Groq produced); rejections are strong avoid signal
  if (f.feedback_kind === "edit") score += 5;
  else if (f.feedback_kind === "rejection") score += 3;
  else if (f.feedback_kind === "correction") score += 4;

  // Source-tier match boost
  if (f.context && typeof f.context === "object") {
    const fSource = (f.context as { source?: string }).source;
    if (fSource === source) score += 3;
  }

  return score;
}

// Linear age decay: 1.0 for feedback in the last AGE_FULL_WEIGHT_DAYS,
// dropping to 0.2 at RECENT_WINDOW_DAYS, floor at 0.15 beyond.
// Feedback older than AGE_HARD_FLOOR_DAYS is filtered out at fetch time.
function ageDecay(createdAtIso: string): number {
  const ageMs = Date.now() - new Date(createdAtIso).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  if (ageDays <= AGE_FULL_WEIGHT_DAYS) return 1.0;
  if (ageDays >= RECENT_WINDOW_DAYS) return 0.2;
  const rampDays = RECENT_WINDOW_DAYS - AGE_FULL_WEIGHT_DAYS;
  const rampProgress = (ageDays - AGE_FULL_WEIGHT_DAYS) / rampDays;
  return 1.0 - rampProgress * 0.8;
}

// Normalise lesson text to a short key so we can count repeats reliably
// even when Philip phrases the same lesson slightly differently.
function lessonKey(f: KnowledgeFeedback): string {
  const raw = (f.lesson ?? f.correction ?? f.nex_answer ?? "").toLowerCase();
  return raw
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 8)
    .sort()
    .join("|") || `_kind:${f.feedback_kind}`;
}

function countConfirmations(feedback: KnowledgeFeedback[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const f of feedback) {
    const key = lessonKey(f);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function extractTopicKeywords(text: string): Set<string> {
  const stop = new Set(["the", "a", "and", "or", "of", "in", "on", "to", "for", "is", "are", "was", "with", "as", "by", "at", "an", "this", "that", "it", "be"]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && w.length <= 24 && !stop.has(w))
      .slice(0, 200)
  );
}

// ── Synthesis ────────────────────────────────────────────────────────

function summariseLesson(examples: LearningExample[]): string {
  if (examples.length === 0) {
    return "No prior human feedback yet relevant to this topic. Author from scratch using the other context bundles.";
  }
  const kindsCount = examples.reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + 1;
    return acc;
  }, {});
  const parts: string[] = [];
  if (kindsCount.edit) parts.push(`${kindsCount.edit} past edit${kindsCount.edit === 1 ? "" : "s"} to emulate`);
  if (kindsCount.approval) parts.push(`${kindsCount.approval} approved pattern${kindsCount.approval === 1 ? "" : "s"} to reinforce`);
  if (kindsCount.rejection) parts.push(`${kindsCount.rejection} rejected pattern${kindsCount.rejection === 1 ? "" : "s"} to avoid`);
  if (kindsCount.correction) parts.push(`${kindsCount.correction} specific correction${kindsCount.correction === 1 ? "" : "s"}`);
  if (kindsCount.voice_drift) parts.push(`${kindsCount.voice_drift} voice-drift warning${kindsCount.voice_drift === 1 ? "" : "s"}`);
  if (kindsCount.gap) parts.push(`${kindsCount.gap} noted knowledge gap${kindsCount.gap === 1 ? "" : "s"}`);
  return parts.join(" · ") || "Prior human feedback available.";
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
