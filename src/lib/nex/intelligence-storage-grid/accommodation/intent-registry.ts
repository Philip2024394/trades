// src/lib/nex/intelligence-storage-grid/accommodation/intent-registry.ts
//
// Founder BEGIN 2026-09-09 · CANONICAL INTENT REGISTRY (P1)
//
// Master AI Engineer · deterministic language → intent resolution foundation.
//
// One canonical intent slug PER user-observable accommodation question type.
// Zero paid API. Zero LLM. Structured facts flow: user language → normalise
// → intent → fact lookup → composer → natural language answer.
//
// Design rules (Founder-authorized):
//   1. ~50 intents · not 50k questions. The intent is the primitive.
//   2. Every intent has: slug · display_en · display_id · answer_kind ·
//      canonical_field(s) · evidence_field(s) · aliases (delegated to
//      language-normaliser.ts) · slot definitions.
//   3. answer_kind = "fact" | "list" | "relationship" | "computed" ·
//      determines how fact-computer builds the fact object.
//   4. canonical_field points at nex.accommodation_business column names ·
//      evidence_field at nex.accommodation_enrichment_evidence.field_name.
//   5. If the intent needs cross-domain data (nearby food/attractions) ·
//      relationship_source names the source table.
//
// Zero storage modifications. Additive intelligence layer.

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type AnswerKind =
  | "fact"          // single canonical field (breakfast=yes) or evidence value
  | "list"          // multi-value set (amenities · room_types)
  | "relationship"  // cross-domain (nearby restaurants · attractions)
  | "computed"      // derived (walk-time to Malioboro from lat/lng)
  | "policy"        // check-in/out · cancellation · pet · children policies
  | "media";        // hero image · gallery

export interface IntentDefinition {
  slug: string;
  display_en: string;
  display_id: string;
  answer_kind: AnswerKind;
  /** SQL column names on nex.accommodation_business to check for a VERIFIED value. */
  canonical_fields: readonly string[];
  /** field_name values on nex.accommodation_business_field_provenance to check trust. */
  evidence_field_names: readonly string[];
  /** If answer_kind = "relationship", the cross-domain table to traverse. */
  relationship_source?: string;
  /** Whether an UNKNOWN answer for this intent should enqueue a Gap Engine ticket. */
  auto_enqueue_gap_on_unknown: boolean;
  /** Whether this intent is currently answerable from currently-owned data. */
  currently_answerable_from_owned_data: "YES" | "PARTIAL" | "NO";
  /** Short human-readable summary used by the composer as prose scaffold. */
  composer_hint_en: string;
  composer_hint_id: string;
}

// ═══════════════════════════════════════════════════════════════════
// The 50 canonical intents · Founder-authorized set
// ═══════════════════════════════════════════════════════════════════

export const INTENT_REGISTRY: readonly IntentDefinition[] = Object.freeze([
  // ── Property identity ─────────────────────────────────────────
  { slug: "property_name",     display_en: "Property name",     display_id: "Nama properti",
    answer_kind: "fact", canonical_fields: ["business_name"], evidence_field_names: ["business_name"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "YES",
    composer_hint_en: "This property is called {value}.", composer_hint_id: "Properti ini bernama {value}." },

  { slug: "property_category", display_en: "Property category", display_id: "Kategori properti",
    answer_kind: "fact", canonical_fields: ["category"], evidence_field_names: ["category"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "YES",
    composer_hint_en: "It's a {value}.", composer_hint_id: "Termasuk kategori {value}." },

  { slug: "property_brand", display_en: "Property brand", display_id: "Merek",
    answer_kind: "fact", canonical_fields: [], evidence_field_names: ["recovered:brand", "brand"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Brand: {value}.", composer_hint_id: "Merek: {value}." },

  { slug: "property_star_rating", display_en: "Star rating", display_id: "Bintang",
    answer_kind: "fact", canonical_fields: ["star_rating"], evidence_field_names: ["star_rating"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "{value}-star.", composer_hint_id: "Bintang {value}." },

  { slug: "property_rating", display_en: "Overall rating", display_id: "Rating",
    answer_kind: "fact", canonical_fields: ["rating"], evidence_field_names: ["rating"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Rated {value}.", composer_hint_id: "Rating {value}." },

  { slug: "reviews_count", display_en: "Reviews count", display_id: "Jumlah ulasan",
    answer_kind: "fact", canonical_fields: ["review_count"], evidence_field_names: ["review_count"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "{value} reviews.", composer_hint_id: "{value} ulasan." },

  // ── Location ──────────────────────────────────────────────────
  { slug: "location_city", display_en: "City", display_id: "Kota",
    answer_kind: "fact", canonical_fields: ["city"], evidence_field_names: ["city"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "YES",
    composer_hint_en: "It's in {value}.", composer_hint_id: "Di kota {value}." },

  { slug: "location_district", display_en: "District", display_id: "Kecamatan",
    answer_kind: "fact", canonical_fields: ["district"], evidence_field_names: ["district"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "District: {value}.", composer_hint_id: "Kecamatan: {value}." },

  { slug: "location_neighbourhood", display_en: "Neighbourhood", display_id: "Kawasan",
    answer_kind: "fact", canonical_fields: ["neighbourhood"], evidence_field_names: ["neighbourhood"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Neighbourhood: {value}.", composer_hint_id: "Kawasan: {value}." },

  { slug: "location_address", display_en: "Street address", display_id: "Alamat",
    answer_kind: "fact", canonical_fields: ["address"], evidence_field_names: ["address"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Address: {value}.", composer_hint_id: "Alamat: {value}." },

  { slug: "location_coordinates", display_en: "Coordinates", display_id: "Koordinat",
    answer_kind: "fact", canonical_fields: ["coordinates_lat", "coordinates_lng"], evidence_field_names: ["coordinates_lat", "coordinates_lng"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "YES",
    composer_hint_en: "Coordinates {value}.", composer_hint_id: "Koordinat {value}." },

  { slug: "distance_to_landmark", display_en: "Distance to landmark", display_id: "Jarak ke landmark",
    answer_kind: "computed", canonical_fields: ["coordinates_lat", "coordinates_lng"], evidence_field_names: [],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "About {value} km from the landmark.", composer_hint_id: "Sekitar {value} km dari landmark." },

  // ── Contact ───────────────────────────────────────────────────
  { slug: "property_phone", display_en: "Phone", display_id: "Telepon",
    answer_kind: "fact", canonical_fields: ["phone"], evidence_field_names: ["phone"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Phone: {value}.", composer_hint_id: "Telepon: {value}." },

  { slug: "property_whatsapp", display_en: "WhatsApp", display_id: "WhatsApp",
    answer_kind: "fact", canonical_fields: ["whatsapp_number"], evidence_field_names: ["whatsapp_number", "recovered:contact_whatsapp"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "WhatsApp: {value}.", composer_hint_id: "WhatsApp: {value}." },

  { slug: "property_website", display_en: "Website", display_id: "Situs web",
    answer_kind: "fact", canonical_fields: ["website"], evidence_field_names: ["website"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Website: {value}.", composer_hint_id: "Situs: {value}." },

  { slug: "property_email", display_en: "Email", display_id: "Surel",
    answer_kind: "fact", canonical_fields: [], evidence_field_names: ["recovered:email"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Email: {value}.", composer_hint_id: "Surel: {value}." },

  // ── Room / Bed / Capacity ────────────────────────────────────
  { slug: "room_types", display_en: "Room types", display_id: "Jenis kamar",
    answer_kind: "list", canonical_fields: [], evidence_field_names: ["room_types"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Room types: {value}.", composer_hint_id: "Jenis kamar: {value}." },

  { slug: "room_count", display_en: "Room count", display_id: "Jumlah kamar",
    answer_kind: "fact", canonical_fields: ["room_count"], evidence_field_names: ["room_count"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "{value} rooms.", composer_hint_id: "{value} kamar." },

  { slug: "beds_configuration", display_en: "Beds", display_id: "Tempat tidur",
    answer_kind: "list", canonical_fields: [], evidence_field_names: ["beds", "bed_configuration"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Beds: {value}.", composer_hint_id: "Tempat tidur: {value}." },

  { slug: "capacity", display_en: "Capacity", display_id: "Kapasitas",
    answer_kind: "fact", canonical_fields: [], evidence_field_names: ["max_occupancy", "capacity"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Sleeps {value}.", composer_hint_id: "Kapasitas {value} orang." },

  // ── Amenities · these check the amenities[] array on the row ──
  { slug: "wifi_available", display_en: "Wi-Fi", display_id: "Wi-Fi",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["amenities:wifi"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Wi-Fi: {value}.", composer_hint_id: "Wi-Fi: {value}." },

  { slug: "air_conditioning_available", display_en: "Air conditioning", display_id: "AC",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["amenities:ac"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "AC: {value}.", composer_hint_id: "AC: {value}." },

  { slug: "parking_available", display_en: "Parking", display_id: "Parkir",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["amenities:parking"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Parking: {value}.", composer_hint_id: "Parkir: {value}." },

  { slug: "pool_available", display_en: "Swimming pool", display_id: "Kolam renang",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["amenities:pool"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Pool: {value}.", composer_hint_id: "Kolam renang: {value}." },

  { slug: "gym_available", display_en: "Gym", display_id: "Pusat kebugaran",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["amenities:gym"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Gym: {value}.", composer_hint_id: "Gym: {value}." },

  { slug: "spa_available", display_en: "Spa", display_id: "Spa",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["amenities:spa"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Spa: {value}.", composer_hint_id: "Spa: {value}." },

  { slug: "laundry_available", display_en: "Laundry", display_id: "Laundry",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["amenities:laundry"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Laundry: {value}.", composer_hint_id: "Laundry: {value}." },

  { slug: "elevator_available", display_en: "Elevator", display_id: "Lift",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["amenities:elevator"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Elevator: {value}.", composer_hint_id: "Lift: {value}." },

  { slug: "balcony_available", display_en: "Balcony", display_id: "Balkon",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["amenities:balcony"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Balcony: {value}.", composer_hint_id: "Balkon: {value}." },

  { slug: "view_available", display_en: "Room view", display_id: "Pemandangan",
    answer_kind: "fact", canonical_fields: [], evidence_field_names: ["view"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "View: {value}.", composer_hint_id: "Pemandangan: {value}." },

  { slug: "smoking_policy", display_en: "Smoking", display_id: "Merokok",
    answer_kind: "fact", canonical_fields: [], evidence_field_names: ["smoking"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Smoking: {value}.", composer_hint_id: "Merokok: {value}." },

  // ── Food & drink ─────────────────────────────────────────────
  { slug: "breakfast_available", display_en: "Breakfast", display_id: "Sarapan",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["breakfast", "amenities:breakfast"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Breakfast: {value}.", composer_hint_id: "Sarapan: {value}." },

  { slug: "restaurant_available", display_en: "Restaurant", display_id: "Restoran",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["restaurant", "amenities:restaurant"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Restaurant: {value}.", composer_hint_id: "Restoran: {value}." },

  { slug: "bar_available", display_en: "Bar", display_id: "Bar",
    answer_kind: "fact", canonical_fields: ["amenities"], evidence_field_names: ["bar", "amenities:bar"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Bar: {value}.", composer_hint_id: "Bar: {value}." },

  { slug: "room_service_available", display_en: "Room service", display_id: "Layanan kamar",
    answer_kind: "fact", canonical_fields: [], evidence_field_names: ["room_service"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Room service: {value}.", composer_hint_id: "Layanan kamar: {value}." },

  // ── Policies ─────────────────────────────────────────────────
  { slug: "check_in_time", display_en: "Check-in time", display_id: "Waktu check-in",
    answer_kind: "policy", canonical_fields: [], evidence_field_names: ["check_in_time", "check_in"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Check-in: {value}.", composer_hint_id: "Check-in: {value}." },

  { slug: "check_out_time", display_en: "Check-out time", display_id: "Waktu check-out",
    answer_kind: "policy", canonical_fields: [], evidence_field_names: ["check_out_time", "check_out"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Check-out: {value}.", composer_hint_id: "Check-out: {value}." },

  { slug: "cancellation_policy", display_en: "Cancellation policy", display_id: "Kebijakan pembatalan",
    answer_kind: "policy", canonical_fields: [], evidence_field_names: ["cancellation_policy"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Cancellation: {value}.", composer_hint_id: "Pembatalan: {value}." },

  { slug: "pet_policy", display_en: "Pet policy", display_id: "Kebijakan hewan",
    answer_kind: "policy", canonical_fields: [], evidence_field_names: ["pet_policy", "pets_allowed"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Pets: {value}.", composer_hint_id: "Hewan: {value}." },

  { slug: "children_policy", display_en: "Children policy", display_id: "Kebijakan anak",
    answer_kind: "policy", canonical_fields: [], evidence_field_names: ["children_policy", "kids_allowed"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Children: {value}.", composer_hint_id: "Anak-anak: {value}." },

  { slug: "opening_hours", display_en: "Opening hours", display_id: "Jam buka",
    answer_kind: "policy", canonical_fields: [], evidence_field_names: ["opening_hours", "recovered:opening_hours"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Opening hours: {value}.", composer_hint_id: "Jam buka: {value}." },

  { slug: "payment_methods", display_en: "Payment methods", display_id: "Metode pembayaran",
    answer_kind: "policy", canonical_fields: [], evidence_field_names: ["payment_methods"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Payment: {value}.", composer_hint_id: "Pembayaran: {value}." },

  // ── Accessibility ────────────────────────────────────────────
  { slug: "wheelchair_access", display_en: "Wheelchair access", display_id: "Akses kursi roda",
    answer_kind: "fact", canonical_fields: [], evidence_field_names: ["wheelchair_access", "wheelchair"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Wheelchair: {value}.", composer_hint_id: "Kursi roda: {value}." },

  { slug: "accessible_room_available", display_en: "Accessible room", display_id: "Kamar aksesibel",
    answer_kind: "fact", canonical_fields: [], evidence_field_names: ["accessible_room"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Accessible rooms: {value}.", composer_hint_id: "Kamar aksesibel: {value}." },

  // ── Pricing & availability ───────────────────────────────────
  { slug: "price_indicative", display_en: "Indicative price", display_id: "Harga estimasi",
    answer_kind: "fact", canonical_fields: [], evidence_field_names: ["price_indicative", "nightly_rate"],
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Nightly rate: {value}.", composer_hint_id: "Tarif per malam: {value}." },

  { slug: "availability_tonight", display_en: "Available tonight", display_id: "Tersedia malam ini",
    answer_kind: "fact", canonical_fields: [], evidence_field_names: ["availability"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Availability: {value}.", composer_hint_id: "Ketersediaan: {value}." },

  // ── Nearby (cross-domain relationships) ──────────────────────
  { slug: "nearby_food", display_en: "Nearby food", display_id: "Makanan terdekat",
    answer_kind: "relationship", canonical_fields: ["coordinates_lat", "coordinates_lng"], evidence_field_names: [],
    relationship_source: "nex.food_business",
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "YES",
    composer_hint_en: "Nearby food: {value}.", composer_hint_id: "Kuliner terdekat: {value}." },

  { slug: "nearby_attractions", display_en: "Nearby attractions", display_id: "Objek wisata terdekat",
    answer_kind: "relationship", canonical_fields: ["coordinates_lat", "coordinates_lng"], evidence_field_names: [],
    relationship_source: "nex.attraction_business",
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Nearby attractions: {value}.", composer_hint_id: "Wisata terdekat: {value}." },

  { slug: "nearby_transport", display_en: "Nearby transport", display_id: "Transport terdekat",
    answer_kind: "relationship", canonical_fields: [], evidence_field_names: [],
    relationship_source: "nex.transport_business",
    auto_enqueue_gap_on_unknown: true, currently_answerable_from_owned_data: "NO",
    composer_hint_en: "Nearby transport: {value}.", composer_hint_id: "Transport terdekat: {value}." },

  { slug: "distance_to_malioboro", display_en: "Distance to Malioboro", display_id: "Jarak ke Malioboro",
    answer_kind: "computed", canonical_fields: ["coordinates_lat", "coordinates_lng"], evidence_field_names: [],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "YES",
    composer_hint_en: "About {value} km from Malioboro.", composer_hint_id: "Sekitar {value} km dari Malioboro." },

  { slug: "distance_to_airport", display_en: "Distance to airport", display_id: "Jarak ke bandara",
    answer_kind: "computed", canonical_fields: ["coordinates_lat", "coordinates_lng"], evidence_field_names: [],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "About {value} km from the airport.", composer_hint_id: "Sekitar {value} km dari bandara." },

  // ── Media ────────────────────────────────────────────────────
  { slug: "hero_image", display_en: "Hero image", display_id: "Gambar utama",
    answer_kind: "media", canonical_fields: ["hero_image_url"], evidence_field_names: ["hero_image_url"],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Photo available.", composer_hint_id: "Foto tersedia." },

  // ── Traveller-fit judgments (derived) ────────────────────────
  { slug: "suitable_for_families", display_en: "Suitable for families", display_id: "Cocok untuk keluarga",
    answer_kind: "computed", canonical_fields: ["category", "amenities"], evidence_field_names: [],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Family fit: {value}.", composer_hint_id: "Cocok keluarga: {value}." },

  { slug: "suitable_for_couples", display_en: "Suitable for couples", display_id: "Cocok untuk pasangan",
    answer_kind: "computed", canonical_fields: ["category"], evidence_field_names: [],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Couples fit: {value}.", composer_hint_id: "Cocok pasangan: {value}." },

  { slug: "suitable_for_business", display_en: "Suitable for business", display_id: "Cocok untuk bisnis",
    answer_kind: "computed", canonical_fields: ["category", "amenities"], evidence_field_names: [],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Business fit: {value}.", composer_hint_id: "Cocok bisnis: {value}." },

  { slug: "suitable_for_backpackers", display_en: "Suitable for backpackers", display_id: "Cocok untuk backpacker",
    answer_kind: "computed", canonical_fields: ["category"], evidence_field_names: [],
    auto_enqueue_gap_on_unknown: false, currently_answerable_from_owned_data: "PARTIAL",
    composer_hint_en: "Backpacker fit: {value}.", composer_hint_id: "Cocok backpacker: {value}." },
]);

// ═══════════════════════════════════════════════════════════════════
// Lookup helpers
// ═══════════════════════════════════════════════════════════════════

const _BY_SLUG = new Map<string, IntentDefinition>();
for (const i of INTENT_REGISTRY) _BY_SLUG.set(i.slug, i);

export function getIntent(slug: string): IntentDefinition | null {
  return _BY_SLUG.get(slug) ?? null;
}

export function allIntentSlugs(): readonly string[] {
  return INTENT_REGISTRY.map((i) => i.slug);
}

export function intentsByAnswerKind(kind: AnswerKind): readonly IntentDefinition[] {
  return INTENT_REGISTRY.filter((i) => i.answer_kind === kind);
}

export function registryStats(): {
  total_intents: number;
  by_answer_kind: Record<AnswerKind, number>;
  auto_gap_enqueue: number;
  answerable_from_owned_data: Record<"YES" | "PARTIAL" | "NO", number>;
} {
  const byKind: Record<string, number> = {};
  const byAnswerable: Record<string, number> = { YES: 0, PARTIAL: 0, NO: 0 };
  let autoGap = 0;
  for (const i of INTENT_REGISTRY) {
    byKind[i.answer_kind] = (byKind[i.answer_kind] ?? 0) + 1;
    byAnswerable[i.currently_answerable_from_owned_data]++;
    if (i.auto_enqueue_gap_on_unknown) autoGap++;
  }
  return {
    total_intents: INTENT_REGISTRY.length,
    by_answer_kind: byKind as Record<AnswerKind, number>,
    auto_gap_enqueue: autoGap,
    answerable_from_owned_data: byAnswerable as Record<"YES" | "PARTIAL" | "NO", number>,
  };
}
