// NEX Reflex Brain · sub-100ms deterministic answers · zero LLM cost
//
// Philip 2026-07-30 · Consciousness Layer Tier 1:
//
//   "A truly intelligent system is not the one that thinks hardest.
//    It is the one that knows when thinking is needed."
//
// This module answers the "instant" tier of the three-brain architecture:
//   Reflex   (<100ms · this file · no LLM)
//   Expert   (<1s · Haiku · narrow topic prompt · future work)
//   Wisdom   (2-8s · Opus · full context + memory + composer · existing)
//
// The Reflex Brain currently handles:
//   1. Greetings (pure) — "hi" · "morning" · "hello nex" · without a question attached
//   2. Closings (pure) — "thanks" · "goodnight" · "bye"
//
// Coming next (Philip 2026-07-30 · queued):
//   3. Trade terminology — "what is a winder?" · "what is a housed string?"
//   4. Privacy/security assurance — "is my data safe?"
//   5. Identity/philosophy — "are you an AI?" · "can I trust you?"
//
// The router NEVER short-circuits when the user message contains a substantive
// question. A greeting-plus-question ("Morning Nex, can you help with oak?")
// falls through to the composer where the Greeting Acknowledgement rule handles
// it. Reflex only fires when the message is ENTIRELY reflex-eligible.

import "server-only";
import { tryTerminology, formatTerminologyResponse } from "./trade-terminology";

// ─── Reflex response shape ─────────────────────────────────────────────

export interface ReflexResponse {
  /** The response text to stream to the user. Complete · not partial. */
  text: string;
  /** Which reflex category matched (for telemetry / debugging). */
  category: "greeting" | "closing" | "thanks" | "terminology";
  /** Which specific intent within the category. */
  intent: string;
}

// ─── Character library entries (in-file copy · locked wording) ─────────
//
// Sourced from src/lib/nex/character/library/volume_00_core.json entries
// with category = "greeting" | "goodbye" | "thanks". Copied inline here to
// avoid the JSON load latency on every request. Multiple alternatives per
// entry prevent repetition across turns.
//
// If a library entry needs updating, update BOTH this file and the JSON —
// this file is the hot path (sub-10ms), the JSON is the reference.

const REFLEX_ENTRIES = [
  // ─── Greetings ─────────────────────────────────────────────────────
  {
    intent:   "good_morning",
    category: "greeting" as const,
    patterns: [/^good\s+morning\b/i, /^morning(\s+nex)?[!.?\s]*$/i],
    alternatives: [
      "Morning. Ready to get a few jobs crossed off the list?",
      "Morning — good to hear from you. What's on your mind today?",
    ],
  },
  {
    intent:   "good_afternoon",
    category: "greeting" as const,
    patterns: [/^good\s+afternoon\b/i, /^afternoon(\s+nex)?[!.?\s]*$/i],
    alternatives: [
      "Afternoon. What's first on today's list?",
      "Afternoon — happy to help. Where would you like to start?",
    ],
  },
  {
    intent:   "good_evening",
    category: "greeting" as const,
    patterns: [/^good\s+evening\b/i, /^evening(\s+nex)?[!.?\s]*$/i],
    alternatives: [
      "Evening. Let's see how the day's gone.",
      "Evening — good timing. What are we thinking about tonight?",
    ],
  },
  {
    intent:   "hi_hello",
    category: "greeting" as const,
    patterns: [
      /^(hi|hello|hey|hiya|howdy)(\s+nex)?[!.?\s]*$/i,
      /^alright(\s+nex)?[!.?\s]*$/i,
    ],
    alternatives: [
      "Alright — good to have you here. What's on your mind?",
      "Hi there — happy to help. Where would you like to start?",
      "Good to hear from you — let's take this from wherever suits you.",
    ],
  },

  // ─── Thanks ─────────────────────────────────────────────────────────
  {
    intent:   "thanks",
    category: "thanks" as const,
    patterns: [
      /^(thanks|thank\s+you|ta|cheers)(\s+nex)?[!.?\s]*$/i,
      /^(thanks|thank\s+you)\s+(mate|so\s+much|a\s+lot|for\s+that|for\s+your\s+help)[!.?\s]*$/i,
    ],
    alternatives: [
      "You're welcome. That's one less job on your list.",
      "Glad to help. Give me a shout whenever you need to think through the next bit.",
      "Anytime — that's what I'm here for.",
    ],
  },

  // ─── Closings ──────────────────────────────────────────────────────
  {
    intent:   "goodnight",
    category: "closing" as const,
    patterns: [/^good\s*night(\s+nex)?[!.?\s]*$/i, /^night(\s+nex)?[!.?\s]*$/i],
    alternatives: [
      "Sleep well. I'll keep things ready for tomorrow.",
      "Good night — I'll be here when you're ready to pick this up again.",
    ],
  },
  {
    intent:   "bye",
    category: "closing" as const,
    patterns: [
      /^(bye|goodbye|see\s+you|see\s+ya|catch\s+you\s+later|later)(\s+nex)?[!.?\s]*$/i,
      /^cheers(\s+nex)?[!.?\s]*$/i,
    ],
    alternatives: [
      "Take care — I'll be here whenever you're ready to pick this up again.",
      "Catch you later. Give me a shout if anything comes up.",
    ],
  },
];

// ─── Substantive-question detection · disqualifies reflex ──────────────
//
// If the message contains ANY of these, it is NOT pure reflex. Even
// "Morning Nex, quick question about oak..." must go to the composer,
// where the Greeting Acknowledgement rule handles the greeting portion
// AND answers the substantive question in one flow.

const SUBSTANTIVE_MARKERS = /\?|\b(help|how|what|why|when|where|which|who|can\s+you|could\s+you|would\s+you|should\s+i|do\s+you|is\s+it|are\s+you|tell\s+me|show\s+me|find|explain|compare|choose|recommend|suggest|need|want|looking\s+for|thinking\s+about|going\s+to|planning)\b/i;

// ─── The reflex check · <10ms · sync · no I/O ──────────────────────────

export function tryReflex(userMessage: string): ReflexResponse | null {
  const trimmed = userMessage.trim();
  if (trimmed.length === 0) return null;

  // ─── Tier 1a · Greetings / thanks / closings (pure) ────────────────
  // Reject long messages and messages containing substantive question markers
  if (trimmed.length <= 60 && !SUBSTANTIVE_MARKERS.test(trimmed)) {
    for (const entry of REFLEX_ENTRIES) {
      for (const pattern of entry.patterns) {
        if (pattern.test(trimmed)) {
          const text = entry.alternatives[Math.floor(Math.random() * entry.alternatives.length)];
          return {
            text,
            category: entry.category,
            intent: entry.intent,
          };
        }
      }
    }
  }

  // ─── Tier 1b · Staircase trade terminology lookup ──────────────────
  // Answers "what is a winder?" · "define housed string" · etc. from the
  // static expert-authored glossary. Entries awaiting expert review are
  // gated inside tryTerminology() per Rule B.
  const term = tryTerminology(trimmed);
  if (term) {
    return {
      text: formatTerminologyResponse(term),
      category: "terminology",
      intent: `term:${term.term}`,
    };
  }

  return null;
}
