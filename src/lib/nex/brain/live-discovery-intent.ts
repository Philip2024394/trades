// src/lib/nex/brain/live-discovery-intent.ts
//
// NEX · Phase D · LIVE_DISCOVERY_REQUEST intent detector
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D §17-§20
//
// PURPOSE
//   Pure detector that recognises natural-language Live discovery
//   requests ("what's happening tonight?" / "what's live" / "apa yang
//   sedang berlangsung malam ini?") and returns a structured scope
//   {time, city, category}. This module owns NO opinion about how the
//   scope is answered — that lives in `live-discovery-handler.ts`.
//
// DESIGN (mirrors decision-intent.ts bilingual token pattern):
//   · Token-set + light regex composition · never a hardcoded phrase
//     table.
//   · Bilingual EN + ID; language detection is heuristic (`detectLang`).
//   · Returns `NONE` conservatively — never guesses.
//
// IMMUTABLE RULES (§17 §18 §22 §35)
//   · No LLM invention here · deterministic classifier only.
//   · Never fabricates a category or a city if the text does not carry
//     that signal.
//   · Preserves conversation-brain G-gates by operating strictly on the
//     surface intent layer (this module never mutates memory, never
//     produces a reply · G03/G12/G15/G23/G24 all live downstream).
//
// PURE FUNCTION MODULE.  No I/O.  No React.  No DOM.

export type LiveDiscoveryLanguage = "EN" | "ID" | "MIXED" | "UNKNOWN";

export type LiveDiscoveryTimeScope =
  | "NOW"            // "what's live right now"
  | "TONIGHT"        // "tonight" / "malam ini"
  | "TODAY"          // "today" / "hari ini"
  | "UPCOMING"       // "coming up" / "soon"
  | "ANY";           // no explicit time in the ask

export type LiveDiscoveryCategoryScope =
  | "any"
  | "music"
  | "food"
  | "gym"
  | "events"
  | "hotel"
  | "venue"
  | "activity";

export type LiveDiscoveryScope = {
  is_live_discovery: boolean;
  language: LiveDiscoveryLanguage;
  time_scope: LiveDiscoveryTimeScope;
  category_scope: LiveDiscoveryCategoryScope;
  /** Explicit city name if the text carried one · null when the caller
   *  must resolve from session. Never guessed. */
  explicit_city: string | null;
  /** Reason string for observability · e.g. "en:live+tonight" · never
   *  a promise, always a machine label. */
  reason: string;
};

// ── Bilingual token sets ──────────────────────────────────────────

const LIVE_VERBS_EN = [
  "live", "happening", "on", "playing", "playing now", "going on",
  "on right now", "on now", "on tonight", "opening", "starting",
];
const LIVE_VERBS_ID = [
  "live", "sedang", "berlangsung", "terjadi", "ada acara", "ada apa",
  "ada yang", "malam ini", "sekarang",
];

const QUESTION_LEADS_EN = [
  "what", "what's", "whats", "is there", "are there", "anything", "any",
  "show me", "show", "tell me", "tell",
];
const QUESTION_LEADS_ID = [
  "apa", "adakah", "ada", "apakah", "tunjukkan", "tunjukan", "lihat",
  "kasih tau", "kasih tahu",
];

const TIME_TONIGHT_EN = [/\btonight\b/i, /\bthis evening\b/i, /\btonite\b/i];
const TIME_TONIGHT_ID = [/\bmalam ini\b/i, /\bnanti malam\b/i, /\bmalam nanti\b/i];
const TIME_NOW_EN = [/\bright now\b/i, /\bnow\b/i, /\bat the moment\b/i, /\bcurrently\b/i];
const TIME_NOW_ID = [/\bsekarang\b/i, /\bsaat ini\b/i, /\bbarusan\b/i];
const TIME_TODAY_EN = [/\btoday\b/i];
const TIME_TODAY_ID = [/\bhari ini\b/i];
const TIME_UPCOMING_EN = [/\bsoon\b/i, /\bcoming up\b/i, /\bstarting soon\b/i, /\bupcoming\b/i, /\blater\b/i];
const TIME_UPCOMING_ID = [/\bnanti\b/i, /\bsegera\b/i, /\bakan (?:datang|dimulai|mulai)\b/i];

// Category signals · very conservative · we only tag a category when
// the text explicitly names it. Everything else is "any" so the
// downstream handler can decide. Plurals accepted where natural.
const CATEGORY_HINTS: ReadonlyArray<[LiveDiscoveryCategoryScope, RegExp[]]> = [
  ["music",    [/\bmusic\b/i, /\bconcerts?\b/i, /\bgigs?\b/i, /\bdj\b/i, /\bbands?\b/i, /\bakustik\b/i, /\bmusik\b/i, /\bkonser\b/i]],
  ["food",     [/\brestaurants?\b/i, /\bfood\b/i, /\bwarung\b/i, /\bdinners?\b/i, /\bmakan\b/i, /\bresto\b/i, /\brumah makan\b/i]],
  ["gym",      [/\bgyms?\b/i, /\bboxing\b/i, /\btraining\b/i, /\bworkouts?\b/i, /\blatihan\b/i, /\btinju\b/i]],
  ["events",   [/\bevents?\b/i, /\bshows?\b/i, /\bfestivals?\b/i, /\bpertunjukan\b/i, /\bacara\b/i]],
  ["hotel",    [/\bhotels?\b/i, /\bpenginapan\b/i, /\bvillas?\b/i, /\bresorts?\b/i]],
  ["venue",    [/\bvenues?\b/i, /\brooftops?\b/i, /\bbars?\b/i, /\bclubs?\b/i, /\btempat\b/i]],
  ["activity", [/\brides?\b/i, /\btours?\b/i, /\bkegiatan\b/i, /\baktivitas\b/i, /\btur\b/i]],
];

// Explicit-city detector · MUST NOT guess · only common ID city names
// that also appear in the tonight fixtures.
const CITY_HINTS: ReadonlyArray<[string, RegExp]> = [
  ["yogyakarta", /\byogyakarta\b/i],
  ["yogyakarta", /\bjogja\b/i],
  ["yogyakarta", /\bjogjakarta\b/i],
  ["jakarta",    /\bjakarta\b/i],
  ["bali",       /\bbali\b/i],
  ["surabaya",   /\bsurabaya\b/i],
  ["bandung",    /\bbandung\b/i],
];

// ── Language detection · light heuristic ─────────────────────────

const ID_MARKERS = /\b(apa|apakah|adakah|ada|nanti|malam|hari|ini|sekarang|acara|kegiatan|sedang|berlangsung|tunjukkan|jogja|jakarta|yogyakarta|bali|malam nanti|nanti malam)\b/i;
const EN_MARKERS = /\b(what|is|there|any|show|tell|tonight|today|happening|live|going on)\b/i;

function detectLanguage(raw: string): LiveDiscoveryLanguage {
  const id = ID_MARKERS.test(raw);
  const en = EN_MARKERS.test(raw);
  if (id && en) return "MIXED";
  if (id) return "ID";
  if (en) return "EN";
  return "UNKNOWN";
}

// ── Core detector ────────────────────────────────────────────────
//
// Two layered checks — never one big regex per language:
//   · `hasLiveVerb`         → strong "live" / "live tonight" / "what's
//                             live" / "show me live" signal
//   · `hasHappeningStructure`→ softer "what's happening" / "anything
//                              on" · REQUIRES a time scope to avoid
//                              over-triggering on chit-chat like
//                              "anything interesting happening?"

function hasLiveVerbEN(raw: string): boolean {
  if (/\blive\b/i.test(raw) && /\b(tonight|now|today|right now|at the moment|soon|later)\b/i.test(raw)) return true;
  if (/\bwhat(?:'?s|s|\s+is)\s+live\b/i.test(raw)) return true;
  if (/\bshow me (?:what(?:'?s|s|\s+is)\s+)?live\b/i.test(raw)) return true;
  if (/\bany\s+(?:events?|shows?|gigs?|concerts?)\b/i.test(raw)) return true;
  return false;
}

function hasLiveVerbID(raw: string): boolean {
  if (/\blive\b/i.test(raw) && /\b(malam ini|hari ini|sekarang|nanti|nanti malam)\b/i.test(raw)) return true;
  if (/\bsedang (?:berlangsung|terjadi)\b/i.test(raw)) return true;
  if (/\bapa (?:ada|yang) (?:acara|kegiatan|pertunjukan)\b/i.test(raw)) return true;
  if (/\bapa yang (?:sedang|lagi) (?:berlangsung|terjadi|main)\b/i.test(raw)) return true;
  if (/\bada (?:acara|kegiatan) (?:malam|nanti|hari) ini\b/i.test(raw)) return true;
  return false;
}

function hasHappeningStructureEN(raw: string): boolean {
  if (/\bwhat(?:'?s|s|\s+is)\s+(?:happening|going on|on)\b/i.test(raw)) return true;
  if (/\banything\s+(?:happening|going on|on|live)\b/i.test(raw)) return true;
  // "any <category> happening|live|on tonight" · category is one of
  // the CATEGORY_HINTS lexicon so we don't over-match unrelated nouns.
  if (/\bany\s+(?:music|food|gyms?|events?|shows?|gigs?|concerts?|festivals?|activities|restaurants?|hotels?|venues?|clubs?|bars?)\s+(?:happening|going on|live|on)\b/i.test(raw)) return true;
  return false;
}

function hasHappeningStructureID(raw: string): boolean {
  if (/\bapa (?:yang )?(?:sedang|lagi)\s+(?:terjadi|berlangsung|main)\b/i.test(raw)) return true;
  if (/\bapa (?:yang )?ada\s+(?:malam ini|hari ini|sekarang|nanti)\b/i.test(raw)) return true;
  return false;
}

function inferTimeScope(raw: string, lang: LiveDiscoveryLanguage): LiveDiscoveryTimeScope {
  const useEN = lang === "EN" || lang === "MIXED" || lang === "UNKNOWN";
  const useID = lang === "ID" || lang === "MIXED";
  const test = (arr: RegExp[]) => arr.some((r) => r.test(raw));
  if ((useEN && test(TIME_NOW_EN)) || (useID && test(TIME_NOW_ID))) return "NOW";
  if ((useEN && test(TIME_TONIGHT_EN)) || (useID && test(TIME_TONIGHT_ID))) return "TONIGHT";
  if ((useEN && test(TIME_TODAY_EN)) || (useID && test(TIME_TODAY_ID))) return "TODAY";
  if ((useEN && test(TIME_UPCOMING_EN)) || (useID && test(TIME_UPCOMING_ID))) return "UPCOMING";
  return "ANY";
}

function inferCategoryScope(raw: string): LiveDiscoveryCategoryScope {
  for (const [cat, regs] of CATEGORY_HINTS) {
    if (regs.some((r) => r.test(raw))) return cat;
  }
  return "any";
}

function inferExplicitCity(raw: string): string | null {
  for (const [city, rx] of CITY_HINTS) {
    if (rx.test(raw)) return city;
  }
  return null;
}

const NONE_SCOPE: LiveDiscoveryScope = {
  is_live_discovery: false,
  language: "UNKNOWN",
  time_scope: "ANY",
  category_scope: "any",
  explicit_city: null,
  reason: "no_live_signal",
};

export function detectLiveDiscoveryScope(message: string): LiveDiscoveryScope {
  const raw = (message ?? "").trim();
  if (raw.length === 0) return NONE_SCOPE;

  const lang = detectLanguage(raw);
  const time = inferTimeScope(raw, lang);
  const category = inferCategoryScope(raw);
  const city = inferExplicitCity(raw);

  const liveHit = hasLiveVerbEN(raw) || hasLiveVerbID(raw);
  if (liveHit) {
    return {
      is_live_discovery: true,
      language: lang,
      time_scope: time,
      category_scope: category,
      explicit_city: city,
      reason: `${lang.toLowerCase()}:live${time !== "ANY" ? "+" + time.toLowerCase() : ""}${category !== "any" ? "+" + category : ""}`,
    };
  }

  // Second-chance · softer "happening" structure REQUIRES a time
  // scope to avoid over-triggering. "anything interesting happening?"
  // → NONE. "what's going on tonight?" → LIVE_DISCOVERY.
  const happeningHit = hasHappeningStructureEN(raw) || hasHappeningStructureID(raw);
  if (happeningHit && time !== "ANY") {
    return {
      is_live_discovery: true,
      language: lang,
      time_scope: time,
      category_scope: category,
      explicit_city: city,
      reason: `${lang.toLowerCase()}:happening+${time.toLowerCase()}${category !== "any" ? "+" + category : ""}`,
    };
  }

  return NONE_SCOPE;
}
