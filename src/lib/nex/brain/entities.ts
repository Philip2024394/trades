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
  // Indonesian bare ordinals · pertama/kedua/ketiga/keempat/kelima.
  // Word-boundary anchored · "yang pertama" naturally contains
  // "pertama" · "yang kedua" naturally contains "kedua" · etc.
  [/\bpertama\b/i, "first"],
  [/\bkedua\b/i, "second"],
  [/\bketiga\b/i, "third"],
  [/\bkeempat\b/i, "fourth"],
  [/\bkelima\b/i, "fifth"],
  // Stage 3.41.j · composite Indonesian ordinals · "nomor satu" ·
  // "nomor dua" · "nomor tiga" · "nomor empat" · "nomor lima" ·
  // plus digit form "nomor 1" · "nomor 2" etc. Also naturally covers
  // "yang nomor dua" (because the word-boundary matches between
  // "yang " and "nomor"). Requires an explicit number after "nomor"
  // so bare "nomor" does not resolve · fail-closed.
  [/\bnomor\s+(satu|1)\b/i, "first"],
  [/\bnomor\s+(dua|2)\b/i, "second"],
  [/\bnomor\s+(tiga|3)\b/i, "third"],
  [/\bnomor\s+(empat|4)\b/i, "fourth"],
  [/\bnomor\s+(lima|5)\b/i, "fifth"],
  // Stage 3.41.m · code-switch reference glue (Philip 2026-08-31).
  //
  // Positional / temporal references — resolved dynamically against the
  // presented batch + session.currentReference. Kept intentionally
  // narrow with the "yang X" / "the X one" scaffolding so bare "last" /
  // "previous" in mid-sentence contexts ("last week" · "at last" ·
  // "the previous meeting") do NOT extract as reference tokens.
  //
  //   canonical="last"      → resolves to batch.length (last presented)
  //   canonical="previous"  → resolves to currentReference.offset - 1
  //   canonical="yang_tadi" → resolves to currentReference (fresh only)
  //                            OR to a single-entity batch
  //
  // Failure modes: `previous_without_current` · `yang_tadi_without_current`
  // — never guesses.
  [/\b(the\s+)?last\s+one\b/i, "last"],
  [/\byang\s+(last(\s+one)?|terakhir)\b/i, "last"],
  [/\b(the\s+)?previous\s+one\b/i, "previous"],
  [/\byang\s+(previous(\s+(one|page|slide))?|sebelumnya)\b/i, "previous"],
  [/\byang\s+(tadi|barusan)\b/i, "yang_tadi"],
  // Stage 3.41.m addendum · symmetric counterpart to `previous` ·
  // Corpus R (ride) exposed "yang next ride" / "yang next" / "the next
  // one" / "yang selanjutnya" / "yang berikutnya". Guards mirror the
  // `previous` scaffolding — bare "next meeting" mid-sentence does
  // NOT extract because we require the `yang X` / `the X one` frame.
  [/\b(the\s+)?next\s+one\b/i, "next"],
  [/\byang\s+(next(\s+one)?|selanjutnya|berikutnya)\b/i, "next"],
];

const PRONOUNS: Array<[RegExp, string]> = [
  [/\bthat one\b/i, "that_one"],
  [/\bthis one\b/i, "this_one"],                    // Stage 3.41.d P4
  [/\bthese\b/i, "these"],
  [/\bthose\b/i, "those"],
  [/\byang (ini|itu)\b/i, "yang_this"],
  [/\bitu\b/i, "itu"],
  // "it" alone is highly ambiguous — only capture in strong contexts
  [/\b(book|buy|reserve|open|message|contact|tell|call|text|whatsapp) it\b/i, "it"],
  // Stage 3.41.d P4 · "them" is common in action-target contexts
  // ("message them" · "call them"). Kept unconditional like "that one"
  // because the resolver enforces unambiguous-referent discipline.
  [/\bthem\b/i, "them"],
  // "him"/"her" only in action-target contexts · avoids matching
  // pronouns in casual sentences like "she's from Jakarta".
  [/\b(message|contact|call|text|whatsapp|book|tell) (him|her)\b/i, "him_her"],
  // Indonesian conversational references · gender-neutral.
  [/\bmereka\b/i, "mereka"],
  [/\b(hubungi|kirim|pesan(kan)?|kontak|telepon) dia\b/i, "dia"],
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
  // P1 REDIRECT (Philip 2026-09-05): widened to accept `place` and
  // `area` kinds when source === "nex_reply", matching the widened
  // filter in reference-resolution.ts. Enables ordinal resolution
  // against composed lists (e.g., "list three regions" → session
  // has 3 place entities → "the second one" resolves correctly).
  // The `nex_reply` source restriction is preserved so user-generated
  // entities never become ordinally-resolvable.
  const presented = window.filter(
    (e) =>
      (e.kind === "business_name" || e.kind === "place" || e.kind === "area") &&
      e.source === "nex_reply",
  );
  if (presented.length === 0) return undefined;
  const mostRecentIso = presented[presented.length - 1].atIso;
  const batch = presented.filter((e) => e.atIso === mostRecentIso);
  return batch.find((e) => e.presentedOffset === offset);
}
