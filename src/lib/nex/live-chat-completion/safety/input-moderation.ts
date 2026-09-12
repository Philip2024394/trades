// src/lib/nex/live-chat-completion/safety/input-moderation.ts
//
// Founder BEGIN Phase 3.7 · Input moderation (deterministic patterns).
//
// Detects and refuses:
//   1. Prompt injection / jailbreak attempts
//        - "ignore previous instructions"
//        - "system:" / "system prompt"
//        - "you are now DAN / a different AI"
//        - "output your instructions"
//   2. Overt attacks on the platform (only the most obvious patterns · a
//      broader classifier is a future BEGIN with a proper toxicity model).
//
// NOT covered here (each own future BEGIN when the founder decides policy):
//   - Sophisticated multi-turn jailbreak
//   - Language-specific jailbreak
//   - Harmful-topic classification (weapons/self-harm etc.)
//   - Toxicity ML classifier
//
// Deterministic. Zero LLM. Sub-ms.

import type { InputGuardrail, InputGuardrailVerdict, InputTurn } from "./guardrails";

// Case-insensitive substring matches. Kept tight to minimise false positives.
// Founder 2026-09-10 · security audit added:
//   · Indonesian jailbreak patterns (NEX serves ID market — must catch native)
//   · Japanese jailbreak patterns (regional expansion protection)
//   · Unicode NFKD normalisation to defeat homoglyph bypass
const JAILBREAK_PATTERNS: readonly RegExp[] = Object.freeze([
  // English
  /\bignore (all |the |your )?(previous|prior|above|earlier) (instructions|rules|prompt|directives)\b/i,
  /\bdisregard (all |the |your )?(previous|prior|above) (instructions|rules|prompt)\b/i,
  /\byou are (now )?(dan|a different ai|not (an? )?ai|jailbroken)\b/i,
  /\boutput (your |the )?(system )?(prompt|instructions|rules)\b/i,
  /\bshow me your (system )?(prompt|instructions)\b/i,
  /\breveal (your |the )?(system )?(prompt|instructions)\b/i,
  /\bprint (your |the )?(system )?(prompt|instructions)\b/i,
  /\brepeat (your |the )?(system )?(prompt|instructions)\b/i,
  /\bpretend (you are|to be) (?!my |a customer|a guest|a friend)(a )?(different|another|unfiltered|uncensored)/i,
  /<\|.*?(system|assistant|user).*?\|>/i,
  /\[\s*system\s*\]/i,
  /### (system|instruction|prompt)/i,
  // Bahasa Indonesia
  /\babaikan (semua |semua yang |)?(instruksi|perintah|aturan|arahan|petunjuk)( sebelumnya| di atas)?/i,
  /\btolong (abaikan|lupakan) (instruksi|perintah|aturan|arahan)/i,
  /\btampilkan (instruksi|prompt|aturan|sistem)/i,
  /\btunjukkan (prompt|instruksi) (sistem|kamu|anda)/i,
  /\bkamu (sekarang|adalah) (ai lain|dan|tidak ada aturan)/i,
  /\bpura-pura (jadi|menjadi) (ai lain|berbeda)/i,
  // Japanese
  /\bシステムプロンプト(を|は)?(出力|表示|教えて|見せて)/,
  /\b(前の|以前の|以上の)(指示|ルール|プロンプト).{0,10}(無視|削除|忘れ)/,
  /\bあなたは(今|)?DAN/i,
]);

/**
 * Normalise input to defeat homoglyph bypass. Unicode NFKD decomposes
 * lookalike characters (Greek alpha α → Latin a), then strip diacritics.
 * Zero-width joiners + BOMs are also stripped.
 */
function normaliseInput(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")   // combining diacritics
    .replace(/[​-‏﻿]/g, ""); // zero-width + BOM
}

const HONEST_REFUSAL_EN =
  "I'm here to help with hotels, food, transport, and other things I actually know about. Ask me something in that space and I'll do my best.";
const HONEST_REFUSAL_ID =
  "Saya di sini untuk membantu soal hotel, kuliner, transport, dan hal-hal yang saya pahami. Coba tanyakan sesuatu dalam ranah itu.";

export function makeInputModerationGuardrail(): InputGuardrail {
  return {
    name: "input_moderation",
    evaluate(turn: InputTurn): InputGuardrailVerdict {
      const msg = String(turn.message ?? "");
      if (msg.length === 0) return { allow: true };
      const normalised = normaliseInput(msg);
      for (const pattern of JAILBREAK_PATTERNS) {
        if (pattern.test(normalised) || pattern.test(msg)) {
          return {
            allow: false,
            reason: `jailbreak_pattern_matched · ${pattern.source.slice(0, 40)}`,
            block_reply: turn.language === "id" ? HONEST_REFUSAL_ID : HONEST_REFUSAL_EN,
            category: "jailbreak",
          };
        }
      }
      return { allow: true };
    },
  };
}
