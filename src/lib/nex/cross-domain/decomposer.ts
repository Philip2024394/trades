// src/lib/nex/cross-domain/decomposer.ts
//
// Founder Phase 5 · P5-2 · cross-domain query decomposer.
//
// Detects queries that span multiple NEX domains and produces sub-
// queries per domain, plus join constraints (geographic proximity,
// temporal alignment).
//
// Example input:
//   "Find me a hotel in Yogyakarta with parking, breakfast, near a
//    market, and then tell me which nearby restaurant is open tonight."
//
// Example output:
//   {
//     domains: ["accommodation", "markets", "food"],
//     sub_queries: [
//       { domain: "accommodation", question: "hotel in Yogyakarta with parking, breakfast", filters: ["parking","breakfast"] },
//       { domain: "markets", question: "market in Yogyakarta", filters: [] },
//       { domain: "food", question: "restaurant open tonight", filters: [] },
//     ],
//     joins: [
//       { kind: "geo_proximity", from_domain: "accommodation", to_domain: "markets", max_km: 2 },
//       { kind: "geo_proximity", from_domain: "accommodation", to_domain: "food", max_km: 2 },
//     ],
//     temporal_constraint: { hint: "tonight" },
//     is_multi_domain: true,
//   }
//
// Deterministic pattern-based (no LLM). LLM-driven decomposition is a
// separate BEGIN when the deterministic classifier misses a pattern.
// Doctrine-safe: never fabricates sub-queries · returns is_multi_domain
// false when the query is single-domain.

import type { Domain } from "@/lib/nex/live-chat-completion/contract";

const DOMAIN_TOKENS: Record<Exclude<Domain, "unknown">, RegExp> = {
  accommodation: /\b(hotel|hotels|inn|hostel|guesthouse|kos|homestay|penginapan|wisma|losmen|resort|stay|akomodasi|kamar|room|rooms)\b/i,
  food: /\b(restaurant|resto|cafe|kafe|makan|dine|dining|breakfast|lunch|dinner|sarapan|makanan|kuliner|warung|nasi|ayam|kopi|coffee|menu)\b/i,
  markets: /\b(market|pasar|mall|plaza|shop|shopping|toko|belanja|bazaar|beringharjo|malioboro)\b/i,
  transport: /\b(train|bus|taxi|grab|gojek|ojek|angkot|becak|bemo|kereta|bis|pesawat|flight|airport|bandara|terminal|station|stasiun|route|rute|fare|tarif|transport|ride)\b/i,
  travel: /\b(trip|itinerary|tour|package|holiday|vacation|wisata|paket|jalan-jalan|backpack|traveler|traveller)\b/i,
  attractions: /\b(attraction|temple|candi|museum|park|beach|pantai|monument|palace|kraton|waterfall|volcano|gunung|island|pulau|zoo|prambanan|borobudur|tugu)\b/i,
  business: /\b(business|services|company|contractor|plumber|electrician|lawyer|doctor|dentist|clinic|klinik|salon|barber|repair|laundry|kantor)\b/i,
};

// Join hints — words that suggest one entity should be geographically
// near another. When present with 2+ domains, we infer a proximity join.
const PROXIMITY_HINT_RE = /\b(near|nearby|close\s+to|next\s+to|around|walking\s+distance|dekat|sekitar|di\s+sekitar)\b/i;

// Temporal hints
const TEMPORAL_HINT_RE = /\b(now|tonight|tomorrow|today|weekend|morning|afternoon|evening|this\s+week|next\s+week|malam|besok|hari\s+ini|akhir\s+pekan|pagi|siang|sore)\b/i;

// Filter attributes commonly attached to a domain query.
const COMMON_FILTERS_RE = /\b(parking|breakfast|wifi|pool|air\s*con|halal|vegetarian|vegan|cheap|budget|luxury|family|pet\s*friendly)\b/gi;

export type DomainKey = Exclude<Domain, "unknown">;

export interface DomainSubQuery {
  domain: DomainKey;
  question: string;
  filters: string[];
}

export type JoinKind = "geo_proximity" | "temporal_overlap";

export interface CrossDomainJoin {
  kind: JoinKind;
  from_domain: DomainKey;
  to_domain: DomainKey;
  /** For geo_proximity · max distance in km. Default 2. */
  max_km?: number;
}

export interface TemporalConstraint {
  hint: string;             // "tonight" · "tomorrow morning" · etc.
  time_window?: { start_iso: string; end_iso: string; tz?: string };
}

export interface DecomposedQuery {
  original: string;
  domains: readonly DomainKey[];
  sub_queries: readonly DomainSubQuery[];
  joins: readonly CrossDomainJoin[];
  temporal_constraint?: TemporalConstraint;
  is_multi_domain: boolean;
  reasoning: readonly string[];
}

export function decomposeCrossDomain(input: string): DecomposedQuery {
  const message = String(input ?? "").trim();
  const reasoning: string[] = [];

  // 1 · Detect which domains are referenced.
  const detected: DomainKey[] = [];
  for (const [dom, re] of Object.entries(DOMAIN_TOKENS) as [DomainKey, RegExp][]) {
    if (re.test(message)) detected.push(dom);
  }
  reasoning.push(`domains_detected=${detected.join(",")}`);

  const is_multi_domain = detected.length >= 2;

  // 2 · Extract common filters.
  const filterMatches = message.match(COMMON_FILTERS_RE) ?? [];
  const filters = Array.from(new Set(filterMatches.map((f) => f.toLowerCase().replace(/\s+/g, "_"))));

  // 3 · Sub-query per domain (a rough per-domain slice · deterministic).
  const sub_queries: DomainSubQuery[] = detected.map((domain) => ({
    domain,
    question: sliceForDomain(message, domain),
    filters: filters.filter((f) => filterRelevantForDomain(f, domain)),
  }));

  // 4 · Joins · proximity hint present + 2+ domains → geo_proximity between each pair.
  const joins: CrossDomainJoin[] = [];
  if (is_multi_domain && PROXIMITY_HINT_RE.test(message)) {
    reasoning.push("proximity_hint_present");
    // Anchor on the first (typically the "stay" domain).
    const anchor = detected[0];
    for (const other of detected.slice(1)) {
      joins.push({ kind: "geo_proximity", from_domain: anchor, to_domain: other, max_km: 2 });
    }
  }

  // 5 · Temporal constraint.
  const temporalHit = message.match(TEMPORAL_HINT_RE);
  const temporal_constraint = temporalHit
    ? { hint: temporalHit[0].toLowerCase() }
    : undefined;
  if (temporal_constraint) reasoning.push(`temporal_hint=${temporal_constraint.hint}`);

  return {
    original: message,
    domains: detected,
    sub_queries,
    joins,
    temporal_constraint,
    is_multi_domain,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Deterministically slice the message into a per-domain sub-question.
 * Simple heuristic: take the whole message but tag the domain focus.
 * Adapter classifiers use tokens, not phrasing, so this is enough.
 */
function sliceForDomain(message: string, domain: DomainKey): string {
  return `${message} (focus:${domain})`;
}

function filterRelevantForDomain(filter: string, domain: DomainKey): boolean {
  // Certain filters make more sense for specific domains. Deterministic map.
  const map: Record<string, DomainKey[]> = {
    parking: ["accommodation", "food", "attractions", "markets", "business"],
    breakfast: ["accommodation", "food"],
    wifi: ["accommodation", "food"],
    pool: ["accommodation"],
    air_con: ["accommodation", "food", "transport"],
    halal: ["food"],
    vegetarian: ["food"],
    vegan: ["food"],
    cheap: ["accommodation", "food", "transport", "travel", "attractions"],
    budget: ["accommodation", "food", "transport", "travel"],
    luxury: ["accommodation", "food", "travel"],
    family: ["accommodation", "travel", "attractions"],
    pet_friendly: ["accommodation"],
  };
  const allowed = map[filter];
  return !allowed || allowed.includes(domain);
}
