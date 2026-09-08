// src/lib/nex/intelligence-storage-grid/accommodation/language-normaliser.ts
//
// Founder BEGIN 2026-09-09 · LANGUAGE NORMALISER (P1)
//
// Deterministic string normalisation for user queries. Zero embeddings.
// Zero LLM. Turns "brekky" · "sarapan" · "jogja tonite" into canonical tokens
// that the intent parser can match.
//
// Alias dictionaries are hand-curated (~250 total tokens) — Founder-approved
// seed. New aliases grow from the Gap Engine loop (chat logs surface unseen
// tokens, Master AI proposes new aliases, human review promotes them).

// ═══════════════════════════════════════════════════════════════════
// EN aliases · surface → canonical token
// ═══════════════════════════════════════════════════════════════════

const EN_ALIASES: Record<string, string> = Object.freeze({
  // Breakfast
  "brekky": "breakfast", "brekkie": "breakfast", "brekfast": "breakfast",
  "morning meal": "breakfast", "morning food": "breakfast",
  // Amenities
  "aircon": "air_conditioning", "a/c": "air_conditioning", "ac": "air_conditioning",
  "wifi": "wifi", "wi-fi": "wifi", "internet": "wifi",
  "swimming pool": "pool", "pools": "pool",
  "car park": "parking", "car-park": "parking", "carpark": "parking",
  "workout": "gym", "fitness": "gym", "fitness centre": "gym", "fitness center": "gym",
  "wellness": "spa", "massage": "spa",
  // Location shorthand
  "jogja": "yogyakarta", "jogya": "yogyakarta", "yogya": "yogyakarta", "jogj": "yogyakarta",
  "malioboro": "malioboro",
  // Price / cost
  "how much": "price", "howmuch": "price", "cost": "price", "rate": "price",
  "cheap": "price_cheap", "cheapest": "price_cheap", "affordable": "price_cheap",
  "expensive": "price_expensive", "luxury": "price_expensive", "premium": "price_expensive",
  // Time
  "tonight": "tonight", "tonite": "tonight", "2nite": "tonight", "2n1te": "tonight",
  "tomorrow": "tomorrow", "tmrw": "tomorrow", "tmr": "tomorrow",
  // Traveller types
  "kids": "children", "child": "children", "family": "family", "families": "family",
  "romantic": "couples", "honeymoon": "couples", "couple": "couples",
  "business": "business_traveller", "corporate": "business_traveller",
  "backpacker": "backpackers", "backpackers": "backpackers",
  // Access
  "wheelchair": "wheelchair", "wheelchairs": "wheelchair", "disabled access": "wheelchair",
  "lift": "elevator", "elevators": "elevator",
  // Rooms
  "bed": "bed", "beds": "bed", "king": "king_bed", "queen": "queen_bed", "twin": "twin_bed",
  "room": "room", "rooms": "room", "suite": "suite",
  // Categories
  "hotel": "hotel", "hotels": "hotel",
  "villa": "villa", "villas": "villa",
  "guesthouse": "guesthouse", "guest house": "guesthouse", "guest-house": "guesthouse", "guesthouses": "guesthouse",
  "homestay": "homestay", "home stay": "homestay", "homestays": "homestay",
  "hostel": "hostel", "hostels": "hostel", "backpackers hostel": "hostel",
  "apartment": "apartment", "apartments": "apartment", "apt": "apartment",
  "resort": "resort", "resorts": "resort",
  "kos": "kos", "kost": "kos", "kos-kosan": "kos", "boarding house": "kos",
  // Ordinals / structural
  "first": "ordinal_1", "1st": "ordinal_1",
  "second": "ordinal_2", "2nd": "ordinal_2",
  "third": "ordinal_3", "3rd": "ordinal_3",
  // Verbs
  "find": "action_find", "show": "action_show", "get": "action_show", "tell me": "action_show",
  "book": "action_book", "reserve": "action_book",
  "compare": "action_compare",
  // Locations
  "where": "question_where", "location": "question_where",
  "near": "near", "close to": "near", "close": "near", "nearby": "near",
  "far": "far", "far from": "far",
  // Amenity questions
  "has": "question_has", "have": "question_has", "does it have": "question_has",
  "any": "any",
});

// ═══════════════════════════════════════════════════════════════════
// ID (Bahasa Indonesia + slang) aliases
// ═══════════════════════════════════════════════════════════════════

const ID_ALIASES: Record<string, string> = Object.freeze({
  // Meals
  "sarapan": "breakfast", "makan pagi": "breakfast",
  // Amenities
  "kolam": "pool", "kolam renang": "pool",
  "parkir": "parking",
  "wifi": "wifi",
  "ac": "air_conditioning",
  "gym": "gym", "kebugaran": "gym",
  "restoran": "restaurant", "resto": "restaurant",
  "kafe": "cafe", "cafe": "cafe",
  "bar": "bar",
  "spa": "spa", "pijat": "spa",
  "lift": "elevator",
  "balkon": "balcony",
  // Rooms
  "kamar": "room", "kamar mandi": "bathroom",
  "tempat tidur": "bed", "kasur": "bed",
  "kapasitas": "capacity", "muat": "capacity",
  // Price
  "harga": "price", "berapa": "price",
  "murah": "price_cheap", "terjangkau": "price_cheap", "hemat": "price_cheap",
  "mahal": "price_expensive", "mewah": "price_expensive",
  // Time
  "malam ini": "tonight", "sekarang": "tonight",
  "besok": "tomorrow", "besuk": "tomorrow",
  // Location
  "dimana": "question_where", "di mana": "question_where", "lokasi": "question_where",
  "dekat": "near", "sekitar": "near",
  "jauh": "far",
  // Family
  "anak": "children", "anak-anak": "children", "keluarga": "family",
  "pasangan": "couples", "romantis": "couples", "bulan madu": "couples",
  // Categories (mostly already in EN dict but redundancy helps)
  "penginapan": "penginapan", "wisma": "wisma", "losmen": "losmen", "vila": "villa",
  // Verbs
  "cari": "action_find", "cariin": "action_find", "carikan": "action_find",
  "tunjukkan": "action_show", "tampilkan": "action_show", "lihat": "action_show",
  "pesan": "action_book", "booking": "action_book",
  // City shorthand
  "jogja": "yogyakarta", "yogya": "yogyakarta", "jogyakarta": "yogyakarta",
  // Amenity questions
  "punya": "question_has", "ada": "question_has", "apakah ada": "question_has",
  "berapa banyak": "question_count", "brp": "question_count",
});

// ═══════════════════════════════════════════════════════════════════
// Slang / typos / contractions
// ═══════════════════════════════════════════════════════════════════

const SLANG_ALIASES: Record<string, string> = Object.freeze({
  "u": "you", "r": "are", "n": "and", "ur": "your",
  "pls": "please", "plz": "please",
  "gaes": "guys", "sob": "brother",
  "kalo": "if", "gak": "not", "ga": "not", "ngga": "not", "nggak": "not",
  "gue": "i", "gw": "i", "aku": "i",
  "utk": "for", "utuk": "for",
  "tp": "but", "dgn": "with",
  "yg": "the", "yang": "that",
  "km": "you", "kamu": "you",
  "sm": "with", "sama": "with",
  "&": "and", "+": "and",
  "murmer": "price_cheap", "murah meriah": "price_cheap",
});

// ═══════════════════════════════════════════════════════════════════
// Master alias index · consolidated
// ═══════════════════════════════════════════════════════════════════

const ALIAS_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(EN_ALIASES)) m.set(k, v);
  for (const [k, v] of Object.entries(ID_ALIASES)) m.set(k, v);
  for (const [k, v] of Object.entries(SLANG_ALIASES)) m.set(k, v);
  return m;
})();

// ═══════════════════════════════════════════════════════════════════
// Normaliser · pure function
// ═══════════════════════════════════════════════════════════════════

/** Normalisation output. `canonical_tokens` is the ordered list of tokens
 *  after alias substitution. `unresolved` are tokens the dictionary didn't
 *  recognise — Gap Engine feed. */
export interface NormaliserResult {
  raw: string;
  cleaned: string;
  tokens: readonly string[];
  canonical_tokens: readonly string[];
  substitutions: readonly { from: string; to: string }[];
  unresolved: readonly string[];
  contained_question_mark: boolean;
}

const STOPWORDS = new Set([
  "a", "an", "the", "for", "with", "by", "of", "in", "at", "to", "on",
  "and", "or", "but", "so", "please", "hi", "hello", "hey",
  "di", "ke", "dari", "dengan", "untuk", "atas", "pada",
]);

function stripPunctuation(s: string): string {
  return s.replace(/[.,;!?"'`()\[\]{}—–-]/g, " ");
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Normalise a raw user query into canonical tokens.
 * Deterministic · zero embeddings · zero LLM.
 */
export function normalise(raw: string): NormaliserResult {
  const contained_question_mark = /\?/.test(raw);
  const lowered = String(raw ?? "").toLowerCase();
  const cleaned = collapseWhitespace(stripPunctuation(lowered));
  // Try longest-match phrase first (multi-word aliases like "swimming pool")
  const substitutions: { from: string; to: string }[] = [];
  let working = cleaned;
  // Multi-word aliases first
  const multiWordAliases = [...ALIAS_INDEX.keys()].filter((k) => k.includes(" ")).sort((a, b) => b.length - a.length);
  for (const alias of multiWordAliases) {
    const rx = new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "g");
    if (rx.test(working)) {
      const canonical = ALIAS_INDEX.get(alias)!;
      working = working.replace(rx, canonical);
      substitutions.push({ from: alias, to: canonical });
    }
  }
  // Single tokens
  const tokens = working.split(/\s+/).filter(Boolean);
  const canonical_tokens: string[] = [];
  const unresolved: string[] = [];
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    const canon = ALIAS_INDEX.get(t);
    if (canon) {
      canonical_tokens.push(canon);
      if (canon !== t) substitutions.push({ from: t, to: canon });
    } else {
      // Retain unrecognised token · may still match intent regex or be a proper noun
      canonical_tokens.push(t);
      unresolved.push(t);
    }
  }
  return {
    raw,
    cleaned,
    tokens,
    canonical_tokens,
    substitutions,
    unresolved,
    contained_question_mark,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Dictionary stats · used by tests + observability
// ═══════════════════════════════════════════════════════════════════

export function aliasDictionaryStats(): {
  en_aliases: number;
  id_aliases: number;
  slang_aliases: number;
  total_unique: number;
  stopwords: number;
} {
  return {
    en_aliases: Object.keys(EN_ALIASES).length,
    id_aliases: Object.keys(ID_ALIASES).length,
    slang_aliases: Object.keys(SLANG_ALIASES).length,
    total_unique: ALIAS_INDEX.size,
    stopwords: STOPWORDS.size,
  };
}
