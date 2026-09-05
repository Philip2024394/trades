// src/lib/nex/brain/conversational-frame.ts
//
// P0 · Live Conversational Frame (Philip 2026-09-05 · P0 doctrine §4).
//
// A semantic snapshot of "what we are talking about right now". Derived
// each turn from existing session state (dialogueTurns, currentReference,
// goal, accommodation, entities) plus the latest BrainReply. Consumed by:
//
//   · Response Composition Layer — passed as context to the local LLM
//     so it can continue the topic without re-asking
//   · Conversation-aware retrieval — expands the current query with
//     running-topic keywords when the user turn is bare ("what about
//     yogyakarta?" carries the "industries" topic from turn N-1)
//
// The frame is NEVER authoritative for facts. It is a REFLECTION of
// session state. All facts still come from retrieval / world data /
// brain state. The frame's job is to preserve topical continuity,
// nothing more (per §3 · Epistemic Subordination).
//
// Pure functions · no I/O · no side effects.

import type { SessionState } from "./session";

/**
 * The semantic snapshot passed to composition + retrieval.
 * All fields optional · absence means "unknown at this turn".
 */
export type ConversationalFrame = {
  /** The user's current subject of interest. Rolls forward across turns
   *  unless a topic shift is detected. e.g. "Jakarta", "gudeg",
   *  "coffee producers". Best-effort · derived from most recent
   *  substantive user or NEX turn. */
  running_topic?: string;
  /** The narrower subject if the topic has facets. e.g. topic="Jakarta"
   *  subject="food scene". e.g. topic="tempeh" subject="health
   *  comparison to tofu". Reset when running_topic changes. */
  running_subject?: string;
  /** The market currently in effect. From the route caller's `market`
   *  parameter, cached here so composition prompt knows the country
   *  frame. */
  active_market?: "ID" | "UK" | "US" | "UNIVERSAL";
  /** Commercial context if any goal is active. */
  commercial_context?: {
    kind: "accommodation" | "food" | "commerce" | "conversation";
    status: "active" | "paused" | "resumed" | "completed" | "abandoned";
    summary?: string;
  };
  /** Recent references the composition layer must respect · e.g. "the
   *  second one" already resolved to a specific business, or "there"
   *  resolved to "Jakarta". */
  resolved_references?: Array<{
    phrase: string;
    resolved_to: string;
    kind: "ordinal" | "pronoun" | "topic" | "entity";
  }>;
  /** Questions NEX has open · from the last assistant turn ending in ?,
   *  OR from missing accommodation slots. Composition layer should
   *  honour these (not ignore them). */
  open_questions?: string[];
  /** Rolling short summary of the last 3 user turns · gives composition
   *  layer just enough continuity without full history bloat. */
  recent_user_turns?: string[];
  /** Rolling short summary of the last 3 NEX turns · same purpose. */
  recent_nex_turns?: string[];
  /** When the frame was derived · lets consumers detect staleness. */
  derived_at_iso: string;
};

/**
 * Derive a fresh frame from current session state. Idempotent · pure.
 * Called at the top of each turn AFTER the session has been loaded
 * (so we can read the prior turn's context) but BEFORE composition.
 */
export function deriveFrame(
  session: SessionState | null,
  market: "ID" | "UK" | "US" | "UNIVERSAL" = "UNIVERSAL",
): ConversationalFrame {
  const derived_at_iso = new Date().toISOString();
  if (!session) return { active_market: market, derived_at_iso };

  const dialogue = session.dialogueTurns ?? [];
  const userTurns = dialogue.filter((t) => t.role === "user").slice(-3).map((t) => t.text);
  const nexTurns = dialogue.filter((t) => t.role === "nex").slice(-3).map((t) => t.text);

  const running_topic = extractRunningTopic(dialogue);
  const running_subject = extractRunningSubject(dialogue, running_topic);
  const resolved_references = extractResolvedReferences(session);
  const open_questions = extractOpenQuestions(session);
  type CommercialContext = NonNullable<ConversationalFrame["commercial_context"]>;
  const commercial_context: CommercialContext | undefined = session.goal
    ? { kind: session.goal.kind as CommercialContext["kind"],
        status: session.goal.status as CommercialContext["status"],
        summary: session.goal.summary }
    : undefined;

  return {
    running_topic,
    running_subject,
    active_market: market,
    commercial_context,
    resolved_references,
    open_questions,
    recent_user_turns: userTurns.length ? userTurns : undefined,
    recent_nex_turns: nexTurns.length ? nexTurns : undefined,
    derived_at_iso,
  };
}

/**
 * Best-effort running-topic extraction. Rules of thumb:
 *   · The most recent user turn that named a proper noun or a
 *     substantive subject wins.
 *   · If none, fall back to the most recent substantive NEX topic.
 *   · Short function words / bare-word turns ("yes", "yeah", "and
 *     yogyakarta?") DO NOT reset the topic · they inherit prior.
 */
function extractRunningTopic(dialogue: Array<{ role: "user" | "nex"; text: string }>): string | undefined {
  const substantive: string[] = [];
  for (let i = dialogue.length - 1; i >= 0; i--) {
    const t = dialogue[i];
    const text = t.text.trim();
    if (!text) continue;
    // Skip bare-word turns that only shift context, not topic
    if (BARE_WORD_TURN.test(text)) continue;
    substantive.push(text);
    if (substantive.length >= 2) break;
  }
  if (substantive.length === 0) return undefined;
  const topic = pickTopicFromText(substantive[0]);
  return topic;
}

const BARE_WORD_TURN = /^(yes|yeah|yep|no|nope|iya|jangan|ok|okay|sure|and|dan)[\s\?\.!]*$/i;

/**
 * Rough proper-noun / subject extraction. Not perfect · doesn't need
 * to be. If a text has a Capitalised noun phrase, that wins. Else
 * strip greeting/filler and take the first content clause.
 */
function pickTopicFromText(text: string): string | undefined {
  // Strip common greetings/fillers from head
  const stripped = text.replace(
    /^(hi|hello|hey|morning|good morning|good afternoon|good evening|selamat pagi|selamat siang|halo|hai)[,\!\.\s]*/i,
    "",
  ).trim();
  // Capitalised noun run
  const capMatch = stripped.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  if (capMatch) return capMatch[1];
  // First 6 words as topic
  const words = stripped.split(/\s+/).slice(0, 6).join(" ");
  return words || undefined;
}

/**
 * Detect a "subject" that further narrows the topic. Very light: if
 * the most recent user turn is a follow-up ("what about the food scene
 * there?", "how did it originate?"), capture the interrogative subject
 * ("food scene", "origin"). Otherwise undefined.
 */
function extractRunningSubject(
  dialogue: Array<{ role: "user" | "nex"; text: string }>,
  topic?: string,
): string | undefined {
  if (!dialogue.length || !topic) return undefined;
  const lastUser = [...dialogue].reverse().find((t) => t.role === "user");
  if (!lastUser) return undefined;
  const text = lastUser.text.toLowerCase();
  // Common follow-up interrogatives → subject label
  const patterns: Array<[RegExp, string]> = [
    [/food scene|restaurants?|dishes?|cuisine|eat/i, "food scene"],
    [/history|originate|origin|where.+from/i, "origin & history"],
    [/health(y|ier)?|nutrition|calories/i, "health"],
    [/price|cost|how much|expensive|cheap/i, "price"],
    [/compare|difference|different|versus|vs/i, "comparison"],
    [/how.+ship|shipping|freight|export|import/i, "logistics"],
    [/who.+(runs|leads|governor|president|mayor)/i, "leadership"],
    [/best|top|which region|which.+known/i, "ranking"],
  ];
  for (const [rx, label] of patterns) {
    if (rx.test(text)) return label;
  }
  return undefined;
}

function extractResolvedReferences(session: SessionState): ConversationalFrame["resolved_references"] {
  const refs: NonNullable<ConversationalFrame["resolved_references"]> = [];
  const cr = session.currentReference;
  if (cr && cr.resolved && cr.business?.canonical) {
    refs.push({
      phrase: cr.refKind === "ordinal" ? `#${cr.offset ?? "?"}` : "it/that",
      resolved_to: cr.business.canonical,
      kind: cr.refKind === "ordinal" ? "ordinal" : "pronoun",
    });
  }
  return refs.length ? refs : undefined;
}

function extractOpenQuestions(session: SessionState): string[] | undefined {
  const qs: string[] = [];
  if (session.lastNexQuestion) qs.push(session.lastNexQuestion);
  return qs.length ? qs : undefined;
}

/**
 * Render frame as a compact multi-line block for the composition
 * system prompt. Keeps prompt length small and predictable.
 */
export function frameToPromptBlock(frame: ConversationalFrame): string {
  const lines: string[] = ["[CONVERSATION FRAME]"];
  if (frame.running_topic) lines.push(`current_topic: ${frame.running_topic}`);
  if (frame.running_subject) lines.push(`current_subject: ${frame.running_subject}`);
  if (frame.active_market) lines.push(`market: ${frame.active_market}`);
  if (frame.commercial_context) {
    lines.push(`goal: ${frame.commercial_context.kind} (${frame.commercial_context.status})${frame.commercial_context.summary ? ` — ${frame.commercial_context.summary}` : ""}`);
  }
  if (frame.resolved_references?.length) {
    lines.push(`resolved_references: ${frame.resolved_references.map((r) => `${r.phrase}→${r.resolved_to}`).join("; ")}`);
  }
  if (frame.open_questions?.length) {
    lines.push(`nex_asked_last: "${frame.open_questions[0]}"`);
  }
  if (frame.recent_user_turns?.length) {
    lines.push(`recent_user: ${frame.recent_user_turns.map((t) => `"${truncate(t, 80)}"`).join(" | ")}`);
  }
  if (frame.recent_nex_turns?.length) {
    lines.push(`recent_nex: ${frame.recent_nex_turns.map((t) => `"${truncate(t, 80)}"`).join(" | ")}`);
  }
  return lines.join("\n");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
