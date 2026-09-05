// src/lib/nex/brain/conversation-router.ts
//
// Stage 3.42 · NEX Conversation Layer · router (Philip 2026-09-01).
//
// The missing decision layer above the constitutional detectors:
//   · consumes the read-only PragmaticFeatures (role/register/particles)
//   · consumes rolling dialogueTurns + lastNexQuestion from SessionState
//   · returns a ConversationRoute · deterministic · no LLM · no
//     new keyword pattern lists
//
// Purpose (per audit K):
//   The existing voice-intent-selector's fallback line 254 sends any
//   non-greeting non-vertical-signal message to `clarify_ambiguous`
//   ("Hmm — bit vague..."). That routes social replies + bare context
//   continuations into a failed-search-query response.
//
//   This router runs BEFORE that fallback and returns a route when
//   the situation is a social reply · a context continuation · or an
//   answer to NEX's prior question. If none of those apply, returns
//   null and the existing selector's fallback runs unchanged.
//
// Constitutional discipline:
//   · Never modifies existing detectors (abandonment / refinement /
//     entity-followup / reference / conversation-intent classifier)
//   · Never adds new keyword pattern lists (Philip's rule)
//   · Consults ONLY pragmatic features + session state that already exist
//   · Returns null on any ambiguity (fail-closed to existing behaviour)
//
// See also:
//   · pragmatic-features.ts    · role/register/particles/address (Philip 2026-09-01)
//   · session.ts               · dialogueTurns + lastNexQuestion
//   · voice-intent-selector.ts · consumes route via new branch pre-fallback

import type { PragmaticFeatures } from "./pragmatic-features";
import type { SessionState } from "./session";

// ─── Route kinds ────────────────────────────────────────────────────

export type ConversationRoute =
  | {
      kind: "social_reply";
      /** Optional detail from pragmatic layer for voice rendering. */
      register?: PragmaticFeatures["register"];
      addressName?: string;
    }
  | {
      kind: "context_signal";
      /** The raw context signal the user gave (place name, topic, etc.). */
      signal: string;
      /** What NEX asked in the prior turn, if known · used for voice
       *  wording ("Which city are you in?" → "Yogyakarta"). */
      priorQuestion?: string;
    }
  | {
      kind: "acknowledged_answer";
      /** User's response to NEX's last question · verbatim (trimmed). */
      answer: string;
      priorQuestion: string;
    };

export type ConversationRouterInput = {
  message: string;
  pragmatic: PragmaticFeatures;
  session: SessionState | null;
  /** Whether the current turn's BrainReply already has strong signals
   *  (world_cards / world_reasoning / action_audit / pending_proposal).
   *  When true, router returns null and hot signals win. */
  brainHasHotSignals: boolean;
};

// ─── Loose place-name recognition (deterministic + edit-distance) ───
//
// This is the ONLY vocabulary the router uses · Indonesian city/region
// core names · matches the existing INDONESIA_CORE places (kept in
// sync) but adds a small edit-distance tolerance so "indonisea" resolves
// to "indonesia" and "jogyakarta" resolves to "yogyakarta". Never
// broadens beyond this narrow list · unknown bare words return null.

const KNOWN_PLACES = [
  "indonesia",
  "bali", "jakarta", "yogyakarta", "jogja", "bandung", "surabaya",
  "medan", "makassar", "semarang", "solo", "malang",
  "lombok", "flores", "labuan bajo", "sumatra", "sulawesi", "java", "jawa",
  "kalimantan", "papua", "ubud", "canggu", "seminyak", "sanur", "kuta",
];

/**
 * Fuzzy place-name match · returns the canonical name if the input is
 * within edit-distance 2 of a known place. Case-insensitive.
 * Returns null if no match.
 */
export function fuzzyPlaceMatch(word: string): string | null {
  const w = word.trim().toLowerCase();
  if (!w) return null;
  // Exact match short-circuit
  for (const p of KNOWN_PLACES) {
    if (p === w) return p;
  }
  // Only try edit-distance for words longer than 4 chars to avoid
  // false positives ("bali" vs "kali" etc.)
  if (w.length < 5) return null;
  const maxDist = w.length >= 8 ? 2 : 1;
  let best: { place: string; dist: number } | null = null;
  for (const p of KNOWN_PLACES) {
    // Skip if length differs too much · edit-distance can't rescue it
    if (Math.abs(p.length - w.length) > maxDist) continue;
    const d = editDistance(w, p);
    if (d <= maxDist && (best === null || d < best.dist)) {
      best = { place: p, dist: d };
    }
  }
  return best?.place ?? null;
}

/** Damerau-Levenshtein · handles transposition (indonisea ↔ indonesia). */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j]     + 1,       // deletion
        d[i][j - 1]     + 1,       // insertion
        d[i - 1][j - 1] + cost,    // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return d[m][n];
}

// ─── Router ─────────────────────────────────────────────────────────

/**
 * Route the current turn if it's a conversation-layer case.
 * Returns null when the existing pipeline should handle the turn.
 * Deterministic · fail-closed · never modifies existing detectors.
 */
export function routeConversation(input: ConversationRouterInput): ConversationRoute | null {
  // 1. Hot brain signals ALWAYS win · router steps aside for
  //    discovery / reasoning / action / proposal.
  if (input.brainHasHotSignals) return null;

  const msg = input.message.trim();
  if (!msg) return null;

  const { pragmatic, session } = input;
  const lastQ = session?.lastNexQuestion?.trim() ?? undefined;

  // 2. ANSWERED-QUESTION path · if NEX asked a question in the prior
  //    turn AND the user is now answering (any short reply that isn't
  //    itself a question) treat it as a context continuation.
  if (lastQ && pragmatic.role !== "question" && pragmatic.role !== "command") {
    // Answer that resolves to a place → context_signal (voice will
    // echo it back: "Yogyakarta — nice. What are you looking for?").
    const place = extractBarePlace(msg);
    if (place) {
      return {
        kind: "context_signal",
        signal: place,
        priorQuestion: lastQ,
      };
    }
    // Non-place short answer → acknowledged_answer (voice bridge
    // routes to social_reply · "Good to hear. What are you in the
    // mood to do today?"). Cap at 6 tokens so free-form paragraphs
    // fall through to the existing pipeline.
    if (msg.split(/\s+/).length <= 6) {
      return {
        kind: "acknowledged_answer",
        answer: msg,
        priorQuestion: lastQ,
      };
    }
  }

  // 3. Bare place-name signals FIRST · a single word that fuzzy-matches
  //    a known Indonesian place is ALWAYS a context signal, even in
  //    absence of a prior question. Runs BEFORE the social path so
  //    "Yogyakarta" doesn't get swallowed by short-statement heuristic.
  if (isBareWord(msg)) {
    const place = fuzzyPlaceMatch(msg);
    if (place) {
      return {
        kind: "context_signal",
        signal: place,
        priorQuestion: lastQ,
      };
    }
  }

  // 4. SOCIAL path · acknowledgement replies without an active
  //    vertical goal become social continuations · not vague fallback.
  //    Deliberately narrow: requires pragmatic.role to be explicitly
  //    "acknowledgement" (matched by ACKNOWLEDGEMENT_SHORT regex in
  //    pragmatic-features.ts). Prevents nonsense-word false positives
  //    for a bare "xyzabc123" without any conversation context.
  if (pragmatic.role === "acknowledgement") {
    return {
      kind: "social_reply",
      register: pragmatic.register,
      addressName: pragmatic.address?.name,
    };
  }

  // 5. Nothing routes · existing fallback runs unchanged.
  //    (Cold statements without session context or acknowledgement
  //    signal fall through to clarify_ambiguous · preserves the
  //    pre-3.42 behaviour for genuinely-vague inputs.)
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Bare single-word (or hyphenated) input · fail-closed on multi-word. */
function isBareWord(msg: string): boolean {
  const cleaned = msg.replace(/[.?!,;:]+$/, "").trim();
  return /^[A-Za-z][A-Za-z-]*$/.test(cleaned);
}

/** Try to pull a fuzzy place name from a short answer. Returns the
 *  canonical place or null. */
function extractBarePlace(msg: string): string | null {
  const cleaned = msg.replace(/[.?!,;:]+$/, "").trim();
  if (isBareWord(cleaned)) return fuzzyPlaceMatch(cleaned);
  // Two-word place check (e.g. "labuan bajo", "nusa dua")
  const twoWord = cleaned.toLowerCase().match(/^([a-z]+\s+[a-z]+)$/);
  if (twoWord) return fuzzyPlaceMatch(twoWord[1]);
  return null;
}
