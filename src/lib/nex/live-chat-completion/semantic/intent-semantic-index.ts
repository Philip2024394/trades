// src/lib/nex/live-chat-completion/semantic/intent-semantic-index.ts
//
// Founder BEGIN Phase 3.4B integration polish (SI-1) 2026-09-09.
//
// Semantic index over the 52 accommodation INTENT slugs, not entities or
// question variants. Adapter uses this when parseIntent's token-trigger
// matching returns nothing meaningful, so that natural paraphrases like
//   "where can I leave my car"  → parking_available
//   "somewhere to swim"          → pool_available
//   "internet in the room"       → wifi_available
// resolve to the correct intent WITHOUT invoking an LLM.
//
// The index is BUILT AT PROCESS START from INTENT_REGISTRY + a small
// hand-authored paraphrase corpus. Zero I/O. Zero LLM. Deterministic.

import { INTENT_REGISTRY, type IntentDefinition } from "@/lib/nex/intelligence-storage-grid/accommodation/intent-registry";
import type { EmbeddingProvider } from "./embedding-provider";
import { cosine } from "./embedding-provider";

// ═══════════════════════════════════════════════════════════════════
// Hand-authored paraphrase corpus per intent slug.
//
// Only intents that have realistic user-phrasing ambiguity get overrides;
// the rest fall back to intent.display_en + intent.composer_hint_en.
// Keep phrases SHORT and NATURAL — this is what real users say.
// ═══════════════════════════════════════════════════════════════════

const INTENT_PARAPHRASES: Record<string, readonly string[]> = Object.freeze({
  parking_available: [
    "parking availability",
    "car park",
    "somewhere to leave my car",
    "vehicle parking",
    "can I park my car",
    "parking for guests",
    "car storage",
    "self-parking",
    "valet parking",
  ],
  wifi_available: [
    "internet access",
    "wireless internet",
    "wi-fi in the room",
    "can I get online",
    "internet in room",
    "connectivity",
    "web access",
  ],
  pool_available: [
    "swimming pool",
    "can I swim there",
    "somewhere to swim",
    "outdoor pool",
    "indoor pool",
    "pool for guests",
  ],
  breakfast_available: [
    "morning meal included",
    "is food in the morning",
    "breakfast served",
    "morning breakfast",
    "included breakfast",
  ],
  gym_available: ["fitness centre", "workout room", "gym for guests"],
  spa_available: ["spa services", "massage", "wellness"],
  laundry_available: ["laundry service", "washing", "clothes cleaning"],
  elevator_available: ["lift", "elevator access"],
  air_conditioning_available: ["ac", "air con", "climate control"],
  restaurant_available: ["onsite restaurant", "dining"],
  bar_available: ["bar onsite", "drinks"],
  room_service_available: ["room service", "in-room dining"],
  balcony_available: ["balcony", "outdoor terrace"],
  smoking_policy: ["smoking allowed", "can I smoke"],
  pet_policy: ["pets allowed", "dog friendly", "bring my dog", "cat friendly"],
  children_policy: ["family-friendly for kids", "children welcome"],
  wheelchair_access: ["wheelchair accessible", "disability access", "step-free"],
  check_in_time: ["arrival time", "when can I arrive"],
  check_out_time: ["departure time", "when do I leave"],
  cancellation_policy: ["can I cancel booking", "refund policy"],
  opening_hours: ["when is it open", "operating hours"],
  payment_methods: ["how do I pay", "accepted cards", "cash accepted"],
  price_indicative: ["how much per night", "cost of a room", "nightly rate", "expensive or cheap"],
  availability_query: ["available tomorrow", "any rooms tonight", "vacancy for the weekend"],
  availability_tonight: ["free tonight", "vacancy for tonight"],
  room_count: ["how many rooms", "room count", "number of rooms"],
  room_types: ["what kinds of rooms", "room categories"],
  beds_configuration: ["bed size", "king bed", "queen bed", "twin beds"],
  capacity: ["how many people can stay", "sleeps how many"],
  property_star_rating: ["how many stars", "star rating"],
  property_rating: ["rating", "how good is it", "reviews score"],
  reviews_count: ["how many reviews"],
  location_city: ["what city is it in", "where is it located"],
  location_district: ["which district", "which area"],
  location_neighbourhood: ["what neighbourhood"],
  location_address: ["street address", "postal address"],
  location_coordinates: ["latitude longitude", "gps coordinates"],
  distance_to_landmark: ["how far from", "distance to"],
  distance_to_malioboro: ["distance to malioboro"],
  distance_to_airport: ["how far to the airport", "distance from airport"],
  nearby_food: ["restaurants nearby", "where to eat close by", "food options nearby"],
  nearby_attractions: ["things to do nearby", "tourist spots near", "attractions close"],
  nearby_transport: ["public transport nearby", "bus stop nearby", "train station near"],
  property_phone: ["phone number", "how to call them"],
  property_whatsapp: ["whatsapp number"],
  property_website: ["website url"],
  property_email: ["email address"],
  hero_image: ["photo of the hotel", "picture of it", "show me images"],
  suitable_for_families: ["good for families with kids"],
  suitable_for_couples: ["good for couples"],
  suitable_for_business: ["good for business travellers"],
  suitable_for_backpackers: ["good for backpackers", "budget travellers"],
  property_name: ["what's the name of this place"],
  property_category: ["what kind of place is it"],
  property_brand: ["brand chain"],
  list_in_city: ["show me hotels in", "hotels available in", "list of hotels"],
});

function intentSourceText(intent: IntentDefinition): string {
  const base = [
    intent.display_en,
    intent.composer_hint_en.replace(/\{value\}|\{name\}/g, "").trim(),
  ].join(" · ");
  const paras = INTENT_PARAPHRASES[intent.slug];
  if (paras && paras.length > 0) return `${base} · ${paras.join(" · ")}`;
  return base;
}

// ═══════════════════════════════════════════════════════════════════
// Built index (module-level · one per process per provider)
// ═══════════════════════════════════════════════════════════════════

interface IntentIndexEntry {
  slug: string;
  display_en: string;
  source_text: string;
  embedding: number[];
}

let _index: { model_id: string; entries: IntentIndexEntry[] } | null = null;

export async function buildIntentSemanticIndex(provider: EmbeddingProvider): Promise<void> {
  if (_index && _index.model_id === provider.model_id) return;
  const entries: IntentIndexEntry[] = [];
  for (const intent of INTENT_REGISTRY) {
    const source = intentSourceText(intent);
    const embedding = await provider.embed(source);
    entries.push({ slug: intent.slug, display_en: intent.display_en, source_text: source, embedding });
  }
  _index = { model_id: provider.model_id, entries };
}

export interface IntentSemanticHit {
  intent_slug: string;
  display_en: string;
  similarity: number;
}

export async function topKIntents(input: {
  query: string;
  provider: EmbeddingProvider;
  k?: number;
  min_similarity?: number;
}): Promise<IntentSemanticHit[]> {
  await buildIntentSemanticIndex(input.provider);
  if (!_index) return [];
  const k = Math.max(1, Math.min(10, input.k ?? 3));
  const minSim = Math.max(0, Math.min(1, input.min_similarity ?? 0.2));
  const q = await input.provider.embed(input.query);
  const scored: IntentSemanticHit[] = [];
  for (const e of _index.entries) {
    const sim = cosine(q, e.embedding);
    if (sim >= minSim) scored.push({ intent_slug: e.slug, display_en: e.display_en, similarity: sim });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}
