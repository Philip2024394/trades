// src/lib/nex/live-chat-completion/question-factory/phrasing-templates.ts
//
// Founder BEGIN Phase 2 · deterministic phrasing templates.
//
// Zero LLM. For each intent's answer_kind, we hold a small hand-written
// set of natural question forms. Templates use {name} · {city} · {category}
// placeholders. The generator substitutes concrete values at generation time.
//
// Coverage-driven, not garbage-driven (§7 + §21). If a new intent is added,
// a corresponding phrasing set MUST be added here — otherwise the generator
// will emit ZERO variants for it and honestly report zero coverage.

import type { AnswerKind, IntentDefinition } from "@/lib/nex/intelligence-storage-grid/accommodation/intent-registry";

// One template = one English question form. Placeholders: {name} {category} {city}.
// Keep short. Each template should feel natural to a real user.
export type Phrasing = {
  raw_template: string;
  language: "en" | "id";
};

// Per-intent overrides (higher priority than answer_kind default sets).
const PER_INTENT_TEMPLATES: Partial<Record<string, readonly Phrasing[]>> = {
  wifi_available: [
    { raw_template: "Does {name} have wifi?", language: "en" },
    { raw_template: "Is wifi available at {name}?", language: "en" },
    { raw_template: "Can I get wifi at {name}?", language: "en" },
    { raw_template: "Does {name} offer internet?", language: "en" },
    { raw_template: "wifi at {name}?", language: "en" },
    { raw_template: "Apakah {name} ada wifi?", language: "id" },
  ],
  pool_available: [
    { raw_template: "Does {name} have a pool?", language: "en" },
    { raw_template: "Is there a pool at {name}?", language: "en" },
    { raw_template: "Does {name} have a swimming pool?", language: "en" },
    { raw_template: "pool at {name}?", language: "en" },
    { raw_template: "Apakah {name} ada kolam renang?", language: "id" },
  ],
  breakfast_available: [
    { raw_template: "Does {name} include breakfast?", language: "en" },
    { raw_template: "Is breakfast included at {name}?", language: "en" },
    { raw_template: "Does {name} offer breakfast?", language: "en" },
    { raw_template: "breakfast at {name}?", language: "en" },
    { raw_template: "Apakah {name} termasuk sarapan?", language: "id" },
  ],
  parking_available: [
    { raw_template: "Does {name} have parking?", language: "en" },
    { raw_template: "Is there parking at {name}?", language: "en" },
    { raw_template: "parking at {name}?", language: "en" },
    { raw_template: "Apakah {name} ada parkir?", language: "id" },
  ],
  room_count: [
    { raw_template: "How many rooms does {name} have?", language: "en" },
    { raw_template: "How many rooms are there at {name}?", language: "en" },
    { raw_template: "rooms at {name}?", language: "en" },
    { raw_template: "Berapa jumlah kamar {name}?", language: "id" },
  ],
  price_indicative: [
    { raw_template: "How much does {name} cost?", language: "en" },
    { raw_template: "What's the price of {name}?", language: "en" },
    { raw_template: "How expensive is {name}?", language: "en" },
    { raw_template: "Berapa harga {name}?", language: "id" },
  ],
  location_city: [
    { raw_template: "Where is {name}?", language: "en" },
    { raw_template: "Which city is {name} in?", language: "en" },
    { raw_template: "Where's {name} located?", language: "en" },
    { raw_template: "Di kota mana {name}?", language: "id" },
  ],
  location_address: [
    { raw_template: "What's the address of {name}?", language: "en" },
    { raw_template: "What is {name}'s address?", language: "en" },
    { raw_template: "Where can I find {name}?", language: "en" },
    { raw_template: "Apa alamat {name}?", language: "id" },
  ],
  property_phone: [
    { raw_template: "What's the phone number for {name}?", language: "en" },
    { raw_template: "How do I call {name}?", language: "en" },
    { raw_template: "Nomor telepon {name}?", language: "id" },
  ],
  property_star_rating: [
    { raw_template: "How many stars does {name} have?", language: "en" },
    { raw_template: "What star rating is {name}?", language: "en" },
    { raw_template: "Is {name} a 5-star hotel?", language: "en" },
    { raw_template: "Berapa bintang {name}?", language: "id" },
  ],
  check_in_time: [
    { raw_template: "What time is check-in at {name}?", language: "en" },
    { raw_template: "When can I check in at {name}?", language: "en" },
    { raw_template: "Jam berapa check-in di {name}?", language: "id" },
  ],
  check_out_time: [
    { raw_template: "What time is check-out at {name}?", language: "en" },
    { raw_template: "When do I check out at {name}?", language: "en" },
    { raw_template: "Jam berapa check-out di {name}?", language: "id" },
  ],
};

// Fallback per-answer_kind templates. Used when a specific intent has no
// override above. Every intent MUST render at least one template — otherwise
// generation coverage will silently be zero.
const ANSWER_KIND_DEFAULT_TEMPLATES: Record<AnswerKind, readonly Phrasing[]> = {
  fact: [
    { raw_template: "What is the {intent_display} of {name}?", language: "en" },
    { raw_template: "Tell me the {intent_display} of {name}", language: "en" },
    { raw_template: "{intent_display} untuk {name}?", language: "id" },
  ],
  list: [
    { raw_template: "What are the {intent_display} at {name}?", language: "en" },
    { raw_template: "List the {intent_display} at {name}", language: "en" },
    { raw_template: "Daftar {intent_display} di {name}?", language: "id" },
  ],
  policy: [
    { raw_template: "What is {name}'s {intent_display}?", language: "en" },
    { raw_template: "What's the {intent_display} at {name}?", language: "en" },
    { raw_template: "Kebijakan {intent_display} di {name}?", language: "id" },
  ],
  computed: [
    { raw_template: "What's the {intent_display} for {name}?", language: "en" },
  ],
  relationship: [
    { raw_template: "What's {intent_display} near {name}?", language: "en" },
    { raw_template: "Anything {intent_display} close to {name}?", language: "en" },
    { raw_template: "{intent_display} dekat {name}?", language: "id" },
  ],
  media: [
    { raw_template: "Do you have photos of {name}?", language: "en" },
    { raw_template: "Show me a picture of {name}", language: "en" },
    { raw_template: "Foto {name}?", language: "id" },
  ],
};

/**
 * Return every phrasing candidate for a given intent. Uses the per-intent
 * override when present, otherwise the answer_kind default. Templates are
 * rendered with (name, category, city) substitutions by the caller.
 */
export function phrasingsForIntent(intent: IntentDefinition): readonly Phrasing[] {
  return PER_INTENT_TEMPLATES[intent.slug] ?? ANSWER_KIND_DEFAULT_TEMPLATES[intent.answer_kind] ?? [];
}

/**
 * Substitute placeholders. Returns the rendered raw text.
 */
export function renderTemplate(tpl: string, values: {
  name: string;
  category?: string | null;
  city?: string | null;
  intent_display?: string | null;
}): string {
  return tpl
    .replace(/\{name\}/g, values.name)
    .replace(/\{category\}/g, values.category ?? "hotel")
    .replace(/\{city\}/g, values.city ?? "")
    .replace(/\{intent_display\}/g, values.intent_display ?? "detail");
}
