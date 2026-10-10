// src/lib/nex-agent/code-engine/capability-conversation-working-memory.ts
//
// NEX · Phase 5 · Conversation Working Memory · 2026-09-21.
// Founder-authorised as one bounded programme.
//
// PURPOSE
//
//   The bridge between one turn and the next.
//
//   Phase 4 taught NEX how to reach the world (KNOW-or-LOOK, source
//   selection, freshness policy, guarded fetch, evidence status,
//   selective retention, source-outcome ledger). What was missing was
//   the LIVE state that carries meaning across turns. Without it, every
//   user message starts from zero: "the day after" has no anchor, "it"
//   has no referent, "actually I meant Bali" has nowhere to land.
//
//   This module supplies four deterministic functions:
//
//     parseSubjectAndTimeframe(message)
//       Splits "Jakarta tomorrow" into
//       { subject: "Jakarta", timeframe: { anchor: "tomorrow", offset_days: 0 } }.
//       Prevents the current greedy extractor from feeding the whole
//       tail into a downstream lookup.
//
//     writeRetrievalToHead(head, args)
//       Called from a retrieval handler's success path. Records the
//       semantic subject, topic, timeframe, and a bounded
//       payload_summary onto the ConversationHead. Never writes a raw
//       page payload. Never promotes to long-term memory.
//
//     resolveDeictic(head, message)
//       Given a follow-up message, returns what its deictic references
//       ("the day after", "would you go", "somewhere nearby", "it")
//       bind to based on live head state. Returns null for references
//       that cannot be resolved from state — never fabricates.
//
//     shiftSubject(head, correction)
//       Given a correction of the form "actually, I meant X" while an
//       active_subject / active_topic exists, updates active_subject
//       in place and preserves active_topic + active_timeframe.
//
// ANTI-CHEATING
//
//   · Every function is deterministic and pure with respect to inputs
//     (head is mutated in place by writers, but the mutations are
//     specific and documented).
//   · No LLM. No network. No embeddings.
//   · resolveDeictic returns null when a capability is missing (e.g.
//     "somewhere nearby" without a place-adjacency table). Callers
//     must degrade honestly.
//   · Working memory is per-conversation · never leaks across
//     conversation_id.
//   · This is WORKING memory, not RETAINED memory. Nothing here
//     promotes anything to the retained-knowledge store.

import type { ActiveSubject, ActiveTimeframe, ConversationHead, LastRetrieval } from "./capability-conversation-context";

// ── Types ─────────────────────────────────────────────────────────────

export interface ParsedSubjectAndTimeframe {
  readonly subject: string | null;
  readonly timeframe: ActiveTimeframe | null;
  readonly raw: string;
}

export interface WriteRetrievalArgs {
  readonly turn_id: number;
  readonly kind: string;                // "weather_lookup", "multi_source_lookup", ...
  readonly subject: string;
  readonly subject_kind: ActiveSubject["kind"];
  readonly topic: string;
  readonly timeframe: ActiveTimeframe | null;
  readonly payload_summary: string;     // bounded, human-readable
  // Phase 6 · optional subject list for multi-subject retrievals.
  readonly subjects_list?: readonly string[];
}

export type DeicticKind =
  | "TIMEFRAME_SHIFT"        // "the day after" · shifts the active_timeframe
  | "SAME_TOPIC_NEW_SUBJECT" // "what about Bali" · replaces subject, keeps topic + timeframe
  | "ACTION_REFERENT"        // "would you go" · resolves via last_retrieval
  | "PRONOUN_TO_SUBJECT"     // "it" / "that" · binds to active_subject
  | "UNRESOLVABLE";          // no capability + no state to bind

export interface DeicticResolution {
  readonly kind: DeicticKind;
  readonly resolved_subject: string | null;
  readonly resolved_timeframe: ActiveTimeframe | null;
  readonly resolved_topic: string | null;
  readonly referent_summary: string | null;
  readonly reason: string;
}

// ── parseSubjectAndTimeframe ──────────────────────────────────────────
//
// Strips a small set of timeframe suffixes from the user message and
// returns the residual as the subject. Deterministic. The recognised
// timeframe phrases are declared in ONE constant table.

const TIMEFRAME_PATTERNS: readonly {
  readonly re: RegExp;
  readonly anchor: ActiveTimeframe["anchor"];
  readonly offset_days: number;
}[] = [
  // "the day after tomorrow" MUST match before "tomorrow" alone
  { re: /\bthe day after tomorrow\b/i, anchor: "tomorrow", offset_days: 1 },
  { re: /\bday after tomorrow\b/i, anchor: "tomorrow", offset_days: 1 },
  { re: /\bthe day after\b/i, anchor: "tomorrow", offset_days: 1 },
  { re: /\bday after\b/i, anchor: "tomorrow", offset_days: 1 },
  { re: /\btomorrow\b/i, anchor: "tomorrow", offset_days: 0 },
  { re: /\btoday\b/i, anchor: "today", offset_days: 0 },
  { re: /\bright now\b/i, anchor: "today", offset_days: 0 },
  { re: /\bnow\b/i, anchor: "today", offset_days: 0 },
  { re: /\byesterday\b/i, anchor: "today", offset_days: -1 },
];

export function parseSubjectAndTimeframe(input: {
  readonly message: string;
  readonly introduced_turn: number;
}): ParsedSubjectAndTimeframe {
  let residual = input.message.trim();
  let timeframe: ActiveTimeframe | null = null;
  for (const pat of TIMEFRAME_PATTERNS) {
    const m = pat.re.exec(residual);
    if (m) {
      timeframe = {
        anchor: pat.anchor,
        offset_days: pat.offset_days,
        introduced_turn: input.introduced_turn,
      };
      residual = residual.replace(pat.re, " ").replace(/\s+/g, " ").trim();
      break; // first (most-specific) match wins
    }
  }
  // Strip trailing punctuation and question phrasing that isn't part
  // of the subject.
  residual = residual.replace(/[?.,;!]+$/g, "").trim();
  // Phase 6 · strip trailing politeness/filler words ("please", "thanks",
  // "thx", "cheers") that leak in when the classifier's greedy regex
  // captures them as part of the subject. Also strip leading fillers.
  residual = residual
    .replace(/\s*\b(?:please|thanks|thank\s+you|thx|cheers|pls|kindly)\s*[?.!,]*$/i, "")
    .replace(/^(?:please|kindly)\s+/i, "")
    .replace(/[?.,;!]+$/g, "")
    .trim();
  return {
    subject: residual.length > 0 ? residual : null,
    timeframe,
    raw: input.message,
  };
}

// ── writeRetrievalToHead ──────────────────────────────────────────────
//
// Mutates the ConversationHead in place with the semantic slots that
// let the next turn continue the thread. NEVER stores the full
// retrieved payload — only a bounded summary.

const MAX_PAYLOAD_SUMMARY_LEN = 400;

export function writeRetrievalToHead(head: ConversationHead, args: WriteRetrievalArgs): void {
  const summary = args.payload_summary.slice(0, MAX_PAYLOAD_SUMMARY_LEN);
  const now = new Date().toISOString();
  (head as any).active_subject = {
    kind: args.subject_kind,
    value: args.subject,
    introduced_turn: args.turn_id,
  } satisfies ActiveSubject;
  (head as any).active_topic = args.topic;
  (head as any).active_timeframe = args.timeframe;
  (head as any).last_retrieval = {
    kind: args.kind,
    subject: args.subject,
    payload_summary: summary,
    at: now,
    subjects_list: args.subjects_list,
  } satisfies LastRetrieval;
  (head as any).last_updated = now;
}

// ── shiftSubject ──────────────────────────────────────────────────────
//
// When a correction fires and an active_topic exists, replace the
// active_subject without touching topic or timeframe. The caller (the
// semantic correction router in D5) is responsible for re-running the
// topic's handler with the new subject; this function only mutates
// head.

export function shiftSubject(
  head: ConversationHead,
  correction: { readonly to_value: string; readonly turn_id: number; readonly subject_kind?: ActiveSubject["kind"] },
): void {
  (head as any).active_subject = {
    kind: correction.subject_kind ?? (head.active_subject?.kind ?? "place"),
    value: correction.to_value,
    introduced_turn: correction.turn_id,
  } satisfies ActiveSubject;
  (head as any).last_updated = new Date().toISOString();
}

// ── resolveDeictic ────────────────────────────────────────────────────
//
// Given a new user message, decide what its deictic references bind to
// using live head state. Ordered rules, first match wins:
//
//   R1 · "somewhere nearby" / "nearby" / "close by" without a place-
//        adjacency capability → UNRESOLVABLE. Honest gap.
//   R2 · "the day after" / "day after" / "day after tomorrow" with an
//        active_timeframe → TIMEFRAME_SHIFT by +1 day.
//   R3 · "what about X" (X ≠ empty) with active_topic → same topic,
//        new subject.
//   R4 · "what about the <timeframe>" with active_subject + active_topic
//        → same subject, shifted timeframe.
//   R5 · action-question ("would you go", "should I go", "is it good")
//        with an active last_retrieval → ACTION_REFERENT.
//   R6 · pronoun-only ("it", "that", "there") with active_subject →
//        PRONOUN_TO_SUBJECT.
//   R7 · fallthrough → UNRESOLVABLE.

const NEARBY_RE = /\b(?:somewhere\s+)?(?:nearby|close\s+by|around\s+here|in\s+the\s+area)\b/i;
const DAY_AFTER_RE = /\b(?:the\s+)?day\s+after(?:\s+tomorrow)?\b/i;
const WHAT_ABOUT_NOUN_RE = /^\s*(?:so\s+)?what\s+about\s+([a-z][\w\s]{1,50}?)\??\s*$/i;
const WHAT_ABOUT_TIMEFRAME_RE = /^\s*(?:so\s+)?what\s+about\s+(?:the\s+)?(day\s+after(?:\s+tomorrow)?|tomorrow|today|now|yesterday)\??\s*$/i;
const ACTION_QUESTION_RE = /\b(?:would\s+you\s+go|should\s+i\s+go|is\s+it\s+(?:good|worth\s+it|nice)|do\s+you\s+recommend|would\s+you\s+recommend)\b/i;
const PRONOUN_ONLY_RE = /^\s*(?:tell\s+me\s+about\s+)?(?:it|that|there|this)\s*[?.!]?\s*$/i;

export function resolveDeictic(head: ConversationHead, message: string): DeicticResolution {
  const msg = message.trim();

  // R1: "nearby" / "somewhere nearby" · deliberately unresolvable.
  // Place-adjacency is future-work (documented gap). Honest degrade.
  if (NEARBY_RE.test(msg)) {
    return {
      kind: "UNRESOLVABLE",
      resolved_subject: null,
      resolved_timeframe: null,
      resolved_topic: head.active_topic ?? null,
      referent_summary: null,
      reason: "place-adjacency capability not yet implemented · '${'nearby'}' has no resolver",
    };
  }

  // R4: "what about the day after" (timeframe shift) · check BEFORE R3
  // because R3's noun capture would greedily match "day after".
  const wtMatch = WHAT_ABOUT_TIMEFRAME_RE.exec(msg);
  if (wtMatch && head.active_topic && head.active_subject) {
    const tf = parseSubjectAndTimeframe({ message: wtMatch[1], introduced_turn: head.turn_id + 1 }).timeframe;
    if (tf) {
      return {
        kind: "TIMEFRAME_SHIFT",
        resolved_subject: head.active_subject.value,
        resolved_timeframe: tf,
        resolved_topic: head.active_topic,
        referent_summary: `same subject '${head.active_subject.value}' · shifted timeframe to ${tf.anchor}+${tf.offset_days}d`,
        reason: `"what about ${wtMatch[1]}" · same subject/topic · shifted timeframe`,
      };
    }
  }

  // R2: "the day after" as a standalone timeframe shift.
  if (DAY_AFTER_RE.test(msg) && head.active_timeframe && head.active_subject) {
    const currentAnchorDays = head.active_timeframe.anchor === "tomorrow" ? 1 : 0;
    const newOffsetFromToday = currentAnchorDays + head.active_timeframe.offset_days + 1;
    return {
      kind: "TIMEFRAME_SHIFT",
      resolved_subject: head.active_subject.value,
      resolved_timeframe: {
        anchor: newOffsetFromToday >= 1 ? "tomorrow" : "today",
        offset_days: newOffsetFromToday - (newOffsetFromToday >= 1 ? 1 : 0),
        introduced_turn: head.turn_id + 1,
      },
      resolved_topic: head.active_topic,
      referent_summary: `same subject '${head.active_subject.value}' · shifted timeframe by +1 day`,
      reason: `"day after" · same subject/topic · shifted timeframe`,
    };
  }

  // R3: "what about <noun>" · same topic, new subject.
  const wnMatch = WHAT_ABOUT_NOUN_RE.exec(msg);
  if (wnMatch && head.active_topic) {
    const parsed = parseSubjectAndTimeframe({ message: wnMatch[1], introduced_turn: head.turn_id + 1 });
    if (parsed.subject && parsed.subject.length >= 2) {
      return {
        kind: "SAME_TOPIC_NEW_SUBJECT",
        resolved_subject: parsed.subject,
        resolved_timeframe: parsed.timeframe ?? head.active_timeframe,
        resolved_topic: head.active_topic,
        referent_summary: `new subject '${parsed.subject}' · topic '${head.active_topic}' preserved`,
        reason: `"what about ${parsed.subject}" · same topic · new subject`,
      };
    }
  }

  // R5: action question referring to the last retrieval.
  if (ACTION_QUESTION_RE.test(msg) && head.last_retrieval && head.active_subject) {
    return {
      kind: "ACTION_REFERENT",
      resolved_subject: head.active_subject.value,
      resolved_timeframe: head.active_timeframe,
      resolved_topic: head.active_topic,
      referent_summary: `action refers to last_retrieval='${head.last_retrieval.kind}' subject='${head.last_retrieval.subject}'`,
      reason: `deictic action-question · bound to last_retrieval`,
    };
  }

  // R6: pronoun-only referent.
  if (PRONOUN_ONLY_RE.test(msg) && head.active_subject) {
    return {
      kind: "PRONOUN_TO_SUBJECT",
      resolved_subject: head.active_subject.value,
      resolved_timeframe: head.active_timeframe,
      resolved_topic: head.active_topic,
      referent_summary: `pronoun bound to active_subject '${head.active_subject.value}'`,
      reason: `pronoun-only referent`,
    };
  }

  // R7: fallthrough.
  return {
    kind: "UNRESOLVABLE",
    resolved_subject: null,
    resolved_timeframe: null,
    resolved_topic: head.active_topic ?? null,
    referent_summary: null,
    reason: `no deictic rule matched`,
  };
}

// ── Trace emitters ────────────────────────────────────────────────────

export function emitWorkingMemoryWriteTrace(args: WriteRetrievalArgs): string {
  return `working_memory · write · kind=${args.kind} · subject='${args.subject}' · topic=${args.topic} · timeframe=${args.timeframe ? `${args.timeframe.anchor}+${args.timeframe.offset_days}d` : "null"}`;
}

export function emitDeicticResolutionTrace(res: DeicticResolution): string {
  return `working_memory · resolve · kind=${res.kind} · subject=${res.resolved_subject ?? "null"} · topic=${res.resolved_topic ?? "null"} · timeframe=${res.resolved_timeframe ? `${res.resolved_timeframe.anchor}+${res.resolved_timeframe.offset_days}d` : "null"}`;
}

export function emitShiftSubjectTrace(to_value: string): string {
  return `working_memory · shift_subject · to='${to_value}'`;
}
