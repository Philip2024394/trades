// NEX Indonesia · Retrieval-Augmented Generation helper.
//
// The join between the conversation intent gate, the Indonesia
// knowledge corpus, and the streaming chat runtime. Given a user
// message, this module decides whether to attach grounded knowledge
// as system-prompt context — and produces a small preamble the LLM
// can reason over instead of guessing.
//
// Reusable across:
//   · POST /api/nex/converse/stream  (real LLM streaming)
//   · POST /api/nex/general-chat     (hand-authored + grounded)
//   · Any future NEX surface that wants to speak with Indonesia
//     knowledge without hallucinating.
//
// Design tenets:
//   · Only fires when intent is genuinely knowledge-relevant
//     (indonesia / tourism / food / places / booking-with-Indonesia
//     context). Chit-chat gets NO knowledge preamble — that would
//     confuse the model.
//   · Never invents facts. If the corpus has nothing, we return an
//     empty attachment and the LLM falls back to what it already
//     knows (which we then bound with the "don't invent"
//     instruction).
//   · Provenance goes into telemetry so HQ can audit exactly what
//     NEX cited.

import { classifyConversationIntent, type ConversationClassification } from "../conversation-intent";
import {
  retrieveKnowledge,
  formatKnowledgeBlock,
  type KnowledgeHit,
} from "./knowledge";
import { detectGap } from "./gaps/gap-detector";
import { GapRegistry, type GapRegistryOptions } from "./gaps/gap-registry";

export type RagAttachment = {
  /** True when we chose to attach grounded knowledge. */
  attached: boolean;
  /** Reason the RAG decision fired · e.g. "indonesia_intent",
   *  "no_relevant_hits", "skip_conversation_intent". */
  reason: string;
  /** Intent classification (same one the routing gate uses). */
  intent: ConversationClassification;
  /** Retrieved knowledge hits (may be empty). */
  hits: KnowledgeHit[];
  /** Formatted grounded-context block · empty string when no hits. */
  block: string;
  /** Guidance line to append to any system prompt so the LLM knows
   *  how to use grounded facts (or, if empty, how to behave when
   *  grounded knowledge is absent). */
  systemPromptSuffix: string;
};

/** Which intents trigger a knowledge lookup. Deliberate — chit-chat
 *  and specialist intents (staircase / trades / quotation) do NOT
 *  benefit from Indonesia RAG. */
const KNOWLEDGE_INTENTS = new Set([
  "indonesia",
  "tourism",
  "accommodation",  // Philip 2026-08-31 · own vertical · retrieval boosts accommodation:* records
  "food",
  "places",
]);

/** Additional intents that get RAG ONLY when the message also
 *  mentions an Indonesian place (i.e. the secondary intent is
 *  "indonesia"). "book me a hotel in Ubud" qualifies; "book me a
 *  hotel" does not. */
const SECONDARY_INDONESIA_INTENTS = new Set([
  "booking",
  "weather",
  "business",
]);

export type RagOptions = {
  /** Cap on number of hits. Default 3. */
  limit?: number;
  /** Minimum confidence · default 0.7 (skip weak facts). */
  minConfidence?: number;
  /** Force the RAG on/off regardless of intent (for tests). */
  force?: boolean;
  /** Optional GapRegistry override · used by tests to inject an
   *  in-memory registry. When omitted, the module-level singleton
   *  (file-backed) is used. */
  gapRegistry?: GapRegistry;
  /** Skip gap recording entirely · used by pure-scoring tests. */
  disableGapRecording?: boolean;
};

// ─── Gap-loop wire-up (Doctrine rule 3 · Philip 2026-08-30) ────────
//
// Real user questions with insufficient retrieval feed the acquisition
// machine. Loaded once per process · atomic tmp+rename persistence.
// Concurrent chat requests are safe · GapRegistry.observe internally
// serialises writes.

let SINGLETON_GAP_REGISTRY: GapRegistry | null = null;
function defaultGapRegistry(): GapRegistry {
  if (!SINGLETON_GAP_REGISTRY) SINGLETON_GAP_REGISTRY = new GapRegistry();
  return SINGLETON_GAP_REGISTRY;
}
/** Test-only · reset the singleton so a fresh (usually inMemoryOnly)
 *  registry can be injected. */
export function _resetGapRegistrySingletonForTests(next?: GapRegistry): void {
  SINGLETON_GAP_REGISTRY = next ?? null;
}

/** Decide whether + what knowledge to attach for a user message.
 *  Never throws · always returns a well-formed RagAttachment. */
export function decideRag(message: string, opts: RagOptions = {}): RagAttachment {
  const intent = classifyConversationIntent(message);
  const limit = opts.limit ?? 3;
  const minConfidence = opts.minConfidence ?? 0.7;

  // Conversation / greeting / specialist paths do not get RAG unless
  // forced. This is intentional — a greeting fed the Bali record
  // would produce weird "here's some Bali facts" replies.
  const isKnowledgeIntent = KNOWLEDGE_INTENTS.has(intent.intent);
  const isSecondaryIndonesia =
    SECONDARY_INDONESIA_INTENTS.has(intent.intent) && intent.secondary === "indonesia";
  const shouldRag = opts.force || isKnowledgeIntent || isSecondaryIndonesia;

  if (!shouldRag) {
    return {
      attached: false,
      reason: `skip_${intent.intent}_intent`,
      intent,
      hits: [],
      block: "",
      systemPromptSuffix: "",
    };
  }

  // Prefer-category boost · when intent maps to a specific NEX vertical
  // (accommodation is the first · food/transport/etc. can follow the
  // same pattern), tell retrieval to prefer records in that vertical's
  // namespace. Philip 2026-08-31 accommodation-intent build.
  const preferCategory = intent.intent === "accommodation" ? "accommodation" : undefined;
  const hits = retrieveKnowledge(message, { limit, minConfidence, preferCategory });

  // Gap-loop · Doctrine rule 3: real user questions that under-serve
  // feed the acquisition machine. Fires ONLY for knowledge-relevant
  // intents (never for chit-chat · handled above by the shouldRag
  // gate). Detector already refuses to create gaps for good-hit lists.
  //
  // `force: true` is a test-only escape hatch to bypass the intent
  // gate for scoring inspection · it must not have production side
  // effects, so gap recording is also suppressed when force is used
  // UNLESS the caller explicitly provided their own registry (i.e.
  // the test is intentionally exercising the gap wire-up).
  const forceBypassing = opts.force && !opts.gapRegistry;
  if (!opts.disableGapRecording && !forceBypassing) {
    const gap = detectGap({
      intent: intent.intent,
      rawQuery: message,
      hits,
      minConfidence,
      scope: intent.secondary === "indonesia" ? "indonesia" : undefined,
    });
    if (gap) {
      try {
        (opts.gapRegistry ?? defaultGapRegistry()).observe(gap);
      } catch { /* gap recording is best-effort · never break the chat */ }
    }
  }

  if (hits.length === 0) {
    return {
      attached: false,
      reason: "no_relevant_hits",
      intent,
      hits: [],
      block: "",
      systemPromptSuffix:
        "\n\nNEX INDONESIA GUIDANCE: The user asked about Indonesia but NEX's " +
        "grounded knowledge corpus has no relevant record. Say honestly that " +
        "you don't have this in your grounded knowledge yet, then offer to " +
        "search the directory or ask a follow-up question. Do NOT invent " +
        "specific facts (restaurant names, prices, opening hours, festival " +
        "dates) that you cannot cite.",
    };
  }

  const block = formatKnowledgeBlock(hits);
  const systemPromptSuffix =
    "\n\n" +
    block +
    "\n\nNEX INDONESIA GUIDANCE: Answer using the grounded knowledge above. " +
    "Cite the region/topic when useful. If the user asks for LIVE facts " +
    "(current prices, opening hours today, weather, exchange rate), say you " +
    "need a live lookup rather than inventing them. Never fabricate a " +
    "restaurant, hotel, phone number, or price that is not in the grounded " +
    "block.";

  return {
    attached: true,
    reason: `${intent.intent}_intent_${hits.length}_hits`,
    intent,
    hits,
    block,
    systemPromptSuffix,
  };
}

/** Convenience: extract just the topic identifiers from a decision
 *  · handy for DB telemetry (context_snapshot.knowledge_topics). */
export function ragTopics(att: RagAttachment): string[] {
  return att.hits.map((h) => h.topic);
}
