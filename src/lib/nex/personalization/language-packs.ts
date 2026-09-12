// src/lib/nex/personalization/language-packs.ts
//
// Founder Phase 19 · P19-1 · Language pack registry.
//
// Extends the deterministic composer's canonical string table to 10
// languages · fallback ladder: exact match → base language (fr_FR → fr)
// → EN default. Every string is a template with {slot} placeholders that
// the composer fills · never LLM-generated per turn.
//
// Discipline:
//   · pure data · no I/O · deterministic
//   · unknown key never fabricates · always falls back
//   · every pack has the same key surface so lookups can't silently miss

export type LanguageCode = "en" | "id" | "fr" | "es" | "de" | "ja" | "zh" | "pt" | "it" | "ar";

export interface LanguagePack {
  code: LanguageCode;
  name_native: string;                              // display name in own language
  greeting: string;
  unknown_gap: string;                              // shown when NEX has no verified answer
  clarify: string;                                  // shown when NEX needs disambiguation
  trust_prefix_verified: string;
  trust_prefix_provisional: string;
  citation_required: string;
}

const _packs: Record<LanguageCode, LanguagePack> = {
  en: {
    code: "en", name_native: "English",
    greeting: "Hi! What can I help you with?",
    unknown_gap: "I don't have verified information on that yet.",
    clarify: "Which one did you mean?",
    trust_prefix_verified: "Based on what we have on record:",
    trust_prefix_provisional: "Based on preliminary information:",
    citation_required: "Every fact traces to evidence I can show you.",
  },
  id: {
    code: "id", name_native: "Bahasa Indonesia",
    greeting: "Halo! Ada yang bisa saya bantu?",
    unknown_gap: "Saya belum punya informasi terverifikasi untuk itu.",
    clarify: "Yang mana yang Anda maksud?",
    trust_prefix_verified: "Berdasarkan catatan yang kami miliki:",
    trust_prefix_provisional: "Berdasarkan informasi awal:",
    citation_required: "Setiap fakta bisa saya tunjukkan sumbernya.",
  },
  fr: {
    code: "fr", name_native: "Français",
    greeting: "Bonjour ! Comment puis-je vous aider ?",
    unknown_gap: "Je n'ai pas encore d'information vérifiée à ce sujet.",
    clarify: "Lequel voulez-vous dire ?",
    trust_prefix_verified: "D'après nos données :",
    trust_prefix_provisional: "D'après des informations préliminaires :",
    citation_required: "Chaque affirmation renvoie à une preuve consultable.",
  },
  es: {
    code: "es", name_native: "Español",
    greeting: "¡Hola! ¿En qué puedo ayudarte?",
    unknown_gap: "Aún no tengo información verificada sobre eso.",
    clarify: "¿Cuál te refieres?",
    trust_prefix_verified: "Según nuestros registros:",
    trust_prefix_provisional: "Según información preliminar:",
    citation_required: "Cada dato tiene una prueba que puedo mostrarte.",
  },
  de: {
    code: "de", name_native: "Deutsch",
    greeting: "Hallo! Wie kann ich helfen?",
    unknown_gap: "Dazu habe ich noch keine verifizierten Informationen.",
    clarify: "Welchen meinen Sie?",
    trust_prefix_verified: "Laut unseren Unterlagen:",
    trust_prefix_provisional: "Basierend auf vorläufigen Informationen:",
    citation_required: "Jede Aussage lässt sich mit einer Quelle belegen.",
  },
  ja: {
    code: "ja", name_native: "日本語",
    greeting: "こんにちは。ご用件を伺います。",
    unknown_gap: "その件について、まだ確認済みの情報がありません。",
    clarify: "どれをご指定でしょうか?",
    trust_prefix_verified: "確認済みの情報によりますと:",
    trust_prefix_provisional: "暫定情報によりますと:",
    citation_required: "すべての情報には出典を示せます。",
  },
  zh: {
    code: "zh", name_native: "中文",
    greeting: "您好,请问有什么可以帮您?",
    unknown_gap: "关于这个问题,我暂时没有已核实的信息。",
    clarify: "您指的是哪一个?",
    trust_prefix_verified: "根据我们的记录:",
    trust_prefix_provisional: "根据初步信息:",
    citation_required: "每一条事实我都可以出示来源。",
  },
  pt: {
    code: "pt", name_native: "Português",
    greeting: "Olá! Como posso ajudar?",
    unknown_gap: "Ainda não tenho informação verificada sobre isso.",
    clarify: "Qual você quis dizer?",
    trust_prefix_verified: "Com base no que temos registrado:",
    trust_prefix_provisional: "Com base em informações preliminares:",
    citation_required: "Cada fato tem uma fonte que posso mostrar.",
  },
  it: {
    code: "it", name_native: "Italiano",
    greeting: "Ciao! Come posso aiutare?",
    unknown_gap: "Non ho ancora informazioni verificate su questo.",
    clarify: "A quale ti riferisci?",
    trust_prefix_verified: "In base ai nostri dati:",
    trust_prefix_provisional: "In base a informazioni preliminari:",
    citation_required: "Ogni fatto rimanda a una fonte consultabile.",
  },
  ar: {
    code: "ar", name_native: "العربية",
    greeting: "مرحباً، كيف يمكنني مساعدتك؟",
    unknown_gap: "ليس لديّ معلومات موثّقة بشأن ذلك بعد.",
    clarify: "أيهما تقصد؟",
    trust_prefix_verified: "استناداً إلى ما لدينا:",
    trust_prefix_provisional: "استناداً إلى معلومات أوّلية:",
    citation_required: "كل معلومة يمكن إسنادها إلى مصدر.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

export function listLanguagePacks(): LanguagePack[] {
  return Object.values(_packs).sort((a, b) => a.code.localeCompare(b.code));
}

export function getLanguagePack(input: string | null | undefined): LanguagePack {
  if (!input) return _packs.en;
  const lc = input.toLowerCase().trim();
  const exact = _packs[lc as LanguageCode];
  if (exact) return exact;
  const base = lc.split(/[-_]/)[0] as LanguageCode;
  if (_packs[base]) return _packs[base];
  return _packs.en;
}

export function isKnownLanguage(code: string): boolean {
  const lc = code.toLowerCase().trim();
  return !!_packs[lc as LanguageCode] || !!_packs[lc.split(/[-_]/)[0] as LanguageCode];
}
