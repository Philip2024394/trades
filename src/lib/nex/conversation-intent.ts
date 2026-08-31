// NEX AI · Conversation Intent Gate.
//
// A deterministic-first classifier that runs BEFORE any specialist
// agent or deterministic keyword router. Its job is a safety
// boundary: prevent specialist agents from receiving ordinary
// conversation.
//
// This is DIFFERENT from src/lib/nex/intent.ts — that file is the
// merchant-side Studio/BI/CX action classifier (invoke_studio,
// edit_brand, etc.). THIS file is the visitor-side conversation gate
// that answers "should this go to a specialist or not?"
//
// The gate is used at two entry points:
//   1. src/app/api/nex/general-chat/route.ts — routes the shell-FAB
//      + /nex-app/chat surface. Historically UK-trade-only; the gate
//      lets ID/tourism/food/general-conversation messages skip the
//      trade cascade.
//   2. Any future specialist entry (staircase, calculators, etc.)
//      MUST call assertSpecialistIntent(intent, "staircase") before
//      accepting a message.
//
// Design tenets (Philip 2026-08-30):
//   · Deterministic where possible. A pattern-match tells us "this is
//     clearly conversation" without any LLM call.
//   · LLM-optional for genuinely ambiguous cases (not implemented in
//     v1 · deterministic pack is sufficient for the Guardian corpus).
//   · Never route conversation to a specialist. "Hi NEX" MUST never
//     open the staircase agent. The Guardian enforces this.
//   · Indonesia-first: knowledge / tourism / food are first-class
//     intents, not fallthrough cases.

export type NexConversationIntent =
  | "conversation"     // greetings, chit-chat, meta questions about NEX
  | "indonesia"        // stable knowledge about Indonesia
  | "tourism"          // travel planning, itineraries, destinations (non-lodging)
  | "accommodation"    // hotel/guesthouse/villa/kos/homestay/penginapan/lodging — Philip 2026-08-31 · own vertical
  | "food"             // dishes, restaurants, cuisine questions
  | "places"           // "near me", location discovery (non-food)
  | "business"         // find/hire a business, trade, service
  | "marketplace"      // buy/sell listings
  | "commerce"         // buy a product — headphones/phone/laptop/etc · Philip 2026-08-31 Stage 3.19
  | "booking"          // book a hotel, table, appointment
  | "weather"          // real-time weather (live data)
  | "translation"      // "how do you say X in Indonesian"
  | "writing"          // help write something
  | "image"            // vision / image understanding
  | "staircase"        // genuine staircase request — spec, quote, calculate
  | "trades"           // plumber, electrician, kitchen, bathroom, other UK-trade
  | "quotation"        // generic quote / price / estimate
  | "documents"        // upload/parse a doc, invoice, receipt
  | "other";           // deliberately-classified as none-of-the-above

export type ConversationClassification = {
  intent: NexConversationIntent;
  /** How confident we are, 0..1. Deterministic hits → 0.85+. */
  confidence: number;
  /** Machine-readable reason · e.g. "keyword:staircase", "greeting",
   *  "indonesia_place_name", "default_conversation_no_specialist_signal". */
  reason: string;
  /** Optional secondary intent · surfaces when the message plausibly
   *  spans two categories ("book me a hotel in Ubud" → booking + indonesia). */
  secondary?: NexConversationIntent;
};

// ─── Deterministic pattern packs ──────────────────────────────────

const GREETINGS = [
  /^(hi|hello|hey|halo|hai|howdy|yo|hola)\b/i,
  /\bhow are you\b/i,
  /\bapa kabar\b/i,
  /\bselamat (pagi|siang|sore|malam)\b/i,
  /\bgood (morning|afternoon|evening)\b/i,
];

const META_ABOUT_NEX = [
  /\bwhat can (you|nex) do\b/i,
  /\bwho are you\b/i,
  /\btell me about (yourself|nex)\b/i,
  /\bkamu siapa\b/i,
  /\bapa itu nex\b/i,
];

const SMALL_TALK = [
  /\btell me (something|a) (interesting|joke|story|fact)\b/i,
  /\bceritakan\b.*\b(sesuatu|lucu|menarik|cerita)\b/i,
  /^(thanks|thank you|terima kasih|makasih|ok|okay|sure|cool|nice)\b\.?$/i,
];

const INDONESIA_CORE = [
  /\bindonesia\b/i,
  /\b(bali|jakarta|yogyakarta|jogja|bandung|surabaya|medan|makassar|semarang|solo|malang)\b/i,
  /\b(lombok|flores|komodo|labuan bajo|raja ampat|sumatra|sulawesi|java|jawa|kalimantan|papua)\b/i,
  /\b(borobudur|prambanan|bromo|ijen|rinjani)\b/i,
  /\b(ubud|canggu|seminyak|sanur|kuta|nusa dua|uluwatu|jimbaran)\b/i,
];

const FOOD_TERMS = [
  /\b(nasi goreng|mie goreng|gado[- ]?gado|rendang|sate|satay|bakso|soto|nasi padang|nasi campur|bubur|martabak|pisang goreng|ayam bakar|ayam goreng|es teler|es campur)\b/i,
  /\b(gudeg|pempek|bakmi|babi guling|ayam geprek|ayam taliwang|nasi kuning|ketupat|tumpeng|lawar|betutu|dendeng|opor|semur)\b/i,
  /\b(warung|padang|padangan)\b/i,
  /\b(food|makanan|dish|dishes|cuisine|kuliner)\b/i,
  /\b(what|apa) (to eat|should i eat|makan)\b/i,
  /\brestaurant recommendation\b/i,
  /\bhalal\b/i,
];

// ACCOMMODATION · Philip 2026-08-31 · a distinct NEX vertical that beats
// TOURISM for lodging-specific queries. Bilingual (English + Bahasa
// Indonesia). Covers hotel/guesthouse/homestay/villa/hostel/resort/kos +
// natural phrasings ("where can I stay", "cari penginapan"). Placed
// BEFORE TOURISM in the classifier so a lodging request routes to
// accommodation, not generic tourism.
const ACCOMMODATION = [
  // Direct lodging types · single-word queries + short phrases
  /\b(hotel|hotels|guest\s?house|guesthouses?|homestays?|penginapan|hostels?|villas?|resorts?|kos|kost|kos[- ]kosan|apartemen|apartment)\b/i,
  // Umbrella "accommodation" vocabulary (English + typo + Indonesian)
  /\b(accommodations?|accomodations?|akomodasi|lodging|lodgings)\b/i,
  // Natural language: "where to stay", "somewhere to stay", place-to-stay
  /\bwhere (to|should i|can i|do i) stay\b/i,
  /\b(place|places|somewhere) to stay\b/i,
  /\btempat menginap\b/i,
  /\btempat tinggal\b/i,
  // "I need X" · "cari X" · "butuh X" · "book X" bindings with lodging
  /\b(i need|i want|i'?m looking for|find me|show me|help me find)\s+(a |an |some )?(hotel|guest\s?house|guesthouse|homestay|hostel|villa|resort|kos|penginapan|accommodations?|akomodasi|lodging|room|somewhere to stay|place to stay)/i,
  /\b(cari|butuh|mau|perlu)\s+(hotel|penginapan|homestay|villa|kos|akomodasi|tempat menginap)/i,
  // "hotel dekat X" / "hotel murah" · Indonesian modifiers
  /\bhotel\s+(dekat|murah|mewah|bintang|untuk|dengan)\b/i,
  /\bpenginapan\s+(dekat|murah|untuk|dengan)\b/i,
  // "menginap" (Indonesian verb for staying overnight) covers "mau
  // menginap di Ubud" · "nginep" is the informal spelling.
  /\b(menginap|nginep)\b/i,
  // "book me a hotel" · booking action still routes here so the reply
  // can carry accommodation guidance (BOOKING handler intercepts later
  // when the classifier sees `book`).
];

const TOURISM = [
  /\b(plan (me )?a (trip|holiday|vacation|itinerary))\b/i,
  /\b(itinerary|itinerar)\b/i,
  /\b(day trip|weekend trip|3 (days?|hari)|4 (days?|hari)|week in)\b/i,
  /\b(what (to|should i) do in)\b/i,
  /\b(sights?|attractions?|things to do|tempat wisata|wisata)\b/i,
  // Lodging vocabulary moved to ACCOMMODATION regex pack above
  // (Philip 2026-08-31 · accommodation as its own vertical) · tourism
  // now only matches trip/itinerary/visit-planning language.
  /\b(visiting|travel(l)?ing|landing|arriving) in\b/i,
  /\bi'?m (in|going to|visiting)\s+\w+/i,
];

const BUSINESS_LOOKUP = [
  /\bfind (me )?(a |an )?(restaurant|cafe|coffee|business|shop|store|dentist|doctor|clinic|gym|spa|hotel|guest\s?house|guesthouse|homestay|hostel|villa|resort|accommodations?|accomodations?|akomodasi|lodging)\b/i,
  /\bcari(kan)?\s+(saya\s+)?(restoran|cafe|kafe|warung|toko|hotel|dokter|klinik|akomodasi|penginapan|homestay|villa|kos|tempat)\b/i,
  /\bnear me\b/i,
  /\bdi sekitar (sini|saya)\b/i,
  /\brecommend (a |an |me )?(restaurant|cafe|hotel|guest\s?house|guesthouse|homestay|hostel|villa|resort|accommodations?|accomodations?|akomodasi|lodging|place)\b/i,
];

// COMMERCE · Philip 2026-08-31 · Stage 3.19 · commerce Brain intent.
// Matches "buy me headphones" / "find me a phone" / "beli headphone" /
// "cari laptop" style product asks. Distinct from accommodation
// (hotel/guesthouse) · food (nasi goreng/restaurant) · business
// (find me a plumber). Product nouns cover the top consumer categories.
const COMMERCE = [
  // English · "buy/find/looking for/need/order [me|for me]? [a|an|some]? [product]"
  //   · "buy headphones", "buy me headphones", "buy me a phone",
  //     "find me a laptop", "get me some earbuds", "shopping for a bag"
  /\b(buy|purchase|order|shop for|shopping for|get me|need|looking for|find me|find a|show me)\s+(me\s+|for me\s+)?(a |an |some )?(headphones?|earbuds?|speaker|phone|smartphone|laptop|computer|camera|tablet|tv|television|monitor|shoes|clothes|clothing|bag|watch|book|game|toy|appliance|furniture|electronics)\b/i,
  // Bahasa · "beli/cari/mau/butuh [product]"
  /\b(beli|belanja|cari|pesan|mau|butuh|perlu)\s+(sebuah\s+)?(headphone|earbud|speaker|hp|handphone|smartphone|laptop|komputer|kamera|tablet|tv|monitor|sepatu|baju|pakaian|tas|jam|buku|mainan|elektronik)\b/i,
  // Where to buy / recommend a product
  /\b(where can i buy|where to buy)\b.*\b(headphones?|phone|laptop|camera|shoes|bag|watch|electronics)\b/i,
  /\b(recommend|suggest)\s+(a |an )?(brand of|model of)\s+\w+/i,
];

const BOOKING = [
  /\bbook (me )?(a |an )?(hotel|room|table|flight|driver|car|tour|guide)\b/i,
  /\bpesan(kan)?\s+(saya\s+)?(hotel|kamar|meja|penerbangan|tiket|mobil)\b/i,
  /\breserve (a |an )?(table|room|seat)\b/i,
];

const WEATHER = [
  /\bweather\b/i,
  /\bcuaca\b/i,
  /\bis it (raining|sunny|hot)\b/i,
  /\btemperature (in|today|now|outside)\b/i,
  /\bforecast\b/i,
];

const TRANSLATION = [
  /\bhow (do you )?say\b/i,
  /\bbagaimana (cara )?mengucapkan\b/i,
  /\btranslate (this|to|from|it)\b/i,
  /\bapa (bahasa|artinya)\b/i,
  /\bin indonesian\b/i,
  /\bin (english|bahasa)\b/i,
];

const IMAGE_HINT = [
  /\b(look at|analyse|analyze|describe|read|caption)\s+(this|the)?\s*(image|picture|photo|screenshot|gambar|foto)\b/i,
  /\bwhat.?s? in (this|the) (image|picture|photo)\b/i,
];

// STAIRCASE keywords use `\b...\b` to avoid matching "understair" or
// substrings inside unrelated words. If the message mentions ANY of
// these + a spec/quote verb, it's a real staircase request. If it
// only mentions "stairs" in casual context ("stairs are hard"), the
// downstream code can weigh confidence — v1 treats any staircase
// keyword as intent:staircase, and lets the specialist itself
// decide whether it can help.
const STAIRCASE = [
  /\bstaircases?\b/i,
  /\bstairway\b/i,
  /\bstairs?\b/i,
  /\bbalustrade\b/i,
  /\bbanister\b/i,
  /\bnewel\b/i,
  /\brise (and|&) going\b/i,
  /\bwinder(ed)?\s+stair/i,
  /\bhandrail\b/i,
  /\btread(s)?\s+(and|&)?\s*riser/i,
];

const OTHER_TRADES = [
  /\b(plumb(er|ing)?|leak(ing)?|boiler|radiator|drain)\b/i,
  /\b(electric(al|ian)?|wiring|socket|fuse|rewire)\b/i,
  /\b(kitchen (fit|design|install|renovation))\b/i,
  /\b(bathroom (fit|design|install|refit))\b/i,
  /\b(loft (conversion|extension))\b/i,
  /\b(extension|renovation|refurb(ishment)?)\b/i,
];

const QUOTATION = [
  /\b(quotation|quote|estimate|price)\b.*\b(for|on|to|my|the)\b/i,
  /\bhow much (does|is|would)\b/i,
  /\bapa harganya\b/i,
  /\bberapa (harga|biaya)\b/i,
];

const DOCUMENTS = [
  /\b(upload|attach|parse|extract)\s+(this|a|the)?\s*(pdf|invoice|receipt|document|kwitansi|nota)\b/i,
  /\bread (this|the) (pdf|receipt|invoice|document)\b/i,
];

const WRITING = [
  /\b(write|draft|compose|help me write)\b\s+(a|an|the|this)?\s*(email|message|reply|post|caption|note|letter)\b/i,
  /\btolong (tulis|buatkan|bantu tulis)\b/i,
];

// ─── The classifier ────────────────────────────────────────────────

export function classifyConversationIntent(
  message: string,
  opts: { hasImage?: boolean; userMarket?: "ID" | "UK" | "US" } = {},
): ConversationClassification {
  // Vision beats everything — images route to vision regardless of text.
  if (opts.hasImage) return { intent: "image", confidence: 1, reason: "image_attached" };

  const raw = message.trim();
  if (raw.length === 0) return { intent: "conversation", confidence: 0.5, reason: "empty_message" };

  // 1. Conversational signals FIRST · greetings/meta/small-talk must
  //    beat everything else. "Hello NEX, tell me about stairs one day"
  //    is a greeting, not a staircase request.
  for (const rx of GREETINGS) if (rx.test(raw)) return { intent: "conversation", confidence: 1, reason: "greeting" };
  for (const rx of META_ABOUT_NEX) if (rx.test(raw)) return { intent: "conversation", confidence: 0.95, reason: "meta_about_nex" };
  for (const rx of SMALL_TALK) if (rx.test(raw)) return { intent: "conversation", confidence: 0.9, reason: "small_talk" };

  // 2. Explicit specialist signals · staircase, image, documents.
  //    These must match BEFORE the more general Indonesia/food/tourism
  //    signals so "calculate my staircase" is staircase, not
  //    quotation, and so images always beat text patterns.
  for (const rx of IMAGE_HINT) if (rx.test(raw)) return { intent: "image", confidence: 0.95, reason: "keyword:image" };
  for (const rx of STAIRCASE) if (rx.test(raw)) {
    // Market boundary · Philip 2026-08-31 doctrine.
    // The UK staircase cascade is UK-scoped knowledge · UK Building
    // Regs Part K, UK materials (oak/walnut/glass), UK terminology.
    // An Indonesian user asking about a staircase must NOT drop into
    // that cascade. We DO NOT ban the keyword · we route the same
    // topic within the user's market context. When userMarket=ID,
    // return an Indonesia-scoped intent (with a staircase secondary
    // hint) so downstream can retrieve Indonesian construction data
    // (or honestly say "no Indonesian staircase knowledge yet"·when
    // the corpus doesn't have it).
    if (opts.userMarket === "ID") {
      return { intent: "indonesia", confidence: 0.9, reason: `keyword:${firstMatch(raw, STAIRCASE)}_id_market`, secondary: "staircase" };
    }
    return { intent: "staircase", confidence: 0.95, reason: `keyword:${firstMatch(raw, STAIRCASE)}` };
  }
  for (const rx of DOCUMENTS) if (rx.test(raw)) return { intent: "documents", confidence: 0.9, reason: "keyword:document" };

  // 3. Action signals · booking / translation / weather / quotation /
  //    writing / business lookup.
  for (const rx of BOOKING) if (rx.test(raw)) return withIndonesia({ intent: "booking", confidence: 0.9, reason: "keyword:booking" }, raw);
  for (const rx of TRANSLATION) if (rx.test(raw)) return { intent: "translation", confidence: 0.9, reason: "keyword:translation" };
  for (const rx of WEATHER) if (rx.test(raw)) return withIndonesia({ intent: "weather", confidence: 0.9, reason: "keyword:weather" }, raw);
  for (const rx of QUOTATION) if (rx.test(raw)) {
    // Same market boundary as staircase · a quotation request from
    // an Indonesian user is Indonesian-market work, not the UK
    // quotation cascade.
    if (opts.userMarket === "ID") {
      return { intent: "indonesia", confidence: 0.85, reason: "keyword:quotation_id_market", secondary: "quotation" };
    }
    return { intent: "quotation", confidence: 0.85, reason: "keyword:quotation" };
  }
  // ACCOMMODATION vertical check placed BEFORE BUSINESS_LOOKUP so
  // "find me a hotel" / "cari penginapan" route to accommodation, not
  // generic business lookup. Philip 2026-08-31.
  for (const rx of ACCOMMODATION) if (rx.test(raw)) return withIndonesia({ intent: "accommodation", confidence: 0.88, reason: `keyword:${firstMatch(raw, ACCOMMODATION)}` }, raw);
  // COMMERCE vertical check · Philip 2026-08-31 Stage 3.19 · placed
  // BEFORE BUSINESS_LOOKUP so "buy me headphones" routes to commerce,
  // not to the generic directory lookup for a business.
  for (const rx of COMMERCE) if (rx.test(raw)) return withIndonesia({ intent: "commerce", confidence: 0.88, reason: `keyword:${firstMatch(raw, COMMERCE)}` }, raw);
  for (const rx of WRITING) if (rx.test(raw)) return { intent: "writing", confidence: 0.85, reason: "keyword:writing" };
  for (const rx of BUSINESS_LOOKUP) if (rx.test(raw)) return withIndonesia({ intent: hitsAnyFood(raw) ? "food" : "business", confidence: 0.9, reason: "keyword:business_lookup" }, raw);

  // 4. Food and tourism · common Indonesia-tourist categories.
  if (hitsAnyFood(raw)) return withIndonesia({ intent: "food", confidence: 0.85, reason: "food_terms" }, raw);
  // ACCOMMODATION already handled higher up (step 3.5, before BUSINESS_LOOKUP).
  for (const rx of TOURISM) if (rx.test(raw)) return withIndonesia({ intent: "tourism", confidence: 0.85, reason: "keyword:tourism" }, raw);

  // 5. Indonesia knowledge · mentions a place / country / region.
  for (const rx of INDONESIA_CORE) if (rx.test(raw)) return { intent: "indonesia", confidence: 0.85, reason: "indonesia_place_or_country" };

  // 6. Other UK-trade signals (fallback to legacy general-chat cascade
  //    when it applies). Market-gated · Indonesian users don't get
  //    routed to the UK plumber/electrician/kitchen cascade.
  for (const rx of OTHER_TRADES) if (rx.test(raw)) {
    if (opts.userMarket === "ID") {
      return { intent: "indonesia", confidence: 0.85, reason: "keyword:trades_id_market", secondary: "business" };
    }
    return { intent: "trades", confidence: 0.85, reason: "keyword:trades" };
  }

  // 7. Default: conversation. If we couldn't find any specialist or
  //    knowledge signal, treat this as chit-chat, not a specialist.
  //    This is the safety boundary that keeps the staircase agent
  //    from being a catch-all.
  return { intent: "conversation", confidence: 0.5, reason: "default_conversation_no_specialist_signal" };
}

/** Guard used by specialist entry points. Throws if the intent isn't
 *  what the specialist expects. Never call a specialist without this. */
export function assertSpecialistIntent(intent: NexConversationIntent, expected: NexConversationIntent): void {
  if (intent !== expected) {
    throw new Error(`[nex/conversation-intent] specialist '${expected}' refused to handle intent '${intent}' · use the general conversation path`);
  }
}

// ─── helpers ──────────────────────────────────────────────────────

function hitsAnyFood(message: string): boolean {
  for (const rx of FOOD_TERMS) if (rx.test(message)) return true;
  return false;
}

function firstMatch(message: string, packs: RegExp[]): string {
  for (const rx of packs) {
    const m = message.match(rx);
    if (m) return (m[0] || "").toLowerCase().slice(0, 30);
  }
  return "unknown";
}

/** When a message hits an action intent AND mentions an Indonesian
 *  place, surface Indonesia as the secondary signal so knowledge/live
 *  data can be combined downstream. */
function withIndonesia(cl: ConversationClassification, message: string): ConversationClassification {
  for (const rx of INDONESIA_CORE) if (rx.test(message)) return { ...cl, secondary: "indonesia" };
  return cl;
}
