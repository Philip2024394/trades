// src/lib/nex/brain/temporal-intelligence.ts
//
// Wave 1 · Tense & Aspect Intelligence
// Philip 2026-09-06 · AUTHORIZE · WAVE 1 · CONVERSATIONAL SEMANTIC CONTROL
//
// GOVERNING PRINCIPLE (§5 §6)
//   Represent temporal state as semantic meaning, not keyword detection.
//   Past/future/completed/not-yet reflections must NOT auto-launch
//   fresh task actions. Ongoing/current statements route normally.
//
// PRESERVATION
//   L4 · G12 · G23 · G24 · G04 · G03 · G15 · P0.3 · P0.4 · all untouched.

import type { Lang } from "./language-state";

// ─── Types ──────────────────────────────────────────────────────

export type TenseState =
  | "CURRENT"          // "I need a hotel."
  | "PAST"             // "I was looking for a hotel."
  | "FUTURE"           // "I'm going to need one tomorrow."
  | "COMPLETED"        // "I already found one."
  | "ONGOING"          // "I'm still looking."
  | "RECENT"           // "I've just found one."
  | "NOT_YET"          // "I haven't found one yet."
  | "CHANGE_OF_STATE"  // "I used to want hotels, but now I want restaurants."
  | "UNKNOWN";

export type TemporalDetection = {
  tense: TenseState;
  markers: string[];         // tokens that established the tense
  entity_mention: string | null;   // e.g. "hotel", "restaurant"
  is_temporal_question: boolean;   // "Did you already find X?"
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

// ─── Tokenizer ──────────────────────────────────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Vocabulary primitives (EN + ID) ────────────────────────────

const PAST_MARKERS_EN = new Set([
  "was", "were", "had", "used",
  "yesterday", "earlier", "before", "previously", "ago",
]);
const PAST_MARKERS_ID = new Set(["dulu", "kemarin", "sebelumnya", "tadi"]);

const FUTURE_MARKERS_EN = new Set([
  "will", "shall", "wont",
  "tomorrow", "later", "soon", "eventually",
]);
const FUTURE_MARKERS_ID = new Set(["besok", "nanti", "akan"]);

const COMPLETED_MARKERS_EN = new Set(["already", "have", "has", "have've"]);
const COMPLETED_MARKERS_ID = new Set(["sudah", "udah", "telah"]);

const ONGOING_MARKERS_EN = new Set(["still", "continue", "continuing", "keeps", "keep"]);
const ONGOING_MARKERS_ID = new Set(["masih", "terus"]);

const RECENT_MARKERS_EN = new Set(["just", "recently"]);
const RECENT_MARKERS_ID = new Set(["baru", "barusan"]);

const NOT_YET_MARKERS_EN = new Set(["yet"]);
const NOT_YET_MARKERS_ID = new Set(["belum"]);

const NOW_MARKERS_EN = new Set(["now", "currently", "right"]);
const NOW_MARKERS_ID = new Set(["sekarang"]);

// Verbs commonly indicating a task/search action
const TASK_VERBS = new Set([
  "look", "looking", "search", "searching", "find", "finding", "found",
  "book", "booking", "booked", "want", "wanted", "need", "needed",
  "cari", "mencari", "pesan", "mau", "ingin", "butuh",
]);

// Common entity tokens (subset · used to detect task-context temporal reflections)
const TASK_ENTITIES = new Set([
  "hotel", "hotels", "restaurant", "restaurants", "flight", "flights",
  "room", "rooms", "villa", "villas", "place", "places", "car", "cars",
  "restoran", "hotel", "penginapan", "tempat", "tiket",
]);

// State-change connectives ("used to X, but now Y")
const STATE_CHANGE_MARKERS = new Set(["but", "however", "instead", "tapi", "melainkan"]);

// ─── Helper: matches "used to <verb>" past-habitual ─────────────

function hasUsedTo(t: string[]): boolean {
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] === "used" && t[i + 1] === "to") return true;
  }
  return false;
}

function hasGoingTo(t: string[]): boolean {
  for (let i = 0; i < t.length - 2; i++) {
    if ((t[i] === "going" || t[i] === "gonna") && t[i + 1] === "to") return true;
    if (t[i] === "im" && t[i + 1] === "going" && t[i + 2] === "to") return true;
  }
  return false;
}

// ─── Detector ───────────────────────────────────────────────────

export function detectTemporalState(message: string): TemporalDetection {
  const t = tokens(message);
  if (t.length === 0) {
    return { tense: "UNKNOWN", markers: [], entity_mention: null, is_temporal_question: false, confidence: "HIGH", reason: "empty" };
  }

  // Question form check · presence of "?" is not tokenized; check original
  const is_temporal_question = /\b(did|does|have|has|had|will|are|were|is|apakah|sudahkah|belumkah)\b.*(already|yet|before|when|sudah|belum|kapan)\b/i.test(message);

  const markers: string[] = [];
  let entity: string | null = null;
  for (const tok of t) {
    if (TASK_ENTITIES.has(tok)) { entity = tok; break; }
  }

  // Highest-precedence: CHANGE_OF_STATE — "used to ... but now"
  if (hasUsedTo(t) && t.some((x) => STATE_CHANGE_MARKERS.has(x))) {
    markers.push("used_to", "state_change");
    return {
      tense: "CHANGE_OF_STATE",
      markers,
      entity_mention: entity,
      is_temporal_question,
      confidence: "HIGH",
      reason: "used_to_with_contrastive",
    };
  }
  // "used to" alone → PAST habitual
  if (hasUsedTo(t)) {
    markers.push("used_to");
    return {
      tense: "PAST",
      markers,
      entity_mention: entity,
      is_temporal_question,
      confidence: "HIGH",
      reason: "used_to_habitual",
    };
  }

  // ONGOING — "still <verb>" · has priority over PAST/COMPLETED because
  // "I'm still looking" is present-continuous even with a "was"-like aux.
  const hasStill = t.some((x) => ONGOING_MARKERS_EN.has(x) || ONGOING_MARKERS_ID.has(x));
  if (hasStill) {
    markers.push("ongoing");
    return {
      tense: "ONGOING",
      markers,
      entity_mention: entity,
      is_temporal_question,
      confidence: "HIGH",
      reason: "still_marker",
    };
  }

  // NOT_YET — "haven't ... yet" · "not yet" · "belum"
  const hasYet = t.some((x) => NOT_YET_MARKERS_EN.has(x) || NOT_YET_MARKERS_ID.has(x));
  const hasNeg = t.some((x) => ["not", "havent", "hasnt", "dont", "cant", "bukan", "tidak", "nggak"].includes(x));
  if (hasYet && (hasNeg || t.includes("belum"))) {
    markers.push("not_yet");
    return {
      tense: "NOT_YET",
      markers,
      entity_mention: entity,
      is_temporal_question,
      confidence: "HIGH",
      reason: "not_yet_marker",
    };
  }
  if (t[0] === "belum" || (t.length >= 2 && t.includes("belum"))) {
    markers.push("belum");
    return {
      tense: "NOT_YET",
      markers,
      entity_mention: entity,
      is_temporal_question,
      confidence: "MEDIUM",
      reason: "id_belum",
    };
  }

  // RECENT — "just <verb>" · "baru saja"
  const hasJust = t.some((x) => RECENT_MARKERS_EN.has(x));
  if (hasJust) {
    // "just" is ambiguous ("only") — but with a completed verb like "found", it's temporal-recent
    if (t.some((x) => ["found", "finished", "arrived", "got", "ketemu"].includes(x))) {
      markers.push("recent");
      return {
        tense: "RECENT",
        markers,
        entity_mention: entity,
        is_temporal_question,
        confidence: "MEDIUM",
        reason: "just_completed_verb",
      };
    }
  }
  if (t.includes("baru") && t.includes("saja")) {
    markers.push("baru_saja");
    return {
      tense: "RECENT",
      markers,
      entity_mention: entity,
      is_temporal_question,
      confidence: "HIGH",
      reason: "id_baru_saja",
    };
  }

  // COMPLETED — "already <verb>" · "have/has <verb-ed>" · "sudah"
  const hasAlready = t.some((x) => COMPLETED_MARKERS_EN.has(x) && x === "already");
  const hasSudah = t.some((x) => COMPLETED_MARKERS_ID.has(x));
  if (hasAlready || hasSudah) {
    markers.push(hasAlready ? "already" : "sudah");
    return {
      tense: "COMPLETED",
      markers,
      entity_mention: entity,
      is_temporal_question,
      confidence: "HIGH",
      reason: hasAlready ? "already_marker" : "id_sudah",
    };
  }

  // FUTURE — "will" · "going to" · "tomorrow" · "besok" · "nanti"
  const hasFutureAux = t.some((x) => FUTURE_MARKERS_EN.has(x)) || hasGoingTo(t);
  const hasFutureId = t.some((x) => FUTURE_MARKERS_ID.has(x));
  if (hasFutureAux || hasFutureId) {
    markers.push("future");
    return {
      tense: "FUTURE",
      markers,
      entity_mention: entity,
      is_temporal_question,
      confidence: "HIGH",
      reason: hasFutureId ? "id_future" : "en_future",
    };
  }

  // PAST — "was/were <verb-ing>" · "yesterday" · "kemarin"
  const hasPastEn = t.some((x) => PAST_MARKERS_EN.has(x));
  const hasPastId = t.some((x) => PAST_MARKERS_ID.has(x));
  if (hasPastEn || hasPastId) {
    // Require a task-verb or entity to avoid false-positives on generic
    // "yesterday" without task context — the past tense should be
    // meaningfully associated with an action.
    const hasTask = t.some((x) => TASK_VERBS.has(x)) || entity !== null;
    if (hasTask) {
      markers.push("past");
      return {
        tense: "PAST",
        markers,
        entity_mention: entity,
        is_temporal_question,
        confidence: "HIGH",
        reason: hasPastId ? "id_past" : "en_past",
      };
    }
    // Weak past evidence only — mark UNKNOWN rather than jumping
    markers.push("weak_past");
  }

  // NOW / CURRENT (soft signal)
  const hasNow = t.some((x) => NOW_MARKERS_EN.has(x)) || t.some((x) => NOW_MARKERS_ID.has(x));
  if (hasNow) {
    markers.push("now");
    return {
      tense: "CURRENT",
      markers,
      entity_mention: entity,
      is_temporal_question,
      confidence: "MEDIUM",
      reason: "now_marker",
    };
  }

  return {
    tense: "UNKNOWN",
    markers,
    entity_mention: entity,
    is_temporal_question,
    confidence: "LOW",
    reason: "no_temporal_marker",
  };
}

// ─── Gate: prevents past/completed/not-yet from auto-launching action ─
//
// Fires when tense is PAST/COMPLETED/NOT_YET/RECENT/CHANGE_OF_STATE
// AND the message mentions a task-entity — this is a REFLECTION about
// a prior state, not a current action request. Emits a natural
// acknowledgement that offers help without triggering fresh retrieval.

const REFLECTIVE_TENSES: ReadonlySet<TenseState> = new Set<TenseState>([
  "PAST", "COMPLETED", "NOT_YET", "RECENT", "CHANGE_OF_STATE",
]);

export type TemporalGateDecision =
  | { shouldGate: false; reason: string; detection: TemporalDetection }
  | {
      shouldGate: true;
      reason: string;
      detection: TemporalDetection;
      reply: string;
      language: Lang;
    };

export function decideTemporalGate(input: {
  userMessage: string;
  activeLanguage: Lang;
}): TemporalGateDecision {
  const detection = detectTemporalState(input.userMessage);
  // Gate only fires for reflective tenses WITH a task-entity mentioned
  // AND without a clear-current-imperative shape (e.g., "find me a hotel now").
  if (!REFLECTIVE_TENSES.has(detection.tense)) {
    return { shouldGate: false, reason: `non_reflective:${detection.tense}`, detection };
  }
  if (!detection.entity_mention) {
    return { shouldGate: false, reason: "no_entity_mentioned", detection };
  }
  // Do NOT gate temporal questions — let composer answer them normally.
  if (detection.is_temporal_question) {
    return { shouldGate: false, reason: "temporal_question_handled_by_composer", detection };
  }
  const reply = replyForReflectiveTense(detection, input.activeLanguage);
  return {
    shouldGate: true,
    reason: `reflective:${detection.tense}:${detection.entity_mention}`,
    detection,
    reply,
    language: input.activeLanguage,
  };
}

function replyForReflectiveTense(d: TemporalDetection, lang: Lang): string {
  const entity = d.entity_mention ?? "that";
  if (lang === "ID") {
    switch (d.tense) {
      case "PAST":
        return `Baik — Anda mencari ${entity} sebelumnya. Apakah Anda masih membutuhkan bantuan dengan ${entity} sekarang?`;
      case "COMPLETED":
        return `Bagus — Anda sudah menemukan ${entity}. Ada yang lain yang bisa saya bantu?`;
      case "NOT_YET":
        return `Baik — Anda belum menemukan ${entity}. Ingin saya bantu sekarang?`;
      case "RECENT":
        return `Baik — baru saja menemukan ${entity}. Ada yang bisa saya bantu selanjutnya?`;
      case "CHANGE_OF_STATE":
        return `Baik — sebelumnya ${entity}, tapi sekarang berbeda. Apa yang bisa saya bantu?`;
      default:
        return `Baik — apa yang bisa saya bantu?`;
    }
  }
  switch (d.tense) {
    case "PAST":
      return `Got it — you were looking for ${entity} earlier. Do you still need help with ${entity} now?`;
    case "COMPLETED":
      return `Great — you've already found ${entity}. Anything else I can help with?`;
    case "NOT_YET":
      return `Understood — you haven't found ${entity} yet. Want me to help now?`;
    case "RECENT":
      return `Got it — you just found ${entity}. Anything else I can help with?`;
    case "CHANGE_OF_STATE":
      return `Got it — ${entity} before, but something different now. What would you like me to help with?`;
    default:
      return `Okay — what can I help you with?`;
  }
}
