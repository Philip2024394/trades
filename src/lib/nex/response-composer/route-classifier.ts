// src/lib/nex/response-composer/route-classifier.ts
//
// NEX Master AI Engineer · Deterministic Route Classifier
// Founder BEGIN 2026-09-08 · A/B/C/D/E route classification
//
// Answers Founder's critical question at every request:
//   "How often does NEX actually need an LLM?"
//
// Discipline:
// - Never invoke LLM merely because it is available
// - Never artificially force deterministic when inference is genuinely required
// - Every route decision is auditable + emits a reason code
//
// Order of precedence (deterministic · same for every request):
// 1. Safety check   → refuse OR route deterministic-safe
// 2. Exact cache    → A/B/C answer (whatever route computed it)
// 3. Semantic cache → A/B/C answer with freshness gate
// 4. Hot-tier lookup by ref/name/city (structured knowledge) → B
// 5. Deterministic tool dispatch (distance/date/currency) → A or B
// 6. Hot-tier predicate match (retrieval + reasoning) → C
// 7. Fallback to LLM ONLY if question genuinely requires language surface → D
// 8. Everything else → E (UNKNOWN + Gap Engine enqueue)

import type { RouteClass, RouteReasonCode } from "./types.js";
import { normalizeQuery } from "./request-normalizer.js";
import type { HotAccommodationTier } from "./hot-accommodation-tier.js";
import type { ResponseComposerCache } from "./semantic-cache.js";

export interface RouteDecision {
  class: RouteClass;
  reason_code: RouteReasonCode;
  reason_detail: string;
  confidence: number; // 0..1
  considered: Array<{ class: RouteClass; reason: string; rejected: boolean }>;
  extracted: {
    city_hint: string | null;
    business_name_hint: string | null;
    predicates: string[];        // e.g. "pool", "family_room", "beachfront"
    distance_intent: boolean;
    comparison_intent: boolean;
    listing_ref_hint: string | null;
    safety_flag: boolean;
    small_talk_flag: boolean;
    factual_intent: boolean;
  };
}

/** Explicit patterns · deterministic · no ML. */
const CITY_HINT_PATTERNS = [
  /\b(?:in|at|near|around)\s+([A-Z][a-zA-Z\s]{2,30})/g,
];
const LISTING_REF_PATTERN = /\b([a-z0-9]{6,}(?:-[a-z0-9]+)+)\b/;
const AMENITY_TOKENS = new Set([
  "pool","spa","gym","wifi","parking","breakfast","restaurant","bar",
  "beach","beachfront","seaview","poolview","garden","balcony",
  "family","kids","children","childrens","child-friendly",
  "pet","pets","pet-friendly","petfriendly",
  "smoking","non-smoking","nonsmoking",
  "kitchen","kitchenette","laundry","airconditioning","aircon","ac",
  "airport","shuttle","transfer",
]);
const DISTANCE_TOKENS = ["distance","km","miles","far","near","nearest","closest","close"];
const COMPARISON_TOKENS = ["compare","versus","vs","better","cheaper","different","difference"];
const SAFETY_TOKENS = ["emergency","hurt","injured","fire","bleeding","chest pain","stolen","robbery","attack","earthquake","tsunami"];
const SMALL_TALK_TOKENS = ["hello","hi","hey","thanks","thank you","bye","goodbye","cool","okay","ok"];
const FACTUAL_INTENT_MARKERS = [
  "how many","how much","what is","what are","what time","what day",
  "where is","where are","when does","when is",
];

export interface RouteInput {
  question: string;
  user_scope: string;
  hotTier: HotAccommodationTier | null;
  cache: ResponseComposerCache | null;
  forceClass?: RouteClass;
}

export function classifyRoute(input: RouteInput): RouteDecision {
  const normalized = normalizeQuery(input.question);
  const q = normalized.lower_trimmed;
  const considered: RouteDecision["considered"] = [];

  // Extract deterministic hints
  const extracted = {
    city_hint: extractCityHint(input.question),
    business_name_hint: null as string | null,
    predicates: normalized.content_tokens.filter((t) => AMENITY_TOKENS.has(t)),
    distance_intent: DISTANCE_TOKENS.some((t) => q.includes(t)),
    comparison_intent: COMPARISON_TOKENS.some((t) => q.includes(t)),
    listing_ref_hint: extractListingRef(q),
    safety_flag: SAFETY_TOKENS.some((t) => q.includes(t)),
    small_talk_flag: normalized.tokens.length <= 3 && SMALL_TALK_TOKENS.some((t) => q.startsWith(t) || q === t),
    factual_intent: FACTUAL_INTENT_MARKERS.some((m) => q.includes(m)),
  };

  // Attempt business_name_hint from hot tier if available
  if (input.hotTier?.isReady()) {
    const candidateName = extractBusinessNameHint(input.question, input.hotTier);
    extracted.business_name_hint = candidateName;
  }

  // Founder override
  if (input.forceClass) {
    const d: RouteDecision = {
      class: input.forceClass,
      reason_code: "PATTERN_INTENT_DETERMINISTIC",
      reason_detail: "forced by pilot harness",
      confidence: 1.0,
      considered,
      extracted,
    };
    return d;
  }

  // 1. Safety
  if (extracted.safety_flag) {
    considered.push({ class: "A", reason: "safety token present", rejected: false });
    return {
      class: "A",
      reason_code: "SAFETY_EXPRESSION",
      reason_detail: `safety token detected · deterministic safe response required`,
      confidence: 1.0,
      considered,
      extracted,
    };
  }

  // 2. Small talk · Route A
  if (extracted.small_talk_flag) {
    considered.push({ class: "A", reason: "small-talk pattern", rejected: false });
    return {
      class: "A",
      reason_code: "PATTERN_INTENT_DETERMINISTIC",
      reason_detail: "small-talk pattern · deterministic canned response acceptable",
      confidence: 0.95,
      considered,
      extracted,
    };
  }

  // 3. Exact cache
  if (input.cache) {
    const cacheResult = input.cache.lookup({
      question: input.question,
      user_scope: input.user_scope,
      require_fresh: true,
    });
    if (cacheResult.status === "exact_hit") {
      considered.push({ class: (cacheResult.entry?.route_class_when_computed as RouteClass) ?? "A", reason: "exact cache hit", rejected: false });
      return {
        class: (cacheResult.entry?.route_class_when_computed as RouteClass) ?? "A",
        reason_code: "EXACT_CACHE_HIT",
        reason_detail: cacheResult.reason,
        confidence: cacheResult.entry?.confidence ?? 0.9,
        considered,
        extracted,
      };
    }
    if (cacheResult.status === "semantic_hit") {
      considered.push({ class: (cacheResult.entry?.route_class_when_computed as RouteClass) ?? "B", reason: `semantic cache hit ${cacheResult.semantic_overlap?.toFixed(3)}`, rejected: false });
      return {
        class: (cacheResult.entry?.route_class_when_computed as RouteClass) ?? "B",
        reason_code: "SEMANTIC_CACHE_HIT",
        reason_detail: `Jaccard ${cacheResult.semantic_overlap?.toFixed(3)}`,
        confidence: (cacheResult.entry?.confidence ?? 0.9) * 0.95, // slight decay for semantic
        considered,
        extracted,
      };
    }
    if (cacheResult.status === "stale_rejected") {
      considered.push({ class: "E", reason: "cache stale rejected", rejected: true });
    }
  }

  // 4. Listing ref hint → Route B (direct lookup)
  if (extracted.listing_ref_hint && input.hotTier?.isReady()) {
    const refHit = input.hotTier.lookupByRef(extracted.listing_ref_hint);
    if (refHit.hit) {
      considered.push({ class: "B", reason: "listing ref direct hit", rejected: false });
      return {
        class: "B",
        reason_code: "STRUCTURED_LOOKUP_MATCH",
        reason_detail: `listing_ref ${extracted.listing_ref_hint} hot-tier hit ${refHit.latency_ms}ms`,
        confidence: 0.98,
        considered,
        extracted,
      };
    }
    considered.push({ class: "B", reason: "listing ref miss in hot tier", rejected: true });
  }

  // 5. Business name direct hit
  if (extracted.business_name_hint && input.hotTier?.isReady()) {
    const nameHit = input.hotTier.lookupByName(extracted.business_name_hint);
    if (nameHit.hit && nameHit.result_count === 1) {
      considered.push({ class: "B", reason: "unique name hit", rejected: false });
      return {
        class: "B",
        reason_code: "STRUCTURED_LOOKUP_MATCH",
        reason_detail: `business_name unique hit ${nameHit.latency_ms}ms`,
        confidence: 0.95,
        considered,
        extracted,
      };
    } else if (nameHit.hit && nameHit.result_count > 1) {
      considered.push({ class: "C", reason: "name ambiguous · needs comparison", rejected: false });
      return {
        class: "C",
        reason_code: "RETRIEVAL_MULTI_MATCH_COMPARISON",
        reason_detail: `business_name ${nameHit.result_count} matches · deterministic comparison`,
        confidence: 0.85,
        considered,
        extracted,
      };
    }
  }

  // 6. Distance intent + city hint → Route B (deterministic tool)
  if (extracted.distance_intent && extracted.city_hint && input.hotTier?.isReady()) {
    considered.push({ class: "B", reason: "distance query · deterministic Haversine", rejected: false });
    return {
      class: "B",
      reason_code: "TOOL_REQUIRED_DETERMINISTIC",
      reason_detail: `Haversine distance · city ${extracted.city_hint}`,
      confidence: 0.9,
      considered,
      extracted,
    };
  }

  // 7. City hint + amenity predicates → Route C (retrieval + deterministic compose)
  if (extracted.city_hint && extracted.predicates.length > 0 && input.hotTier?.isReady()) {
    considered.push({ class: "C", reason: "city + predicates · retrieval", rejected: false });
    return {
      class: "C",
      reason_code: "RETRIEVAL_HIGH_CONFIDENCE",
      reason_detail: `city=${extracted.city_hint} predicates=[${extracted.predicates.join(",")}] · hot-tier filter`,
      confidence: 0.85,
      considered,
      extracted,
    };
  }

  // 8. Comparison intent → Route C
  if (extracted.comparison_intent) {
    considered.push({ class: "C", reason: "comparison intent", rejected: false });
    return {
      class: "C",
      reason_code: "RETRIEVAL_MULTI_MATCH_COMPARISON",
      reason_detail: `comparison words present · structured comparison`,
      confidence: 0.75,
      considered,
      extracted,
    };
  }

  // 9. City hint only → Route B (top-N)
  if (extracted.city_hint && input.hotTier?.isReady()) {
    considered.push({ class: "B", reason: "city top-N", rejected: false });
    return {
      class: "B",
      reason_code: "STRUCTURED_LOOKUP_MATCH",
      reason_detail: `city=${extracted.city_hint} top-N by rating`,
      confidence: 0.8,
      considered,
      extracted,
    };
  }

  // 10. Factual intent with no structured hook → Route C attempt
  if (extracted.factual_intent) {
    considered.push({ class: "C", reason: "factual intent · retrieval attempt", rejected: false });
    return {
      class: "C",
      reason_code: "RETRIEVAL_HIGH_CONFIDENCE",
      reason_detail: `factual intent marker · attempt retrieval`,
      confidence: 0.6,
      considered,
      extracted,
    };
  }

  // 11. Long free-form → Route D (LLM genuinely required for language surface)
  if (normalized.length_tokens >= 15) {
    considered.push({ class: "D", reason: "long free-form · language surface", rejected: false });
    return {
      class: "D",
      reason_code: "AMBIGUOUS_REQUIRES_INFERENCE",
      reason_detail: `${normalized.length_tokens} tokens · free-form composition needed`,
      confidence: 0.55,
      considered,
      extracted,
    };
  }

  // 12. Anything else → Route E (honest UNKNOWN)
  considered.push({ class: "E", reason: "no deterministic path matched", rejected: false });
  return {
    class: "E",
    reason_code: "FALLBACK_UNKNOWN",
    reason_detail: `no deterministic pattern · no hot-tier hint · no cache · route to Gap Engine`,
    confidence: 0.3,
    considered,
    extracted,
  };
}

function extractCityHint(q: string): string | null {
  const CANDIDATES = [
    "yogyakarta","yogya","jogja","jakarta","bali","ubud","seminyak","canggu","denpasar",
    "surabaya","bandung","semarang","medan","makassar","malang",
    "london","manchester","birmingham","liverpool","glasgow","edinburgh",
    "kuta","legian","nusa dua","sanur","malioboro",
  ];
  const lower = q.toLowerCase();
  for (const c of CANDIDATES) {
    if (new RegExp(`\\b${c.replace(/\s/g, "\\s+")}\\b`, "i").test(lower)) {
      return c;
    }
  }
  return null;
}

function extractListingRef(q: string): string | null {
  const m = q.match(LISTING_REF_PATTERN);
  return m ? m[1] : null;
}

function extractBusinessNameHint(question: string, tier: HotAccommodationTier): string | null {
  // Best-effort · look for capitalized multi-word runs that match a known name
  const cap = question.match(/[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,4}/g) ?? [];
  for (const c of cap) {
    const hit = tier.lookupByName(c);
    if (hit.hit) return c;
  }
  return null;
}
