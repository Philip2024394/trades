// src/lib/nex/agents/nex-speaking/respond.ts
//
// NEX Speaking Intelligence Engineer · Phase 3 · deterministic responder
// Philip 2026-09-07 · AUTHORIZE Phase 3
//
// Given a SpeakingRequest, compose a deterministic response that honors
// every safety doctrine. No LLM inference · no third-party call · no
// image processing · pure text.
//
// This is the MINIMUM VIABLE specialist for W5-2 GREEN. Language teaching,
// pronunciation, translation-quality benchmarks, voice interaction all
// come after specialist-runtime + Master-AI-observation are proven here.

import type {
  SpeakingRequest,
  SpeakingResponse,
  SpeakingLanguage,
  SpeakingRegister,
  SafetySignal,
} from "./types";
import {
  detectLanguage,
  detectSafetySignal,
  selectRegister,
  humorGateBlocked,
  crisisLinesForCountry,
  detectSpellingSuggestions,
} from "./safety-gate";

// ─── Localized response fragments (per language) ─────────────────

const GREETINGS: Record<SpeakingLanguage, string> = {
  en: "Hello.",
  id: "Halo.",
  ja: "こんにちは。",
  unknown: "Hello.",
};

const OFFER_TO_LISTEN: Record<SpeakingLanguage, string> = {
  en: "I'm here. I can stay with you for as long as you'd like to talk.",
  id: "Saya di sini. Saya bisa tetap menemani Anda selama Anda ingin berbicara.",
  ja: "私はここにいます。話したい間、いつでも一緒にいます。",
  unknown: "I'm here. I can stay with you for as long as you'd like to talk.",
};

const ACKNOWLEDGE_WITHOUT_JUDGEMENT: Record<SpeakingLanguage, string> = {
  en: "Thank you for telling me. That sounds incredibly heavy. I hear you.",
  id: "Terima kasih sudah memberitahu saya. Itu terdengar sangat berat. Saya mendengar Anda.",
  ja: "話してくれてありがとうございます。とてもつらそうですね。ちゃんと聞いています。",
  unknown: "Thank you for telling me. That sounds incredibly heavy. I hear you.",
};

const MEDICAL_DISCLAIMER: Record<SpeakingLanguage, string> = {
  en: "I am not a doctor. Please see a licensed medical professional for this.",
  id: "Saya bukan dokter. Untuk hal ini, mohon konsultasi dengan tenaga medis berlisensi.",
  ja: "私は医師ではありません。医療専門家にご相談ください。",
  unknown: "I am not a doctor. Please see a licensed medical professional for this.",
};

const LEGAL_DISCLAIMER: Record<SpeakingLanguage, string> = {
  en: "I am not qualified to give legal advice. Please consult a licensed attorney in your jurisdiction.",
  id: "Saya tidak berwenang memberikan nasihat hukum. Mohon konsultasi dengan pengacara berlisensi di wilayah Anda.",
  ja: "私は法律の専門家ではありません。管轄の弁護士にご相談ください。",
  unknown: "I am not qualified to give legal advice. Please consult a licensed attorney in your jurisdiction.",
};

const NEUTRAL_ACK: Record<SpeakingLanguage, string> = {
  en: "Thanks for the message.",
  id: "Terima kasih atas pesan Anda.",
  ja: "メッセージをありがとうございます。",
  unknown: "Thanks for the message.",
};

// ─── Composer ────────────────────────────────────────────────────

/** Deterministically compose a response. Order of composition matters:
 *   1. Safety signal detection is ALWAYS first
 *   2. Life-safety response is warmth-first · never phone-first
 *   3. Domain disclaimers are attached when relevant
 *   4. Humor gate blocks jokes in serious contexts
 *   5. Spelling suggestions are silent in distressed contexts */
export function respond(req: SpeakingRequest): SpeakingResponse {
  const trace: string[] = [];
  trace.push(`request_id=${req.request_id}`);

  const ctx = req.user_context;
  const detected_language = detectLanguage(ctx.message, ctx.known_language);
  trace.push(`language detected: ${detected_language}`);

  const safety_signal = detectSafetySignal(ctx);
  trace.push(`safety signal: ${safety_signal}`);

  const register = selectRegister(safety_signal, ctx);
  trace.push(`register selected: ${register}`);

  const humor_blocked = humorGateBlocked(safety_signal, ctx);
  trace.push(`humor gate: ${humor_blocked ? "silent" : "allowed"}`);

  const spelling_suggestions = detectSpellingSuggestions(ctx.message, detected_language, safety_signal, ctx);
  trace.push(`spelling suggestions: ${spelling_suggestions.length}`);

  const disclaimers_included: string[] = [];
  const crisis_lines_offered: string[] = [];

  const parts: string[] = [];

  // ─── Life-safety response: warmth-first · then offer-to-listen · then crisis line
  if (safety_signal === "life_safety") {
    parts.push(ACKNOWLEDGE_WITHOUT_JUDGEMENT[detected_language]);
    parts.push(OFFER_TO_LISTEN[detected_language]);
    disclaimers_included.push("life_safety_warmth_first");
    const lines = crisisLinesForCountry(ctx.known_country, detected_language);
    crisis_lines_offered.push(...lines);
    parts.push(
      detected_language === "id" ? `Jika Anda ingin berbicara dengan seseorang saat ini: ${lines.join(" · ")}` :
      detected_language === "ja" ? `もし今すぐ誰かと話したい場合: ${lines.join(" · ")}` :
      `If you'd like to speak with someone right now: ${lines.join(" · ")}`
    );
    // never-humor · never-method-details · offer to stay
    trace.push("life-safety response composed · warmth first · crisis line offered · offer-to-stay preserved");
  } else {
    // Normal path · plain acknowledgement seeded by register
    parts.push(register === "distressed" ? ACKNOWLEDGE_WITHOUT_JUDGEMENT[detected_language] : NEUTRAL_ACK[detected_language]);

    if (safety_signal === "medical_personal" || ctx.has_stated_medical_condition) {
      parts.push(MEDICAL_DISCLAIMER[detected_language]);
      disclaimers_included.push("medical");
    }
    if (safety_signal === "legal_personal" || ctx.has_stated_legal_situation) {
      parts.push(LEGAL_DISCLAIMER[detected_language]);
      disclaimers_included.push("legal");
    }
    if (safety_signal === "bereavement") {
      disclaimers_included.push("bereavement_warmth_first");
    }
    if (safety_signal === "financial_distress") {
      disclaimers_included.push("financial_distress_warmth_first");
    }
    if (safety_signal === "abuse_context") {
      disclaimers_included.push("abuse_context_warmth_first");
    }
  }

  // Spelling suggestions (only when safety_signal === "none")
  if (spelling_suggestions.length > 0) {
    const suggestionText = spelling_suggestions.map((s) => {
      if (detected_language === "id") return `Maksud Anda "${s.suggested}"?`;
      if (detected_language === "ja") return `もしかして「${s.suggested}」ですか?`;
      return `Did you mean "${s.suggested}"?`;
    }).join(" ");
    parts.push(suggestionText);
    trace.push("spelling suggestions rendered as questions (never assertions · user preserves agency)");
  }

  const response_text = parts.join(" ");

  return {
    request_id: req.request_id,
    detected_language,
    register,
    safety_signal,
    disclaimers_included,
    humor_gate_result: humor_blocked ? "silent" : "allowed",
    spelling_suggestions,
    crisis_lines_offered,
    response_text,
    reasoning_trace: trace,
    response_timestamp: req.timestamp ?? new Date().toISOString(),
  };
}
