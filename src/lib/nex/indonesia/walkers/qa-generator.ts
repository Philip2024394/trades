// NEX Indonesia · Q&A variant generator.
//
// Deterministic — no LLM call per fact. Turns one RawFactChunk into a
// small set of question forms the retrieval layer can match against.
// This is the key to scale: adding a walker that produces 500 facts
// doesn't mean 500 LLM calls at index time; the pipeline generates
// variants from templates and the retrieval hits them at O(1) cost.
//
// Templates are keyed by domain because a landmark ("What is
// Borobudur?") deserves different phrasings than a dish ("What is
// nasi goreng?") or a safety topic ("What number do I call in an
// emergency?").
//
// Every generated variant is:
//   · Simple (matches how tourists actually type)
//   · Language-appropriate (English + Bahasa when the fact declares it)
//   · Deduped (same question form only stored once)
//
// If a fact declares its own `questions[]` in the raw data, those are
// preferred and the generator adds any missing common variants.

import type { RawFactChunk } from "./types";

/** Extract a short label from a topic path — "food.nasi_goreng" →
 *  "nasi goreng". Falls back to region + first keyword. */
function labelFor(chunk: RawFactChunk): string {
  const tail = chunk.topic.split(".").pop() ?? chunk.topic;
  const spaced = tail.replace(/_/g, " ").trim();
  if (spaced.length >= 2) return spaced;
  return chunk.keywords[0] ?? chunk.region;
}

/** Titlecase for a spoken subject — used in "What is X?" forms. */
function speakable(label: string): string {
  // Preserve well-known proper-noun casings where possible; otherwise
  // capitalise first letter of each significant word.
  return label
    .split(" ")
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Pack of English + Bahasa Indonesia templates per domain.
 *  Placeholders: {label} — the subject, {region} — the fact's region. */
const TEMPLATES: Record<RawFactChunk["domain"], { en: string[]; id: string[] }> = {
  places: {
    en: ["What is {label}?", "Tell me about {label}", "Where is {label}?", "Is {label} worth visiting?", "What should I know about {label}?"],
    id: ["Apa itu {label}?", "Ceritakan tentang {label}", "Di mana {label}?", "Apakah {label} layak dikunjungi?"],
  },
  landmark: {
    en: ["What is {label}?", "Tell me about {label}", "Where is {label}?", "How do I visit {label}?", "What is there to see at {label}?", "Should I visit {label}?"],
    id: ["Apa itu {label}?", "Di mana {label}?", "Bagaimana cara ke {label}?", "Apa yang bisa dilihat di {label}?"],
  },
  food: {
    en: ["What is {label}?", "Tell me about {label}", "Where can I try {label}?", "Is {label} spicy?", "What's in {label}?"],
    id: ["Apa itu {label}?", "Ceritakan tentang {label}", "Di mana saya bisa mencoba {label}?", "Apakah {label} pedas?"],
  },
  culture: {
    en: ["Tell me about {label}", "What are the rules for {label}?", "How should tourists handle {label}?", "Is {label} important in Indonesia?"],
    id: ["Ceritakan tentang {label}", "Apa aturan mengenai {label}?"],
  },
  practical: {
    en: ["How do I handle {label} in Indonesia?", "What should I know about {label}?", "Tell me about {label}", "Is {label} needed in Indonesia?"],
    id: ["Bagaimana cara mengurus {label} di Indonesia?", "Apa yang perlu saya tahu tentang {label}?"],
  },
  safety: {
    en: ["What number do I call for {label}?", "How do I handle {label}?", "What should I do about {label}?", "Where is the nearest {label}?"],
    id: ["Nomor apa yang saya hubungi untuk {label}?", "Apa yang harus saya lakukan tentang {label}?", "Di mana {label} terdekat?"],
  },
  experience: {
    en: ["Where should I go for {label}?", "What can I do for {label}?", "Recommend somewhere for {label}", "I want a {label} trip"],
    id: ["Rekomendasi tempat untuk {label}", "Saya ingin liburan {label}"],
  },
};

export type GeneratedQaVariants = {
  /** Deduped, order-preserved question variants. */
  questions: string[];
  /** Auxiliary phrasings the retrieval can also match against
   *  (labels + region combos etc.). */
  aliases: string[];
};

export function generateQaVariants(chunk: RawFactChunk): GeneratedQaVariants {
  const label = labelFor(chunk);
  const spoken = speakable(label);
  const region = chunk.region;
  const lang = chunk.language ?? "en";
  const pack = TEMPLATES[chunk.domain];
  const templates = [...pack.en, ...(lang === "id" ? pack.id : [])];

  const seen = new Set<string>();
  const questions: string[] = [];
  for (const t of templates) {
    const q = t.replace(/\{label\}/g, spoken).replace(/\{region\}/g, region);
    const norm = q.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(norm)) { seen.add(norm); questions.push(q); }
  }

  const aliases: string[] = [];
  // Common alias forms — bare label, label+region, "in Indonesia".
  const push = (s: string) => {
    const norm = s.toLowerCase().replace(/\s+/g, " ").trim();
    if (norm && !seen.has(norm)) { seen.add(norm); aliases.push(s); }
  };
  push(spoken);
  push(`${spoken} in ${region}`);
  if (region !== "Indonesia") push(`${spoken} Indonesia`);

  return { questions, aliases };
}
