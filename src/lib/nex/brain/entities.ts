// src/lib/nex/brain/entities.ts
//
// Stage 3.14 · Phase 7 · Entity Intelligence (Philip 2026-08-31).
//
// Deterministic entity extraction + session-level entity capture.
// Distinguishes:
//   · Entities MENTIONED by the user in their message
//     (places, areas, ordinals, pronouns, dates, quantities, urls/phones/emails)
//   · Entities PRESENTED by NEX in a prior reply
//     (real property names surfaced from World retrieval)
//
// This is the foundation Reference Resolution ("the second one", "it",
// "that one") + Comparison + Recommendation will consume. v1 captures
// + persists · Reference Resolution is Phase 8 candidate.
//
// v1 is scope-conservative:
//   · Deterministic regex + vocabulary tables · no LLM
//   · Bilingual English + Bahasa Indonesia
//   · Session-scoped · rolling window of last 30 mentions
//   · Attached to the response for observability
//
// Not covered in v1 (deferred to Reference Resolution phase): actual
// resolution of pronouns/ordinals to specific entities. This module
// only EXTRACTS + CAPTURES.

export type EntityKind =
  | "place"           // city / country / region ("Yogyakarta", "Bali")
  | "area"            // sub-city area ("Malioboro", "Prawirotaman")
  | "business_name"   // named business surfaced by NEX ("Griya Sentana")
  | "ordinal"         // "the second", "the first", "urutan pertama"
  | "pronoun"         // "it", "that one", "these", "itu", "yang ini"
  | "date_ref"        // "tonight", "tomorrow", "besok"
  | "quantity"        // "2 people", "3 nights", "2 orang"
  | "phone"
  | "email"
  | "url"
  | "money";          // "IDR 500,000", "$50"

export type EntitySource = "user_message" | "nex_reply";

export type RecognisedEntity = {
  /** Stable id within a session (kind + slugified canonical). */
  id: string;
  kind: EntityKind;
  /** Canonical form (lowercase, normalised). */
  canonical: string;
  /** Original span from the message (for provenance). */
  raw: string;
  /** Who said it. */
  source: EntitySource;
  /** When (session-relative). Persisted as ISO for portability. */
  atIso: string;
  /** Optional stable reference id for business entities (e.g. OSM node id). */
  refId?: string;
  /** For business entities surfaced by NEX · the position in the presented list.
   *  Enables future "the second one" resolution. */
  presentedOffset?: number;
};

// ─── Vocabulary tables ────────────────────────────────────────────────

const PLACES: Array<[RegExp, string]> = [
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

const AREAS: Array<[RegExp, string]> = [
  [/\bmalioboro\b/i, "malioboro"],
  [/\bprawirotaman\b/i, "prawirotaman"],
  [/\bkraton\b/i, "kraton"],
  [/\bkotagede\b/i, "kotagede"],
  [/\btugu\b/i, "tugu"],
  [/\bgondomanan\b/i, "gondomanan"],
];

const ORDINALS: Array<[RegExp, string]> = [
  [/\b(first|1st)\b/i, "first"],
  [/\b(second|2nd)\b/i, "second"],
  [/\b(third|3rd)\b/i, "third"],
  [/\b(fourth|4th)\b/i, "fourth"],
  [/\b(fifth|5th)\b/i, "fifth"],
  [/\bpertama\b/i, "first"],
  [/\bkedua\b/i, "second"],
  [/\bketiga\b/i, "third"],
];

const PRONOUNS: Array<[RegExp, string]> = [
  [/\bthat one\b/i, "that_one"],
  [/\bthese\b/i, "these"],
  [/\bthose\b/i, "those"],
  [/\byang (ini|itu)\b/i, "yang_this"],
  [/\bitu\b/i, "itu"],
  // "it" alone is highly ambiguous — only capture in strong contexts
  [/\b(book|buy|reserve|open) it\b/i, "it"],
];

const DATE_REFS: Array<[RegExp, string]> = [
  [/\b(tonight|malam ini)\b/i, "tonight"],
  [/\b(tomorrow|besok)\b/i, "tomorrow"],
  [/\bthis (weekend|weekender)\b/i, "this-weekend"],
  [/\bnext (weekend|weekender)\b/i, "next-weekend"],
  [/\bakhir pekan\b/i, "weekend"],
];

const QUANTITY_PATTERNS: Array<{ rx: RegExp; group: number; unit: string }> = [
  { rx: /\b(\d+)\s+(people|adults|guests|orang|pax)\b/i, group: 1, unit: "guests" },
  { rx: /\b(\d+)\s+(nights?|malam)\b/i, group: 1, unit: "nights" },
  { rx: /\b(\d+)\s+(rooms?|kamar)\b/i, group: 1, unit: "rooms" },
];

const PHONE_RE = /\b(\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b/;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const URL_RE = /\bhttps?:\/\/[a-z0-9./?=&#%_+~:@-]+/i;
const MONEY_RE = /\b(idr|rp|usd|\$|sgd|myr|aud)\s?\d[\d,.]*\b/i;

// ─── Extraction ──────────────────────────────────────────────────────

function slug(canonical: string): string {
  return canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function push(seen: Set<string>, out: RecognisedEntity[], entity: RecognisedEntity): void {
  if (seen.has(entity.id)) return;
  seen.add(entity.id);
  out.push(entity);
}

/** Extract entities from a user message. Deterministic · bilingual. */
export function extractEntities(message: string, atIso: string = new Date().toISOString()): RecognisedEntity[] {
  const raw = message ?? "";
  const out: RecognisedEntity[] = [];
  const seen = new Set<string>();

  const scan = (kind: EntityKind, pack: Array<[RegExp, string]>): void => {
    for (const [rx, canonical] of pack) {
      const m = raw.match(rx);
      if (m) push(seen, out, {
        id: `${kind}:${slug(canonical)}`,
        kind, canonical, raw: m[0],
        source: "user_message", atIso,
      });
    }
  };

  scan("place", PLACES);
  scan("area", AREAS);
  scan("ordinal", ORDINALS);
  scan("pronoun", PRONOUNS);
  scan("date_ref", DATE_REFS);

  for (const q of QUANTITY_PATTERNS) {
    const m = raw.match(q.rx);
    if (m) push(seen, out, {
      id: `quantity:${q.unit}:${m[q.group]}`,
      kind: "quantity",
      canonical: `${m[q.group]} ${q.unit}`,
      raw: m[0],
      source: "user_message", atIso,
    });
  }

  const singles: Array<[RegExp, EntityKind]> = [
    [PHONE_RE, "phone"], [EMAIL_RE, "email"], [URL_RE, "url"], [MONEY_RE, "money"],
  ];
  for (const [rx, kind] of singles) {
    const m = raw.match(rx);
    if (m) push(seen, out, {
      id: `${kind}:${slug(m[0])}`,
      kind, canonical: m[0].toLowerCase(), raw: m[0],
      source: "user_message", atIso,
    });
  }

  return out;
}

/** Capture business entities NEX just PRESENTED in a reply. Consumed
 *  from the composer's hits (real property records). Presented offsets
 *  are 1-indexed so "the second one" (ordinal="second") maps naturally
 *  when Reference Resolution lands. */
export function capturePresentedBusinesses(
  hits: ReadonlyArray<{ id?: string; name?: string | null; category?: string }>,
  atIso: string = new Date().toISOString(),
): RecognisedEntity[] {
  const out: RecognisedEntity[] = [];
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (!h?.name) continue;
    out.push({
      id: `business_name:${slug(h.name)}`,
      kind: "business_name",
      canonical: h.name.toLowerCase(),
      raw: h.name,
      source: "nex_reply",
      atIso,
      refId: h.id,
      presentedOffset: i + 1,
    });
  }
  return out;
}

/** Merge new entities into a rolling window, keeping the most-recent
 *  N unique by id. Older duplicates are removed. */
export function mergeEntityWindow(
  prior: ReadonlyArray<RecognisedEntity>,
  next: ReadonlyArray<RecognisedEntity>,
  windowSize = 30,
): RecognisedEntity[] {
  const seen = new Set<string>();
  const combined: RecognisedEntity[] = [];
  // Newest first so uniqueness keeps newest.
  for (const e of [...next].reverse().concat([...prior].reverse())) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    combined.push(e);
    if (combined.length >= windowSize) break;
  }
  // Restore chronological order (oldest first).
  return combined.reverse();
}

/** Find the most-recently PRESENTED business at a given 1-indexed
 *  offset. Used by future Reference Resolution ("the second one"). */
export function findPresentedBusinessByOffset(
  window: ReadonlyArray<RecognisedEntity>,
  offset: number,
): RecognisedEntity | undefined {
  // Group by atIso to find "the most recent presentation batch".
  const presented = window.filter((e) => e.kind === "business_name" && e.source === "nex_reply");
  if (presented.length === 0) return undefined;
  const mostRecentIso = presented[presented.length - 1].atIso;
  const batch = presented.filter((e) => e.atIso === mostRecentIso);
  return batch.find((e) => e.presentedOffset === offset);
}
