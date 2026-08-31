// src/lib/nex/brain/accommodation-slots.ts
//
// Stage 3.7 · NEX Conversational Brain · slot extractor for
// accommodation turns (Philip 2026-08-31). Pure deterministic regex
// extractor · no LLM · bilingual (English + Bahasa Indonesia).
//
// Converts a single user turn into a Partial<AccommodationSlots>. The
// caller (orchestrator) merges each turn's extraction with the prior
// session state, so a three-turn flow
//   1. "I need a hotel in Yogyakarta"
//   2. "Cheap"
//   3. "Near Malioboro"
// accumulates into { type: "hotel", location: "yogyakarta",
//                    budget: "budget", area: "malioboro" }.
//
// Correction detection ("actually", "sebenarnya", "instead") is
// surfaced separately so the merger can prefer the new turn's slots
// over prior when the user changes their mind. In the base case the
// latest turn wins on any overlapping slot anyway — the correction
// flag is used mainly to color the composer's acknowledgement
// ("Switching to guesthouses...").

export type AccommodationType =
  | "hotel"
  | "guesthouse"
  | "homestay"
  | "hostel"
  | "villa"
  | "resort"
  | "kos"
  | "apartment";

export type AccommodationBudget = "budget" | "mid" | "luxury";

export type AccommodationAction = "discover" | "refine" | "book";

export type AccommodationSlots = {
  /** Canonical city/region slug · e.g. "yogyakarta" | "jakarta" | "ubud" */
  location?: string;
  /** Sub-area name (canonical lowercased) · e.g. "malioboro" */
  area?: string;
  type?: AccommodationType;
  budget?: AccommodationBudget;
  /** Integer party size when detected. */
  guests?: number;
  /** Free-form date phrase · "tonight" | "tomorrow" | "friday" | "3 nights" */
  date?: string;
  /** Canonical amenity codes · e.g. ["pool", "wifi"] */
  amenities?: string[];
  action?: AccommodationAction;
};

export type ExtractResult = {
  slots: Partial<AccommodationSlots>;
  /** User signalled a correction / change of mind ("actually", "sebenarnya"). */
  correction: boolean;
  /** True when this turn is a knowledge question rather than a discovery step. */
  isKnowledgeQuestion: boolean;
};

// ─── Vocabulary packs ─────────────────────────────────────────────────

// Cities · canonical form on the right, all recognised aliases on the left.
const LOCATIONS: Array<[RegExp, string]> = [
  [/\b(yogyakarta|jogja|jogjakarta|jogya|diy)\b/i, "yogyakarta"],
  [/\b(jakarta|jkt)\b/i, "jakarta"],
  [/\bbandung\b/i, "bandung"],
  [/\b(surabaya|sby)\b/i, "surabaya"],
  [/\bmedan\b/i, "medan"],
  [/\bmakassar\b/i, "makassar"],
  [/\bsemarang\b/i, "semarang"],
  [/\bmalang\b/i, "malang"],
  [/\bsolo\b/i, "solo"],
  [/\bbali\b/i, "bali"],
  [/\bubud\b/i, "ubud"],
  [/\bcanggu\b/i, "canggu"],
  [/\bkuta\b/i, "kuta"],
  [/\bseminyak\b/i, "seminyak"],
  [/\bsanur\b/i, "sanur"],
  [/\bnusa\s?dua\b/i, "nusa-dua"],
  [/\buluwatu\b/i, "uluwatu"],
  [/\bjimbaran\b/i, "jimbaran"],
  [/\blombok\b/i, "lombok"],
  [/\blabuan\s?bajo\b/i, "labuan-bajo"],
];

// Sub-city areas · rare enough that a small set works. Extend as the
// corpus grows. Canonical lowercased form.
const AREAS: Array<[RegExp, string]> = [
  [/\bmalioboro\b/i, "malioboro"],
  [/\bprawirotaman\b/i, "prawirotaman"],
  [/\bkraton\b/i, "kraton"],
  [/\bkotagede\b/i, "kotagede"],
  [/\btugu\b/i, "tugu"],
  [/\bgondomanan\b/i, "gondomanan"],
];

const TYPES: Array<[RegExp, AccommodationType]> = [
  [/\bhotels?\b/i, "hotel"],
  [/\b(guest[ -]?houses?)\b/i, "guesthouse"],
  [/\bhomestays?\b/i, "homestay"],
  [/\bhostels?\b/i, "hostel"],
  [/\bvillas?\b/i, "villa"],
  [/\bresorts?\b/i, "resort"],
  [/\bkos([- ]?kosan)?\b/i, "kos"],
  [/\b(apartments?|apartemen)\b/i, "apartment"],
];

const BUDGETS: Array<[RegExp, AccommodationBudget]> = [
  [/\b(cheap|budget|inexpensive|backpackers?|affordable|murah)\b/i, "budget"],
  [/\b(mid[ -]?range|mid|standard|medium|menengah)\b/i, "mid"],
  [/\b(luxur(y|ious)|upmarket|premium|high[ -]?end|five[ -]?star|5[ -]?star|mewah|bintang\s?5)\b/i, "luxury"],
];

const AMENITIES: Array<[RegExp, string]> = [
  [/\b(swimming\s?pool|kolam\s?renang|kolam|pool)\b/i, "pool"],
  [/\bwi[ -]?fi\b/i, "wifi"],
  [/\b(breakfast|sarapan)\b/i, "breakfast"],
  [/\b(parking|parkir)\b/i, "parking"],
  [/\b(air\s?con(ditioning)?|\bac\b)\b/i, "ac"],
  [/\b(restaurant|restoran)\b/i, "restaurant"],
  [/\b(pet[ -]?friendly|pets?)\b/i, "pets"],
];

const DATE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(tonight|malam ini)\b/i, "tonight"],
  [/\b(tomorrow|besok)\b/i, "tomorrow"],
  [/\bthis (weekend|weekender)\b/i, "this-weekend"],
  [/\bnext (weekend|weekender)\b/i, "next-weekend"],
  [/\b(akhir pekan)\b/i, "weekend"],
  [/\b(monday|senin)\b/i, "monday"],
  [/\b(tuesday|selasa)\b/i, "tuesday"],
  [/\b(wednesday|rabu)\b/i, "wednesday"],
  [/\b(thursday|kamis)\b/i, "thursday"],
  [/\b(friday|jumat|jum'at)\b/i, "friday"],
  [/\b(saturday|sabtu)\b/i, "saturday"],
  [/\b(sunday|minggu)\b/i, "sunday"],
];

const ACTIONS: Array<[RegExp, AccommodationAction]> = [
  [/\b(book|reserve|reserv|booking|pesan|booking\s+dong|book\s+it)\b/i, "book"],
  [/\b(cheaper|other|different|another|more options|lainnya|lain|yang lain|show me more)\b/i, "refine"],
  [/\b(find|show|looking for|need|want|cari|butuh|mau|perlu|tunjuk)\b/i, "discover"],
];

const CORRECTION_MARKERS = [
  /\bactually\b/i,
  /\bwait\b/i,
  /\bnever\s?mind\b/i,
  /\binstead\b/i,
  /\brather\b/i,
  /\bnot\s+\w+,?\s+/i, // "not a hotel, a guesthouse"
  /\b(sebenarnya|malah|bukan\s+\w+,?\s+|ubah)\b/i,
];

const KNOWLEDGE_PHRASES = [
  /\b(what (is|are)|what'?s the difference|explain|tell me about|how do(es)?|difference between|apa itu|apa saja|jelaskan|bagaimana)\b/i,
];

// ─── Extractor ────────────────────────────────────────────────────────

export function extractAccommodationSlots(message: string): ExtractResult {
  const raw = message.trim();
  const slots: Partial<AccommodationSlots> = {};

  for (const [rx, canonical] of LOCATIONS) if (rx.test(raw)) { slots.location = canonical; break; }
  for (const [rx, canonical] of AREAS) if (rx.test(raw)) { slots.area = canonical; break; }
  for (const [rx, canonical] of TYPES) if (rx.test(raw)) { slots.type = canonical; break; }
  for (const [rx, canonical] of BUDGETS) if (rx.test(raw)) { slots.budget = canonical; break; }
  for (const [rx, canonical] of DATE_PATTERNS) if (rx.test(raw)) { slots.date = canonical; break; }
  for (const [rx, canonical] of ACTIONS) if (rx.test(raw)) { slots.action = canonical; break; }

  // Amenities are multi-select · collect all matches.
  const amenities: string[] = [];
  for (const [rx, canonical] of AMENITIES) if (rx.test(raw) && !amenities.includes(canonical)) amenities.push(canonical);
  if (amenities.length > 0) slots.amenities = amenities;

  // Guest count · try structured patterns first, then shorthand.
  const guestPatterns = [
    /\b(?:for|party of|group of|untuk)\s+(\d+)\s+(?:people|adults|guests|orang|pax)\b/i,
    /\b(\d+)\s+(?:people|adults|guests|orang|pax)\b/i,
  ];
  for (const rx of guestPatterns) {
    const m = raw.match(rx);
    if (m) { const n = parseInt(m[1], 10); if (n > 0 && n < 50) { slots.guests = n; break; } }
  }
  if (slots.guests === undefined) {
    if (/\b(single|solo|alone|sendiri|just me)\b/i.test(raw)) slots.guests = 1;
    else if (/\b(couple|for two|for 2|two people|dua orang|kami berdua)\b/i.test(raw)) slots.guests = 2;
  }

  const correction = CORRECTION_MARKERS.some((rx) => rx.test(raw));
  const isKnowledgeQuestion = KNOWLEDGE_PHRASES.some((rx) => rx.test(raw));

  return { slots, correction, isKnowledgeQuestion };
}

// ─── Merger ──────────────────────────────────────────────────────────

/**
 * Merge a new turn's extracted slots on top of prior session slots.
 * Latest turn wins on any overlapping slot (users refine their ask by
 * saying new values, not by repeating old ones). Correction flag does
 * not change merge behavior · the composer uses it to color its reply.
 * Amenities accumulate (union) so "with a pool" + later "and wifi"
 * both stick.
 */
export function mergeAccommodationSlots(
  prior: Readonly<AccommodationSlots> | undefined,
  next: Readonly<Partial<AccommodationSlots>>,
): AccommodationSlots {
  const merged: AccommodationSlots = { ...(prior ?? {}) };

  if (next.location !== undefined) merged.location = next.location;
  if (next.area !== undefined) merged.area = next.area;
  if (next.type !== undefined) merged.type = next.type;
  if (next.budget !== undefined) merged.budget = next.budget;
  if (next.guests !== undefined) merged.guests = next.guests;
  if (next.date !== undefined) merged.date = next.date;
  if (next.action !== undefined) merged.action = next.action;

  if (next.amenities && next.amenities.length > 0) {
    const set = new Set([...(prior?.amenities ?? []), ...next.amenities]);
    merged.amenities = [...set];
  }

  return merged;
}

/** Which slots does this turn ADD to prior (fields not present before)? */
export function newSlotsIntroduced(
  prior: Readonly<AccommodationSlots> | undefined,
  next: Readonly<Partial<AccommodationSlots>>,
): Array<keyof AccommodationSlots> {
  const introduced: Array<keyof AccommodationSlots> = [];
  const p = prior ?? {};
  for (const k of ["location", "area", "type", "budget", "guests", "date", "action"] as const) {
    if (next[k] !== undefined && p[k] === undefined) introduced.push(k);
  }
  if (next.amenities && next.amenities.length > 0) {
    const priorSet = new Set(p.amenities ?? []);
    if (next.amenities.some((a) => !priorSet.has(a))) introduced.push("amenities");
  }
  return introduced;
}

/** Human-readable, short summary of the current slot state for use in
 *  composer replies ("Got it — cheap hotels in Yogyakarta"). */
export function describeSlots(slots: AccommodationSlots, lang: "en" | "id" = "en"): string {
  if (lang === "id") {
    // Bahasa Indonesia · adjective follows noun.
    // Order: [type] [budget-adjective] [dekat area] [di location].
    const parts: string[] = [];
    // Type first — kos-kosan is the canonical ID form; other type nouns
    // (hotel, guesthouse, homestay, hostel, villa, resort, apartment)
    // are used as-is because they're borrowings that don't take an
    // Indonesian plural marker.
    if (slots.type) parts.push(slots.type === "kos" ? "kos-kosan" : slots.type);
    else parts.push("tempat menginap");
    if (slots.budget) parts.push(slots.budget === "budget" ? "murah" : slots.budget === "mid" ? "menengah" : "mewah");
    if (slots.area) parts.push(`dekat ${capitalize(slots.area)}`);
    else if (slots.location) parts.push(`di ${capitalize(slots.location).replace(/-/g, " ")}`);
    return parts.join(" ");
  }
  const parts: string[] = [];
  if (slots.budget) parts.push(slots.budget === "budget" ? "budget" : slots.budget === "mid" ? "mid-range" : "upmarket");
  if (slots.type) parts.push(slots.type === "kos" ? "kos-kosan" : `${slots.type}s`);
  else parts.push("stays");
  if (slots.area) parts.push(`near ${capitalize(slots.area)}`);
  else if (slots.location) parts.push(`in ${capitalize(slots.location).replace(/-/g, " ")}`);
  return parts.join(" ");
}

function capitalize(s: string): string {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}
