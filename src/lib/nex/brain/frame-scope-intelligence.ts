// src/lib/nex/brain/frame-scope-intelligence.ts
//
// Wave 2 · Cross-Turn Scope + Elliptical Continuation + Topic-Shift
// Philip 2026-09-06 · AUTHORIZE · WAVE 2
//
// GOVERNING PRINCIPLE (§11 §12 §13 §14 §17 §18)
//   Maintain the active conversational frame across turns.
//   Distinguish:
//     · CONTINUATION (elliptical follow-up sharing prior frame)
//     · MODIFICATION (updates a prior constraint)
//     · TOPIC_SHIFT (new active frame)
//     · NEW_REQUEST (complete standalone request)
//   Never let stale result sets be reused when the frame has shifted.
//   Never guess on ambiguous scope — clarify.

import type { SessionState } from "./session";
import type { Lang } from "./language-state";

// ─── Types ──────────────────────────────────────────────────────

export type ResultSetState =
  | "NO_RESULT_SET"          // no prior NEX-emitted result
  | "ACTIVE_RESULT_SET"       // recent NEX result set relevant to current frame
  | "HISTORICAL_RESULT_SET"   // prior result set from a shifted-away frame
  | "STALE_RESULT_SET";       // prior set no longer valid

export type FrameTransition =
  | "CONTINUATION"           // elliptical or reference — same domain/task
  | "MODIFICATION"           // updates a constraint of the active frame
  | "TOPIC_SHIFT"            // explicit change of domain
  | "NEW_REQUEST"            // fresh unrelated request
  | "AMBIGUOUS"              // multiple plausible interpretations
  | "UNKNOWN";

export type ScopeAnalysis = {
  transition: FrameTransition;
  is_elliptical: boolean;
  is_complete_new_request: boolean;
  active_result_set: ResultSetState;
  active_domain_hint: string | null;   // hotel · restaurant · etc.
  topic_shift_marker: string | null;
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  /** NEW (Conversational Continuation Slice · D4 · Philip 2026-09-06):
   *  the DOMAIN NOUN drawn from the session's active-result-set state,
   *  BEFORE this turn — used to detect a vertical shift when the current
   *  turn's domain noun maps to a different vertical. Null when there is
   *  no prior active result set. */
  prior_domain_hint?: string | null;
};

/** NEW (Conversational Continuation Slice · D4 · Philip 2026-09-06):
 *  Map a domain noun (as detected by analyzeScope) to the world-adapter
 *  vertical it belongs to. Uses only the DOMAIN_NOUNS vocabulary that
 *  already exists in this module — NOT a new phrase list.
 *
 *  Returns null when the noun does not map to a known vertical.
 */
export function mapDomainNounToVertical(noun: string | null | undefined):
  "accommodation" | "food" | "commerce" | "transport" | null {
  if (!noun) return null;
  const n = noun.toLowerCase();
  if (n === "hotel" || n === "hotels" || n === "villa" || n === "villas"
      || n === "penginapan") return "accommodation";
  if (n === "restaurant" || n === "restaurants" || n === "cafe" || n === "cafes"
      || n === "bar" || n === "bars" || n === "restoran" || n === "kafe") return "food";
  if (n === "phone" || n === "phones" || n === "laptop" || n === "car"
      || n === "cars" || n === "bike" || n === "bikes"
      || n === "hp" || n === "mobil" || n === "motor") return "commerce";
  if (n === "flight" || n === "flights") return "transport";
  return null;
}

// ─── Tokenizer ──────────────────────────────────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Vocabulary (EN + ID) ───────────────────────────────────────

// Domain-noun tokens · presence of one signals a complete request.
// NOTE: "airport"/"station"/"bandara"/"stasiun" are excluded because
// they typically appear as SPATIAL ANCHORS ("near the airport") not
// as task targets. If a user genuinely wants airport info they'll use
// an interrogative shape which is caught separately.
const DOMAIN_NOUNS = new Set([
  "hotel", "hotels", "restaurant", "restaurants", "flight", "flights",
  "villa", "villas", "cafe", "cafes", "bar", "bars",
  "phone", "phones", "laptop", "car", "cars", "bike", "bikes",
  "restoran", "kafe", "penginapan",
  "hp", "mobil", "motor",
]);

// Explicit imperative-shape openers (indicate NEW_REQUEST)
const IMPERATIVE_OPENERS = new Set([
  "find", "show", "get", "book", "give", "list", "search", "recommend",
  "cari", "carikan", "tunjukkan", "pesan", "berikan",
]);

// Interrogative openers (INFORMATION_QUESTION shape)
const INTERROGATIVE_OPENERS = new Set([
  "what", "when", "where", "why", "how", "who", "which",
  "apa", "kapan", "dimana", "kenapa", "bagaimana", "siapa", "yang",
]);

// Topic-shift markers (explicit intention to change frame)
const TOPIC_SHIFT_MARKERS = new Set([
  "actually", "instead", "forget", "nevermind",
  "sebenarnya", "sebagai", "gantinya",
]);

// Elliptical / continuation openers (very short messages that continue)
const CONTINUATION_MARKERS = new Set([
  // comparatives
  "cheaper", "closer", "farther", "bigger", "smaller",
  "better", "worse", "faster", "slower", "quieter",
  "murah", "dekat", "jauh", "besar", "kecil", "tenang",
  // quantity increments
  "more", "another", "lagi",
  // relative locations without a domain noun
  "near", "around", "beside",
]);

// ─── Session inspection ─────────────────────────────────────────

/** Determine active-result-set state from the session. Uses the entity
 *  window: entities sourced from a prior NEX reply indicate an active
 *  result set. */
export function inspectResultSetState(session: SessionState | null | undefined): {
  state: ResultSetState;
  domain_hint: string | null;
} {
  if (!session) return { state: "NO_RESULT_SET", domain_hint: null };
  const entities = session.entities ?? [];
  const nexReplyEntities = entities.filter((e) =>
    (e as unknown as { source?: string }).source === "nex_reply",
  );
  if (nexReplyEntities.length === 0) return { state: "NO_RESULT_SET", domain_hint: null };
  // Extract dominant vertical from refId prefix
  let hotels = 0, restaurants = 0, services = 0, other = 0;
  let domain_hint: string | null = null;
  for (const e of nexReplyEntities) {
    const refId = (e as unknown as { refId?: string }).refId ?? "";
    if (/accommodation/i.test(refId)) hotels++;
    else if (/food/i.test(refId)) restaurants++;
    else if (/service/i.test(refId)) services++;
    else other++;
  }
  if (hotels > 0 && hotels >= restaurants && hotels >= services) domain_hint = "accommodation";
  else if (restaurants > 0 && restaurants >= services) domain_hint = "food";
  else if (services > 0) domain_hint = "service";
  return { state: "ACTIVE_RESULT_SET", domain_hint };
}

// ─── Scope / frame analysis ─────────────────────────────────────

export function analyzeScope(input: {
  message: string;
  session: SessionState | null | undefined;
}): ScopeAnalysis {
  const t = tokens(input.message);
  const rs = inspectResultSetState(input.session);

  // TOPIC_SHIFT · explicit marker at start of message
  const topicShiftMarker = t[0] && TOPIC_SHIFT_MARKERS.has(t[0]) ? t[0] : null;
  const hasTopicShiftMarker = topicShiftMarker !== null;

  // Has an explicit domain noun (e.g., "hotel", "restaurant")
  const domainNoun = t.find((tok) => DOMAIN_NOUNS.has(tok)) ?? null;

  // Has imperative or interrogative opener (typical NEW_REQUEST shape)
  const startsWithImperative = t[0] && IMPERATIVE_OPENERS.has(t[0]);
  const startsWithInterrogative = t[0] && INTERROGATIVE_OPENERS.has(t[0]);
  const isCompleteRequest = !!(domainNoun && (startsWithImperative || startsWithInterrogative));

  // Elliptical detection · short message with continuation-shape tokens
  // AND no explicit domain noun (§14).
  const isShort = t.length <= 6;
  const hasContinuationMarker = t.some((x) => CONTINUATION_MARKERS.has(x));
  const isElliptical = isShort && hasContinuationMarker && !domainNoun && !startsWithImperative && !startsWithInterrogative;

  // Case 1 · TOPIC_SHIFT explicit marker with a new domain noun
  if (hasTopicShiftMarker && domainNoun) {
    return {
      transition: "TOPIC_SHIFT",
      is_elliptical: false, is_complete_new_request: true,
      active_result_set: rs.state === "ACTIVE_RESULT_SET" ? "HISTORICAL_RESULT_SET" : rs.state,
      active_domain_hint: domainNoun,
      prior_domain_hint: rs.domain_hint,
      topic_shift_marker: topicShiftMarker,
      reason: `topic_shift:${topicShiftMarker}:${domainNoun}`,
      confidence: "HIGH",
    };
  }

  // Case 1b · IMPLICIT TOPIC_SHIFT (Conversational Continuation Slice ·
  // D4 · Philip 2026-09-06) · the current turn contains a domain noun
  // whose vertical is different from the active result set's vertical,
  // even without an "actually" marker. Semantic signal: DIFFERENT
  // vertical = the user is changing topic. Uses ONLY the DOMAIN_NOUNS
  // vocabulary + mapDomainNounToVertical — not a new phrase list.
  //
  // NOTE: `inspectResultSetState` returns the vertical NAME (not a
  // domain noun) via rs.domain_hint · so we compare the current-turn
  // vertical directly against rs.domain_hint.
  if (
    domainNoun
    && rs.state === "ACTIVE_RESULT_SET"
    && rs.domain_hint
  ) {
    const currentVertical = mapDomainNounToVertical(domainNoun);
    const priorVertical = rs.domain_hint; // already a vertical name
    if (currentVertical && priorVertical && currentVertical !== priorVertical) {
      return {
        transition: "TOPIC_SHIFT",
        is_elliptical: false, is_complete_new_request: true,
        active_result_set: "HISTORICAL_RESULT_SET",
        active_domain_hint: domainNoun,
        prior_domain_hint: priorVertical,
        topic_shift_marker: null,
        reason: `implicit_topic_shift:${priorVertical}->${currentVertical}`,
        confidence: "HIGH",
      };
    }
  }

  // Case 2 · Explicit imperative or complete question — NEW_REQUEST
  if (isCompleteRequest) {
    return {
      transition: rs.state === "ACTIVE_RESULT_SET" && rs.domain_hint && domainNoun
                  && !domainNoun.startsWith(rs.domain_hint.slice(0, 4))
                    ? "TOPIC_SHIFT"
                    : "NEW_REQUEST",
      is_elliptical: false, is_complete_new_request: true,
      active_result_set: rs.state,
      active_domain_hint: domainNoun,
      topic_shift_marker: topicShiftMarker,
      reason: `complete_request:${t[0]}:${domainNoun}`,
      confidence: "HIGH",
    };
  }

  // Case 3 · Elliptical continuation · requires active result set
  if (isElliptical) {
    if (rs.state === "ACTIVE_RESULT_SET") {
      return {
        transition: "CONTINUATION",
        is_elliptical: true, is_complete_new_request: false,
        active_result_set: rs.state,
        active_domain_hint: rs.domain_hint,
        topic_shift_marker: null,
        reason: `elliptical_continuation:${rs.domain_hint ?? "unknown"}`,
        confidence: "MEDIUM",
      };
    }
    // Elliptical WITHOUT an active result set → ambiguous (needs
    // clarification per §17)
    return {
      transition: "AMBIGUOUS",
      is_elliptical: true, is_complete_new_request: false,
      active_result_set: rs.state,
      active_domain_hint: null,
      topic_shift_marker: null,
      reason: "elliptical_without_result_set",
      confidence: "MEDIUM",
    };
  }

  // Case 4 · Ambiguous shape — no marker · no domain · no shape signal
  return {
    transition: "UNKNOWN",
    is_elliptical: false, is_complete_new_request: false,
    active_result_set: rs.state,
    active_domain_hint: rs.domain_hint,
    topic_shift_marker: null,
    reason: "no_clear_frame_signal",
    confidence: "LOW",
  };
}

// ─── Gate: elliptical without result set → clarify (§17) ────────

export type FrameScopeGateDecision =
  | { shouldGate: false; reason: string; analysis: ScopeAnalysis; vertical_switch_target?: "accommodation" | "food" | "commerce" | "transport" | null }
  | {
      shouldGate: true;
      reason: string;
      analysis: ScopeAnalysis;
      reply: string;
      language: Lang;
      /** NEW (Conversational Continuation Slice · D4 · Philip 2026-09-06):
       *  when a TOPIC_SHIFT gate fires because the current turn's domain
       *  noun maps to a DIFFERENT world-adapter vertical than the active
       *  result set's vertical, this field carries the new vertical so
       *  the caller can apply `applyVerticalSwitchReset` on the session.
       *  Null when the shift target is unmapped or the gate did not fire
       *  for topic-shift reasons. */
      vertical_switch_target?: "accommodation" | "food" | "commerce" | "transport" | null;
    };

export function decideFrameScopeGate(input: {
  userMessage: string;
  session: SessionState | null | undefined;
  activeLanguage: Lang;
}): FrameScopeGateDecision {
  const analysis = analyzeScope({ message: input.userMessage, session: input.session });

  // Elliptical follow-up with no active result set to bind to →
  // clarify rather than reinterpret as a fresh unrelated search.
  if (analysis.transition === "AMBIGUOUS" && analysis.is_elliptical) {
    const reply = input.activeLanguage === "ID"
      ? "Bisa Anda jelaskan lebih spesifik? Saya belum menampilkan hasil apa pun di percakapan ini yang bisa dilanjutkan."
      : "Could you be a bit more specific? I haven't shown any results yet in this conversation to build on.";
    return {
      shouldGate: true,
      reason: "elliptical_without_result_set",
      analysis,
      reply,
      language: input.activeLanguage,
    };
  }

  // POSITIVE TOPIC_SHIFT with a different-vertical domain noun
  // (Conversational Continuation Slice · D4 · Philip 2026-09-06)
  //
  // Fires when:
  //   · analyzeScope classified this turn as TOPIC_SHIFT (either explicit
  //     via "actually"/"instead"/"forget" + domain noun · or implicit via
  //     the presence of a different-vertical domain noun on top of an
  //     active result set)
  //   · the current-turn domain noun maps to a DIFFERENT world-adapter
  //     vertical than the active result set's vertical
  //
  // Emits an acknowledgement reply naming the new vertical and signals
  // `vertical_switch_target` so the caller can reset the session
  // (applyVerticalSwitchReset) before subsequent turns route. NO
  // fabrication · uses only DOMAIN_NOUNS + mapDomainNounToVertical
  // vocabulary that already exists in this module.
  if (analysis.transition === "TOPIC_SHIFT" && analysis.active_domain_hint) {
    const newVertical = mapDomainNounToVertical(analysis.active_domain_hint);
    // For the prior, prefer analysis.prior_domain_hint when it is already
    // a vertical NAME (accommodation / food / commerce / transport ·
    // populated by Case 1b) · else fall back to mapping the prior noun.
    const priorVerticalNames = new Set(["accommodation", "food", "commerce", "transport", "service", "places"]);
    const priorVertical = analysis.prior_domain_hint
      ? (priorVerticalNames.has(analysis.prior_domain_hint)
          ? analysis.prior_domain_hint
          : mapDomainNounToVertical(analysis.prior_domain_hint))
      : null;
    if (newVertical && priorVertical && newVertical !== priorVertical) {
      const label = newVertical === "food" ? (input.activeLanguage === "ID" ? "restoran" : "restaurants")
                  : newVertical === "accommodation" ? (input.activeLanguage === "ID" ? "penginapan" : "places to stay")
                  : newVertical === "commerce" ? (input.activeLanguage === "ID" ? "produk" : "products")
                  : newVertical === "transport" ? (input.activeLanguage === "ID" ? "transportasi" : "transport")
                  : (input.activeLanguage === "ID" ? "topik baru" : "the new topic");
      const reply = input.activeLanguage === "ID"
        ? `Baik — pindah ke ${label}. Area atau tipe apa yang Anda cari?`
        : `Got it — switching to ${label}. What area or type are you looking for?`;
      return {
        shouldGate: true,
        reason: `topic_shift_vertical_switch:${priorVertical}->${newVertical}`,
        analysis,
        reply,
        language: input.activeLanguage,
        vertical_switch_target: newVertical,
      };
    }
  }
  return { shouldGate: false, reason: `pass_through:${analysis.transition}`, analysis };
}
