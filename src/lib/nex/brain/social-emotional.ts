// src/lib/nex/brain/social-emotional.ts
//
// Wave 3 · Emotional / Social Speech + Confusion Signal
// Philip 2026-09-06 · AUTHORIZE · WAVE 3 · Capabilities C, D
//
// PURPOSE (§6 §7 §8)
//   Spoken conversation is full of emotional reactions, gratitude,
//   short exclamations, and expressions of confusion. These utterances
//   MUST NOT silently trigger:
//     · a new search
//     · retrieval
//     · topic reset
//     · a "found N" re-emission of stale results
//
//   AND: humans mix social + task in one turn:
//     "nice, now show me the second one"
//     "thanks — can you find restaurants too?"
//   Both dimensions must survive.
//
// SCOPE
//   This module ADDS coverage that existing L4 conv-function doesn't
//   cover:
//     · Emotional exclamations (EN + ID): wow, damn, love it, mantap, aduh
//     · Confusion signals (EN + ID): huh?, I'm confused, bingung nih
//     · Social-plus-task mixing detection
//   L4 remains authoritative for the acts it already covers (greeting,
//   gratitude, personal-context offer, meta-conversation). This module
//   fires AFTER L4 · so L4 wins when it already matched.
//
// PRESERVATION
//   G03 · G12 · G15 · G23 · G24 · L4 · Wave 1 · Wave 2 · capability-
//   display · result-followup · P0.3 · P0.4 all remain authoritative.

import type { SessionState, SessionEntity } from "./session";
import type { Lang } from "./language-state";

// ─── Types ──────────────────────────────────────────────────────

export type SocialEmotionalAct =
  | "EMOTIONAL_REACTION"      // wow / mantap / damn / love it
  | "CONFUSION"               // huh / bingung / what do you mean
  | "SOCIAL_PLUS_TASK"        // "nice, now show me the second one"
  | "NONE";

export type Emotion =
  | "POSITIVE"                // wow, nice, mantap, love it
  | "NEGATIVE"                // damn, aduh, oh no, that's annoying
  | "SURPRISE"                // wow, seriously?
  | "LAUGHTER"                // haha, wkwk
  | "NEUTRAL";

export type SocialEmotionalDetection = {
  act: SocialEmotionalAct;
  emotion: Emotion;
  task_fragment: string | null;   // §7 · trailing task if any
  markers: string[];
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

// ─── Emotion lexicon (EN + ID) ──────────────────────────────────

const POSITIVE = new Set([
  // English
  "nice", "great", "awesome", "brilliant", "excellent", "cool",
  "love", "amazing", "perfect", "wonderful", "beautiful", "sweet",
  // Gratitude · lexically emotional (L4 handles the primary gratitude
  // dialogue-act; here we still treat "thanks" as a POSITIVE affect
  // signal so SOCIAL_PLUS_TASK mixing is caught when a task follows.)
  "thanks", "thank", "cheers", "appreciate",
  "makasih", "terimakasih",
  // Indonesian
  "mantap", "bagus", "keren", "hebat", "sip", "asik", "cakep", "top",
]);
const NEGATIVE = new Set([
  "damn", "shit", "ugh", "annoying", "terrible", "awful", "bad",
  "aduh", "sialan", "jelek",
]);
const SURPRISE = new Set([
  "wow", "whoa", "seriously", "really", "omg",
  "wah", "waduh", "astaga", "serius",
]);
const LAUGHTER = new Set([
  "haha", "hah", "hehe", "lol", "lmao", "lmfao",
  "wkwk", "wkwkwk", "hihi",
]);

// ─── Confusion lexicon ──────────────────────────────────────────

// Confusion openers must include enough surface material to not
// over-match. Bare "what" alone (t.length === 1) is confusion, but
// "what does the first one have?" is a full question that starts with
// "what" and should NOT be confusion — checked separately.
const CONFUSION_STARTERS: ReadonlyArray<ReadonlyArray<string>> = [
  ["huh"],
  ["huhh"],
  ["what", "do", "you", "mean"],
  ["what", "you", "mean"],
  ["i", "dont", "understand"],
  ["i", "dont", "get", "it"],
  ["im", "confused"],
  ["im", "not", "sure", "what"],
  ["you", "lost", "me"],
  ["why", "are", "you", "saying", "that"],
  ["that", "doesnt", "make", "sense"],
  // Indonesian
  ["maksudnya", "apa"],
  ["nggak", "ngerti"],
  ["tidak", "ngerti"],
  ["aku", "bingung"],
  ["saya", "bingung"],
  ["bingung", "nih"],
  ["gimana", "maksudnya"],
  ["kok", "begitu"],
];

// ─── Task-shape indicators (for social + task mixing) ───────────

const TASK_VERB_TOKENS = new Set([
  "find", "show", "search", "list", "get", "give", "book", "recommend",
  "cari", "carikan", "tunjukkan", "pesan", "berikan",
]);
const IMPERATIVE_OPENERS = new Set([
  "find", "show", "get", "book", "give", "list", "search", "recommend",
  "cari", "carikan", "tunjukkan", "pesan", "berikan",
]);
const INTERROGATIVE_OPENERS = new Set([
  "what", "when", "where", "why", "how", "who", "which",
  "apa", "kapan", "dimana", "kenapa", "bagaimana", "siapa",
]);

// ─── Helpers ────────────────────────────────────────────────────

function startsWithSequence(t: string[], seq: ReadonlyArray<string>): boolean {
  if (seq.length > t.length) return false;
  for (let i = 0; i < seq.length; i++) if (t[i] !== seq[i]) return false;
  return true;
}
function containsAny(t: string[], set: Set<string>): boolean {
  return t.some((x) => set.has(x));
}
function classifyEmotion(t: string[]): Emotion {
  // Prefer POSITIVE over SURPRISE when both are present ("wah bagus"
  // reads as positive-with-emphasis, not raw surprise).
  const hasPositive = containsAny(t, POSITIVE);
  if (containsAny(t, LAUGHTER)) return "LAUGHTER";
  if (containsAny(t, NEGATIVE)) return "NEGATIVE";
  if (hasPositive) return "POSITIVE";
  if (containsAny(t, SURPRISE)) return "SURPRISE";
  return "NEUTRAL";
}
function hasTaskShape(t: string[]): boolean {
  if (t.length === 0) return false;
  if (IMPERATIVE_OPENERS.has(t[0])) return true;
  if (INTERROGATIVE_OPENERS.has(t[0])) return true;
  if (t.some((x) => TASK_VERB_TOKENS.has(x))) return true;
  return false;
}

// ─── Classifier ─────────────────────────────────────────────────

export function classifySocialEmotional(message: string): SocialEmotionalDetection {
  const t = tokens(message);
  const markers: string[] = [];
  const none = (reason: string): SocialEmotionalDetection => ({
    act: "NONE", emotion: "NEUTRAL", task_fragment: null,
    markers, confidence: "HIGH", reason,
  });
  if (t.length === 0) return none("empty");

  // 1 · CONFUSION · starts-with a confusion pattern.
  //     GUARD: when a capability verb is present ("book", "reserve",
  //     "buy", "contact", ID equivalents) the message is really a
  //     capability clarification — defer to capability-display which
  //     runs AFTER this gate. E.g. "what do you mean I can't book?"
  //     is a CAPABILITY_CLARIFICATION, not a generic CONFUSION.
  const capabilityVerbPresent = t.some((x) =>
    x === "book" || x === "reserve" || x === "buy" || x === "contact" || x === "purchase"
    || x === "pesan" || x === "reservasi" || x === "beli" || x === "kontak" || x === "hubungi",
  );
  if (!capabilityVerbPresent) {
    // Bare "what" or "what?" as a standalone confusion utterance.
    if (t.length === 1 && (t[0] === "what" || t[0] === "wut")) {
      markers.push("confusion_start:bare_what");
      return {
        act: "CONFUSION",
        emotion: "NEUTRAL",
        task_fragment: null,
        markers,
        confidence: "HIGH",
        reason: "confusion:bare_what",
      };
    }
    for (const seq of CONFUSION_STARTERS) {
      if (startsWithSequence(t, seq)) {
        markers.push(`confusion_start:${seq.join("_")}`);
        return {
          act: "CONFUSION",
          emotion: "NEUTRAL",
          task_fragment: null,
          markers,
          confidence: "HIGH",
          reason: `confusion:${seq.join("_")}`,
        };
      }
    }
  } else {
    markers.push("confusion_deferred_capability_verb_present");
  }

  // 2 · Emotional cue anywhere in the message.
  const emotion = classifyEmotion(t);
  const emotionalTokenPresent = emotion !== "NEUTRAL";

  // 3 · Task shape present?
  const taskShape = hasTaskShape(t);

  // 4 · Emotional + task mix (SOCIAL_PLUS_TASK).
  if (emotionalTokenPresent && taskShape) {
    markers.push(`emotion:${emotion}`, "task_shape:present");
    // Task fragment · everything from first task-verb / imperative to end.
    const idx = t.findIndex((x) => IMPERATIVE_OPENERS.has(x) || TASK_VERB_TOKENS.has(x) || INTERROGATIVE_OPENERS.has(x));
    const task_fragment = idx >= 0 ? t.slice(idx).join(" ") : null;
    return {
      act: "SOCIAL_PLUS_TASK",
      emotion,
      task_fragment,
      markers,
      confidence: "HIGH",
      reason: `social_plus_task:${emotion}`,
    };
  }

  // 5 · Pure emotional reaction (no task): fires SOCIAL protection.
  //     Only classify when the message is SHORT · long emotional-flavoured
  //     sentences might carry substantive content and shouldn't be
  //     shortcut here.
  if (emotionalTokenPresent && t.length <= 4) {
    markers.push(`emotion:${emotion}`, "short_emotional");
    return {
      act: "EMOTIONAL_REACTION",
      emotion,
      task_fragment: null,
      markers,
      confidence: "HIGH",
      reason: `emotional_reaction:${emotion}`,
    };
  }

  return none("no_pattern_matched");
}

// ─── Deterministic replies (natural · brief · bilingual) ────────

function emotionalAckReply(emotion: Emotion, lang: Lang): string {
  if (lang === "ID") {
    switch (emotion) {
      case "POSITIVE": return "Senang mendengarnya. Ada yang bisa saya bantu?";
      case "NEGATIVE": return "Iya, saya mengerti. Mau saya bantu apa selanjutnya?";
      case "SURPRISE": return "Iya kan? Mau saya bantu lebih lanjut?";
      case "LAUGHTER": return "Hehe. Apa lagi yang mau kita cari?";
      default:         return "Baik. Ada yang bisa saya bantu?";
    }
  }
  switch (emotion) {
    case "POSITIVE": return "Glad to hear that. Anything I can help with next?";
    case "NEGATIVE": return "I hear you. What would you like me to help with?";
    case "SURPRISE": return "Right? Want me to keep going?";
    case "LAUGHTER": return "Ha. What are we looking at next?";
    default:         return "Alright. Anything I can help with?";
  }
}

function confusionReply(context: {
  lastNexQuestion: string | null;
  hasActiveResultSet: boolean;
  lang: Lang;
}): string {
  const { lastNexQuestion, hasActiveResultSet, lang } = context;
  if (lastNexQuestion && lastNexQuestion.trim()) {
    if (lang === "ID") return `Maaf kalau kurang jelas. Yang saya tanyakan barusan: ${lastNexQuestion.trim()} Mau saya jelaskan lebih detail?`;
    return `Sorry — I asked: ${lastNexQuestion.trim()} Want me to explain more?`;
  }
  if (hasActiveResultSet) {
    if (lang === "ID") return "Bagian mana yang bikin bingung? Saya bisa jelaskan dari daftar yang barusan atau bantu Anda mencari sesuatu yang lebih tepat.";
    return "Which part is confusing? I can walk through the list I just showed, or help you refine what you're looking for.";
  }
  if (lang === "ID") return "Bisa Anda jelaskan sedikit lebih spesifik? Saya belum yakin bagian mana yang perlu saya perjelas.";
  return "Could you tell me a bit more? I'm not sure which part to clarify.";
}

// ─── Session helpers ────────────────────────────────────────────

function extractLastNexQuestion(session: SessionState | null | undefined): string | null {
  if (!session) return null;
  const q = (session as unknown as { lastNexQuestion?: string }).lastNexQuestion;
  return typeof q === "string" && q.trim() ? q : null;
}
function hasActiveResultSet(session: SessionState | null | undefined): boolean {
  if (!session) return false;
  const entities = (session.entities ?? []) as SessionEntity[];
  return entities.some((e) => (e as unknown as { source?: string }).source === "nex_reply");
}

// ─── Public gate decision ───────────────────────────────────────

export type SocialEmotionalGateDecision =
  | { shouldGate: false; reason: string; detection: SocialEmotionalDetection }
  | {
      shouldGate: true;
      reason: string;
      detection: SocialEmotionalDetection;
      reply: string;
      language: Lang;
      /** For SOCIAL_PLUS_TASK · the sub-task fragment we recognized. It
       *  is exposed for observability only · downstream retrieval still
       *  processes the full turn. */
      task_fragment: string | null;
      /** Whether we suppressed the retrieval / composer for this turn.
       *  True for pure EMOTIONAL_REACTION and CONFUSION. False for
       *  SOCIAL_PLUS_TASK · which we DO NOT gate (existing pipeline
       *  handles both dimensions). */
      suppressed_composition: boolean;
    };

export function decideSocialEmotionalGate(input: {
  userMessage: string;
  session: SessionState | null | undefined;
  activeLanguage: Lang;
}): SocialEmotionalGateDecision {
  const detection = classifySocialEmotional(input.userMessage);
  if (detection.act === "NONE") {
    return { shouldGate: false, reason: "no_social_emotional_act", detection };
  }
  const lang = input.activeLanguage;
  if (detection.act === "EMOTIONAL_REACTION") {
    return {
      shouldGate: true,
      reason: `emotional_reaction:${detection.emotion}`,
      detection,
      reply: emotionalAckReply(detection.emotion, lang),
      language: lang,
      task_fragment: null,
      suppressed_composition: true,
    };
  }
  if (detection.act === "CONFUSION") {
    return {
      shouldGate: true,
      reason: "confusion",
      detection,
      reply: confusionReply({
        lastNexQuestion: extractLastNexQuestion(input.session),
        hasActiveResultSet: hasActiveResultSet(input.session),
        lang,
      }),
      language: lang,
      task_fragment: null,
      suppressed_composition: true,
    };
  }
  // SOCIAL_PLUS_TASK · DO NOT gate. Emit observability so downstream
  // knows a social preamble is present · but let the existing pipeline
  // handle the task portion. §7 · "Social language must not erase the
  // task. Task language must not erase the social meaning."
  return {
    shouldGate: false,
    reason: `social_plus_task_observability_only:${detection.emotion}`,
    detection,
  };
}
