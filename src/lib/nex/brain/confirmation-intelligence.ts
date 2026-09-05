// src/lib/nex/brain/confirmation-intelligence.ts
//
// G15 · Confirmation & Yes/No Intelligence
// Philip 2026-09-06 · AUTHORIZE · G15
//
// GOVERNING PRINCIPLE (§1 §2 §12)
//   NEVER interpret "yes" as an isolated intent.
//   Resolve: YES → yes to WHAT?
//   If there is no safely resolvable target, do not guess — clarify.
//
// SCOPE
//   · Confirmation-form classifier (AFFIRM · REJECT · UNCERTAIN ·
//     QUALIFIED · SOCIAL · CORRECTIVE · NONE) · English + Indonesian
//   · Active-proposition extractor (from session.lastNexQuestion and
//     the last NEX dialogue turn) — types: ACTION · CLARIFICATION ·
//     OFFER · CORRECTION_CHECK · ENTITY · PROPOSITION · NONE
//   · Resolution: CONFIRMED · REJECTED · UNCERTAIN · AMBIGUOUS ·
//     NO_TARGET · CORRECTIVE
//   · Deterministic gate that fires when guidance-worthy (no target,
//     ambiguous, corrective-reject, standalone social-safe)
//
// PRESERVATION (§22)
//   L4 · G12 · G23 · G24 · G04 · G03 · P0.3 · P0.4 · result-followup ·
//   language-intelligence · lexicon — untouched. This module consumes
//   session state; it does not write to it and does not modify any
//   other classifier.

import type { SessionState } from "./session";
import type { Lang } from "./language-state";

// ─── Types ──────────────────────────────────────────────────────

export type ConfirmationForm =
  | "AFFIRM"        // yes · yeah · sure · ok · iya · oke · boleh · lanjut
  | "REJECT"        // no · nope · nah · not really · tidak · nggak · jangan
  | "UNCERTAIN"     // I think so · probably · maybe · mungkin · sepertinya
  | "QUALIFIED"     // yes but · no but · iya tapi
  | "CORRECTIVE"    // "no, restaurant" / "yes, restaurant" — negation/affirmation with alternative
  | "SOCIAL"        // thanks · nice · great · got it — social ack, not action
  | "NONE";         // not a confirmation

export type AnswerPolarity = "AFFIRM" | "REJECT" | "UNCERTAIN" | "NONE";

export type ConfirmationDetection = {
  form: ConfirmationForm;
  answer_polarity: AnswerPolarity;
  qualifier_text?: string;
  corrective_target?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

export type PropositionKind =
  | "ACTION"             // "Want me to show more?" · "Should I search Yogyakarta?"
  | "CLARIFICATION"      // "Do you mean Gaotama Hotel?" · "Is that the one?"
  | "OFFER"              // "Want to compare them?"
  | "CORRECTION_CHECK"   // "Did you mean restaurants?"
  | "ENTITY"             // question binding to a specific entity
  | "PROPOSITION"        // generic question
  | "NONE";              // no pending proposition

export type ActiveProposition = {
  kind: PropositionKind;
  text: string;
  /** Whether the question contains negation (affects answer polarity
   *  interpretation per §15). */
  polarity_hint: "positive" | "negative";
};

export type Resolution =
  | "CONFIRMED"     // AFFIRM against a resolved proposition
  | "REJECTED"      // REJECT against a resolved proposition
  | "UNCERTAIN"     // uncertain answer to any proposition
  | "AMBIGUOUS"     // form detected but proposition ambiguous or multiple
  | "NO_TARGET"     // form detected but no active proposition
  | "CORRECTIVE"    // yes/no + alternative target
  | "SOCIAL";       // social ack · not action-triggering

export type ConfirmationResolution = {
  detection: ConfirmationDetection;
  active_proposition: ActiveProposition | null;
  resolution: Resolution;
  effective_polarity: AnswerPolarity | "AMBIGUOUS";
  ambiguity_reason?: string;
  frame_transition: "STAY" | "EXECUTE" | "REJECT" | "CLARIFY" | "SOCIAL";
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

// ─── Lexicon primitives ────────────────────────────────────────

// Short-form affirmations (single tokens). Position 0 with limited
// message length signals confirmation. Longer messages may still be
// affirmations via multi-token patterns below.
const AFFIRM_SHORTS = new Set([
  // English
  "yes", "yeah", "yep", "yup", "sure", "ok", "okay", "alright", "alrite",
  "absolutely", "exactly", "correct", "right", "definitely", "certainly",
  // Indonesian
  "iya", "ya", "oke", "tentu", "boleh", "silakan", "lanjut", "betul", "benar",
]);

const REJECT_SHORTS = new Set([
  // English
  "no", "nope", "nah",
  // Indonesian
  "tidak", "nggak", "enggak", "gak", "jangan", "bukan",
]);

const UNCERTAIN_MARKERS = new Set([
  "probably", "maybe", "perhaps", "possibly",
  "mungkin", "sepertinya",
]);

// Multi-token affirmations / rejections
const AFFIRM_PATTERNS: Array<ReadonlyArray<string>> = [
  ["yes", "please"], ["please", "do"], ["go", "ahead"],
  ["thats", "right"], ["that", "is", "right"],
  ["for", "sure"], ["of", "course"], ["you", "bet"],
  ["sure", "why", "not"],
  ["yes", "that", "one"],
  ["silakan"], ["boleh", "silakan"],
];

const REJECT_PATTERNS: Array<ReadonlyArray<string>> = [
  ["not", "really"], ["i", "dont", "think", "so"], ["dont", "think", "so"],
  ["actually", "no"], ["actually", "not"],
  ["tidak", "juga"],
];

const UNCERTAIN_PATTERNS: Array<ReadonlyArray<string>> = [
  ["i", "think", "so"], ["i", "guess"], ["kind", "of"], ["sort", "of"],
  ["kurang", "lebih"], ["sepertinya", "iya"], ["saya", "kira"],
];

// Social · "thanks", "nice", "great", "got it" — must NOT be treated as
// action-triggering affirmations even though they may appear positive.
const SOCIAL_ACK_SHORTS = new Set([
  "thanks", "thank", "thx", "ty", "nice", "great", "cool", "awesome",
  "makasih", "terima", // partial matches; refined below
]);

const SOCIAL_ACK_PATTERNS: Array<ReadonlyArray<string>> = [
  ["got", "it"], ["understood"], ["i", "see"], ["okay", "then"],
  ["thanks", "nex"], ["terima", "kasih"],
  // "no thanks" / "no thank you" — social rejection · not action-cancelling
  ["no", "thanks"], ["no", "thank", "you"],
];

// Corrective markers ("no, restaurant" / "yes, restaurant")
const CORRECTIVE_HEADS = new Set(["no", "yes", "actually", "tidak", "iya"]);

// ─── Helpers ────────────────────────────────────────────────────

function matchSequenceAnywhere(t: string[], seq: ReadonlyArray<string>): boolean {
  outer: for (let i = 0; i <= t.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (t[i + j] !== seq[j]) continue outer;
    }
    return true;
  }
  return false;
}

function startsWithSequence(t: string[], seq: ReadonlyArray<string>): boolean {
  if (seq.length > t.length) return false;
  for (let i = 0; i < seq.length; i++) if (t[i] !== seq[i]) return false;
  return true;
}

// ─── Confirmation-form classifier ───────────────────────────────

export function classifyConfirmationForm(message: string): ConfirmationDetection {
  const t = tokens(message);
  if (t.length === 0) {
    return { form: "NONE", answer_polarity: "NONE", confidence: "HIGH", reason: "empty" };
  }

  // 1 · SOCIAL fixed forms · run FIRST · so "no thanks" doesn't reach REJECT
  for (const seq of SOCIAL_ACK_PATTERNS) {
    if (startsWithSequence(t, seq)) {
      return {
        form: "SOCIAL",
        answer_polarity: "NONE",
        confidence: "HIGH",
        reason: `social_ack_pattern:${seq.join("_")}`,
      };
    }
  }
  if (t.length <= 3 && SOCIAL_ACK_SHORTS.has(t[0])) {
    // Distinguish "thanks" (SOCIAL) from "thanks nex" (still SOCIAL).
    // "terima" alone might be part of "terima kasih" · both social.
    return {
      form: "SOCIAL",
      answer_polarity: "NONE",
      confidence: "HIGH",
      reason: `social_short:${t[0]}`,
    };
  }

  // 2 · QUALIFIED · "yes but ..." · "no but ..." · "iya tapi ..."
  const firstIsAffirm = AFFIRM_SHORTS.has(t[0]);
  const firstIsReject = REJECT_SHORTS.has(t[0]);
  if ((firstIsAffirm || firstIsReject) && t.length >= 3) {
    const butIdx = t.indexOf("but");
    const tapiIdx = t.indexOf("tapi");
    const idx = butIdx > 0 ? butIdx : tapiIdx > 0 ? tapiIdx : -1;
    if (idx > 0 && idx < t.length - 1) {
      return {
        form: "QUALIFIED",
        answer_polarity: firstIsAffirm ? "AFFIRM" : "REJECT",
        qualifier_text: t.slice(idx + 1).join(" "),
        confidence: "HIGH",
        reason: `qualified:${t[0]}_but:${t.slice(idx + 1).slice(0, 3).join("_")}`,
      };
    }
  }

  // 3 · CORRECTIVE · "no, restaurant" · "no, X" · "yes, restaurant"
  // Pattern: {no|yes|actually} followed by a content-noun (not another marker word).
  if (CORRECTIVE_HEADS.has(t[0]) && t.length >= 2) {
    const next = t[1];
    if (
      next
      && !AFFIRM_SHORTS.has(next)
      && !REJECT_SHORTS.has(next)
      && !SOCIAL_ACK_SHORTS.has(next)
      && next.length > 2
      && !UNCERTAIN_MARKERS.has(next)
      && next !== "but" && next !== "tapi"
      && next !== "thanks" && next !== "thank"
      && next !== "please"
    ) {
      // Also skip "actually no" · "actually not" · "no thanks" (handled above)
      if (t[0] === "actually" && (next === "no" || next === "not")) {
        // fall through to REJECT below
      } else {
        return {
          form: "CORRECTIVE",
          answer_polarity: (t[0] === "no" || t[0] === "actually" || t[0] === "tidak") ? "REJECT" : "AFFIRM",
          corrective_target: next,
          confidence: "MEDIUM",
          reason: `corrective_head:${t[0]}:${next}`,
        };
      }
    }
  }

  // 4 · UNCERTAIN patterns / markers
  for (const seq of UNCERTAIN_PATTERNS) {
    if (matchSequenceAnywhere(t, seq)) {
      return {
        form: "UNCERTAIN",
        answer_polarity: "UNCERTAIN",
        confidence: "HIGH",
        reason: `uncertain_pattern:${seq.join("_")}`,
      };
    }
  }
  if (t.length <= 2 && UNCERTAIN_MARKERS.has(t[0])) {
    return { form: "UNCERTAIN", answer_polarity: "UNCERTAIN", confidence: "MEDIUM", reason: `uncertain_short:${t[0]}` };
  }

  // 5 · Multi-token AFFIRM / REJECT patterns
  for (const seq of AFFIRM_PATTERNS) {
    if (startsWithSequence(t, seq)) {
      return { form: "AFFIRM", answer_polarity: "AFFIRM", confidence: "HIGH", reason: `affirm_pattern:${seq.join("_")}` };
    }
  }
  for (const seq of REJECT_PATTERNS) {
    if (startsWithSequence(t, seq) || matchSequenceAnywhere(t, seq)) {
      return { form: "REJECT", answer_polarity: "REJECT", confidence: "HIGH", reason: `reject_pattern:${seq.join("_")}` };
    }
  }

  // 6 · Short-form AFFIRM / REJECT — must be a short standalone message
  if (t.length <= 2 && AFFIRM_SHORTS.has(t[0])) {
    return { form: "AFFIRM", answer_polarity: "AFFIRM", confidence: "HIGH", reason: `affirm_short:${t[0]}` };
  }
  if (t.length <= 2 && REJECT_SHORTS.has(t[0])) {
    return { form: "REJECT", answer_polarity: "REJECT", confidence: "HIGH", reason: `reject_short:${t[0]}` };
  }

  // 7 · Longer AFFIRM opener followed by natural fill · "yes, that one"
  if (t.length <= 5 && (t[0] === "yes" || t[0] === "yeah" || t[0] === "iya" || t[0] === "ya")) {
    return { form: "AFFIRM", answer_polarity: "AFFIRM", confidence: "MEDIUM", reason: `affirm_opener:${t[0]}` };
  }
  if (t.length <= 5 && (t[0] === "no" || t[0] === "nope" || t[0] === "tidak" || t[0] === "nggak")) {
    return { form: "REJECT", answer_polarity: "REJECT", confidence: "MEDIUM", reason: `reject_opener:${t[0]}` };
  }

  return { form: "NONE", answer_polarity: "NONE", confidence: "HIGH", reason: "no_pattern_matched" };
}

// ─── Active-proposition extraction ──────────────────────────────
//
// Consumes session.lastNexQuestion when set, otherwise inspects the
// most recent NEX turn in session.dialogueTurns. Categorises the
// proposition by pattern-shape.

const OFFER_PATTERNS: RegExp[] = [
  /\b(?:want|would you like|should i|shall i|do you want) (?:me )?to\s+(\w+)/i,
  /\bwant me to\s+(\w+)/i,
  /\b(?:want|do you want)\s+(?:me\s+)?to\s+(\w+)/i,
];

const CLARIFICATION_PATTERNS: RegExp[] = [
  /\b(?:do you|did you) mean\b/i,
  /\bis that (?:the one|correct|right)\b/i,
  /\bwhich (?:one|hotel|restaurant|place)\b/i,
  /\bapakah maksud (?:anda|kamu)\b/i,
  /\bmaksud (?:anda|kamu)\b/i,
];

const CORRECTION_CHECK_PATTERNS: RegExp[] = [
  /\bdid you mean\b/i,
  /\bwere you looking for\b/i,
  /\byou wanted\b.*\binstead\b/i,
];

const NEGATED_QUESTION_MARKERS = /\b(?:dont|doesnt|didnt|wouldnt|wasnt|arent|isnt|cant|jangan|bukan|tidak)\b/i;

export function extractActiveProposition(session: SessionState | null | undefined): ActiveProposition {
  if (!session) return { kind: "NONE", text: "", polarity_hint: "positive" };
  // Prefer session.lastNexQuestion if set (Stage 3.42 tracks this)
  let text = session.lastNexQuestion ?? "";
  if (!text) {
    // Fall back to last NEX turn in dialogueTurns
    const turns = session.dialogueTurns ?? [];
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === "nex") { text = turns[i].text; break; }
    }
  }
  if (!text) return { kind: "NONE", text: "", polarity_hint: "positive" };

  // Only qualifies as active proposition if it CONTAINS a question ("?")
  // OR one of the OFFER/CLARIFICATION patterns.
  const hasQ = text.includes("?");
  const hasOfferPat = OFFER_PATTERNS.some((rx) => rx.test(text));
  const hasClarifyPat = CLARIFICATION_PATTERNS.some((rx) => rx.test(text));
  const hasCorrectionCheckPat = CORRECTION_CHECK_PATTERNS.some((rx) => rx.test(text));
  if (!hasQ && !hasOfferPat && !hasClarifyPat && !hasCorrectionCheckPat) {
    return { kind: "NONE", text, polarity_hint: "positive" };
  }

  // Normalize apostrophes so "Don't" matches `\bdont\b` per the regex set.
  const normalized = text.replace(/[’']/g, "");
  const polarity_hint = NEGATED_QUESTION_MARKERS.test(normalized) ? "negative" : "positive";
  let kind: PropositionKind;
  if (hasCorrectionCheckPat) kind = "CORRECTION_CHECK";
  else if (hasClarifyPat) kind = "CLARIFICATION";
  else if (hasOfferPat) kind = "OFFER";
  else if (hasQ) kind = "PROPOSITION";
  else kind = "NONE";

  return { kind, text: text.slice(0, 400), polarity_hint };
}

// ─── Resolution ─────────────────────────────────────────────────

export function resolveConfirmation(
  detection: ConfirmationDetection,
  active: ActiveProposition,
): ConfirmationResolution {
  // SOCIAL never triggers action-oriented resolution.
  if (detection.form === "SOCIAL") {
    return {
      detection,
      active_proposition: active.kind === "NONE" ? null : active,
      resolution: "SOCIAL",
      effective_polarity: "NONE",
      frame_transition: "SOCIAL",
    };
  }
  if (detection.form === "NONE") {
    return {
      detection,
      active_proposition: active.kind === "NONE" ? null : active,
      resolution: "NO_TARGET",
      effective_polarity: "NONE",
      frame_transition: "STAY",
    };
  }
  // Confirmation form detected · check for target
  if (active.kind === "NONE") {
    return {
      detection,
      active_proposition: null,
      resolution: "NO_TARGET",
      effective_polarity: detection.answer_polarity === "NONE" ? "AMBIGUOUS" : detection.answer_polarity,
      ambiguity_reason: "no_active_proposition_in_session",
      frame_transition: "CLARIFY",
    };
  }
  // CORRECTIVE has its own resolution
  if (detection.form === "CORRECTIVE") {
    return {
      detection,
      active_proposition: active,
      resolution: "CORRECTIVE",
      effective_polarity: detection.answer_polarity,
      frame_transition: "REJECT",
    };
  }
  // UNCERTAIN
  if (detection.form === "UNCERTAIN") {
    return {
      detection,
      active_proposition: active,
      resolution: "UNCERTAIN",
      effective_polarity: "UNCERTAIN",
      frame_transition: "CLARIFY",
    };
  }
  // QUALIFIED — treat as confirmed with a qualifier (composer will
  // handle the qualifier text downstream).
  if (detection.form === "QUALIFIED") {
    return {
      detection,
      active_proposition: active,
      resolution: detection.answer_polarity === "AFFIRM" ? "CONFIRMED" : "REJECTED",
      effective_polarity: detection.answer_polarity,
      frame_transition: detection.answer_polarity === "AFFIRM" ? "EXECUTE" : "REJECT",
    };
  }
  // AFFIRM / REJECT — resolve. §15: answer polarity is separate from
  // proposition polarity. For a negated question ("Don't you want a
  // hotel?" + "yes"), we return the answer polarity as-is but mark
  // AMBIGUOUS in effective_polarity because English convention is
  // notoriously unreliable here.
  if (active.polarity_hint === "negative"
      && (detection.form === "AFFIRM" || detection.form === "REJECT")) {
    return {
      detection,
      active_proposition: active,
      resolution: "AMBIGUOUS",
      effective_polarity: "AMBIGUOUS",
      ambiguity_reason: "answer_polarity_ambiguous_on_negated_question",
      frame_transition: "CLARIFY",
    };
  }
  const isAffirm = detection.form === "AFFIRM";
  return {
    detection,
    active_proposition: active,
    resolution: isAffirm ? "CONFIRMED" : "REJECTED",
    effective_polarity: isAffirm ? "AFFIRM" : "REJECT",
    frame_transition: isAffirm ? "EXECUTE" : "REJECT",
  };
}

// ─── Gate decision (deterministic reply · never fabricates) ─────

export type ConfirmationGateDecision =
  | { shouldGate: false; reason: string; detection: ConfirmationDetection; resolution?: ConfirmationResolution }
  | {
      shouldGate: true;
      reason: string;
      detection: ConfirmationDetection;
      resolution: ConfirmationResolution;
      reply: string;
      language: Lang;
    };

export function decideConfirmationGate(input: {
  userMessage: string;
  session: SessionState | null | undefined;
  activeLanguage: Lang;
}): ConfirmationGateDecision {
  const detection = classifyConfirmationForm(input.userMessage);
  const active = extractActiveProposition(input.session);
  const resolution = resolveConfirmation(detection, active);

  // Gate fires ONLY when the resolution needs a deterministic reply:
  //   · NO_TARGET (standalone yes/no on fresh conv or no pending Q)
  //   · AMBIGUOUS (negated question + AFFIRM/REJECT)
  //   · CORRECTIVE (yes/no + alternative target · needs acknowledgement)
  //   · UNCERTAIN (need to clarify what the user is unsure about)
  //   · SOCIAL when it would otherwise trigger a search — emit brief
  //     natural ack that doesn't cancel or launch anything.
  //
  // Gate does NOT fire on:
  //   · CONFIRMED / REJECTED against a clear proposition — downstream
  //     composition can handle it via context (LLM sees the prior NEX
  //     question and the user's yes/no).
  //   · NONE detection — the message isn't a confirmation.

  const lang = input.activeLanguage;
  if (detection.form === "NONE") {
    return { shouldGate: false, reason: "not_confirmation", detection };
  }

  if (resolution.resolution === "NO_TARGET" && detection.form !== "SOCIAL") {
    return {
      shouldGate: true,
      reason: "no_target_clarify",
      detection,
      resolution,
      reply: replyNoTarget(lang, detection),
      language: lang,
    };
  }

  if (resolution.resolution === "AMBIGUOUS") {
    return {
      shouldGate: true,
      reason: `ambiguous:${resolution.ambiguity_reason ?? "unknown"}`,
      detection,
      resolution,
      reply: replyAmbiguousNegatedQuestion(lang),
      language: lang,
    };
  }

  if (resolution.resolution === "UNCERTAIN") {
    return {
      shouldGate: true,
      reason: "uncertain_clarify",
      detection,
      resolution,
      reply: replyUncertain(lang),
      language: lang,
    };
  }

  if (resolution.resolution === "CORRECTIVE" && detection.corrective_target) {
    return {
      shouldGate: true,
      reason: `corrective:${detection.corrective_target}`,
      detection,
      resolution,
      reply: replyCorrective(lang, detection.corrective_target),
      language: lang,
    };
  }

  if (resolution.resolution === "SOCIAL") {
    // Social ack must never trigger stale-task inheritance. Emit a
    // deterministic brief ack that keeps context but doesn't act.
    return {
      shouldGate: true,
      reason: "social_ack",
      detection,
      resolution,
      reply: replySocialAck(lang, input.userMessage),
      language: lang,
    };
  }

  // Clean CONFIRMED / REJECTED against a clear proposition — do NOT
  // gate here. Composition path (LLM · with prior NEX Q in context)
  // will handle. Observability captured on the caller side.
  return {
    shouldGate: false,
    reason: `resolved:${resolution.resolution}`,
    detection,
    resolution,
  };
}

// ─── Deterministic replies (voice-safe · never fabricate) ───────

function replyNoTarget(lang: Lang, d: ConfirmationDetection): string {
  const isAffirm = d.answer_polarity === "AFFIRM";
  const isReject = d.answer_polarity === "REJECT";
  if (lang === "ID") {
    if (isAffirm) return "Baik — apa yang Anda ingin saya bantu?";
    if (isReject) return "Baik, tidak masalah. Ada yang bisa saya bantu?";
    return "Baik — apa yang Anda maksud?";
  }
  if (isAffirm) return "Sure — what would you like me to help with?";
  if (isReject) return "Okay, no problem. What would you like to do instead?";
  return "Okay — could you tell me a bit more?";
}

function replyAmbiguousNegatedQuestion(lang: Lang): string {
  if (lang === "ID") {
    return "Maaf, saya ingin memastikan — apakah Anda mau atau tidak?";
  }
  return "Just to be sure — is that a yes or a no?";
}

function replyUncertain(lang: Lang): string {
  if (lang === "ID") {
    return "Baik — jika Anda ingin, beri tahu saya. Kalau tidak, saya bisa bantu yang lain.";
  }
  return "Okay — let me know either way, or I can help with something else.";
}

function replyCorrective(lang: Lang, target: string): string {
  if (lang === "ID") {
    return `Baik, ${target} — apa yang Anda ingin ketahui?`;
  }
  return `Got it — ${target}. What would you like to know?`;
}

function replySocialAck(lang: Lang, _message: string): string {
  if (lang === "ID") return "Sama-sama!";
  return "You're welcome!";
}
