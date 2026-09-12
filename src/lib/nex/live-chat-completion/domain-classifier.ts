// src/lib/nex/live-chat-completion/domain-classifier.ts
//
// Founder BEGIN 2026-09-09 · LIVE CHAT COMPLETION · domain classifier.
//
// Deterministic. Zero LLM. Given a user message + the chat brain's own
// intent hint, return which domain adapter should handle the turn.
//
// The classifier is intentionally conservative — when nothing wins, it
// returns "unknown" and the chat route falls back to the legacy path.
// Better a legacy reply than a wrong domain guess.

import type { Domain, AdapterTurnInput } from "./contract";

// ═══════════════════════════════════════════════════════════════════
// Per-domain trigger vocabulary. English + Bahasa Indonesia + slang.
// Keep small — the intent parser inside each adapter does the fine-grained work.
// ═══════════════════════════════════════════════════════════════════

const DOMAIN_TRIGGERS: Record<Exclude<Domain, "unknown">, readonly string[]> = {
  accommodation: [
    // English
    "hotel", "hotels", "stay", "stays", "place to stay", "accommodation",
    "guesthouse", "guest house", "villa", "villas", "homestay",
    "hostel", "hostels", "resort", "resorts", "apartment", "apartments",
    "airbnb", "b&b", "bnb", "boutique", "inn",
    "check in", "check-in", "checkin", "check out", "check-out", "checkout",
    "room", "rooms", "wifi at", "amenities at", "star rating",
    // Bahasa Indonesia
    "hotel di", "penginapan", "wisma", "losmen", "kos", "kost", "kamar",
    "menginap", "tempat menginap", "cari hotel",
  ],
  food: [
    "restaurant", "restaurants", "cafe", "cafes", "coffee shop",
    "warung", "makan", "eat", "eating", "makanan", "kuliner",
    "lunch", "dinner", "breakfast", "brunch",
    "food near", "where to eat", "best food", "cheap eats",
    "kopi", "minum",
  ],
  markets: [
    "market", "markets", "pasar", "shopping", "mall", "shop", "shops",
    "buy", "belanja", "toko", "supermarket", "traditional market",
    "night market", "flea market",
  ],
  transport: [
    "taxi", "gojek", "grab", "ojek", "bus", "train", "bemo", "angkot",
    "airport", "bandara", "station", "stasiun", "terminal",
    "ride", "ride share", "how to get", "how do i get to",
    "kereta", "pesawat", "flight", "transport",
  ],
  business: [
    "shop hours", "business hours", "jam buka", "opening hours",
    "phone number for", "call", "menelpon",
    "email", "website of",
  ],
  travel: [
    "travel", "itinerary", "trip", "vacation", "holiday",
    "flight", "flights", "book a flight", "travel to",
  ],
  attractions: [
    "attraction", "attractions", "sights", "landmarks", "temple",
    "museum", "tourist", "things to do", "what to see",
  ],
  // Founder BEGIN 2026-09-10 · code is a domain of NEX (programming role).
  // NEX1 consumes this domain · does not own it. Concept substrate is shared
  // with NEX Chat (see ADR-0308 · nex.concepts / nex.concept_senses).
  code: [
    // Bare code terms (single tokens · substring-safe)
    "code", "coding", "codebase", "programme", "program", "programming",
    "typescript", "javascript", "react", "next.js", "nextjs", "vitest",
    "migration", "migrations", "postgres", "postgresql", "sql",
    "endpoint", "endpoints", "route", "routes", "handler",
    "refactor", "rename", "restructure",
    "bug", "bugs", "debug", "broken", "not working", "error message", "stack trace",
    "git", "commit", "commits", "branch", "branches", "merge", "worktree",
    "test", "tests", "spec", "unit test", "add tests", "write tests",
    "table", "column", "schema", "index",
    "typescript", "tsx", "jsx", "tsc",
    "module", "modules", "helper", "helpers", "component",
    "nex1", "nex ", "the nex",
    // slang triggers · match Phase 1 language engine
    "chuck in", "bung in", "knock up", "sort out", "patch up",
    "walk me through", "run me through", "explain",
    "what is a route", "what is a migration", "what is a bug", "what is a test",
    "what does", "what is", "meaning of", "define",
  ],
};

// ═══════════════════════════════════════════════════════════════════
// Chat brain intent hints → domain
// ═══════════════════════════════════════════════════════════════════

const INTENT_TO_DOMAIN: Record<string, Domain> = {
  // Accommodation brain intents (seen in the current chat brain)
  accommodation: "accommodation",
  hotel: "accommodation",
  stays: "accommodation",
  // Live discovery for accommodation
  live_discovery: "accommodation", // conservative default when world_cards present
  // Food
  food: "food",
  restaurant: "food",
  // Others
  transport: "transport",
  markets: "markets",
  business: "business",
  travel: "travel",
  attractions: "attractions",
  // Founder BEGIN 2026-09-10 · code-domain intents (from code-intent-registry
  // as temporary seed · migrates to nex.concept_senses per ADR-0308).
  add_feature: "code",
  fix_bug: "code",
  refactor: "code",
  add_migration: "code",
  add_api_route: "code",
  add_test: "code",
  explain_error: "code",
  capabilities: "code",
  small_talk: "code",
};

// ═══════════════════════════════════════════════════════════════════
// Classifier
// ═══════════════════════════════════════════════════════════════════

export interface Classification {
  domain: Domain;
  confidence: number;      // 0..1 rough score
  reasoning: readonly string[];
}

export function classifyDomain(input: AdapterTurnInput): Classification {
  const reasoning: string[] = [];
  const lower = (input.message ?? "").toLowerCase();

  // 1) Direct chat-brain intent hint (highest signal — brain already ran)
  if (input.chat_brain_intent) {
    const hinted = INTENT_TO_DOMAIN[input.chat_brain_intent];
    if (hinted && hinted !== "unknown") {
      reasoning.push(`chat_brain_intent=${input.chat_brain_intent} → ${hinted}`);
      // If world_cards were emitted AND the brain intent is a domain we know,
      // that's a very strong signal.
      const strong = input.chat_brain_world_cards_count > 0 ? 0.95 : 0.75;
      return { domain: hinted, confidence: strong, reasoning };
    }
  }

  // 2) Trigger-vocabulary scoring
  const scores: Record<Exclude<Domain, "unknown">, number> = {
    accommodation: 0,
    food: 0,
    markets: 0,
    transport: 0,
    business: 0,
    travel: 0,
    attractions: 0,
    code: 0,
  };
  for (const [domain, triggers] of Object.entries(DOMAIN_TRIGGERS) as [Exclude<Domain, "unknown">, readonly string[]][]) {
    for (const trigger of triggers) {
      if (lower.includes(trigger)) {
        scores[domain] += trigger.length >= 6 ? 2 : 1;
      }
    }
  }
  const ranked = Object.entries(scores)
    .filter(([, s]) => s > 0)
    .sort(([, a], [, b]) => b - a) as [Exclude<Domain, "unknown">, number][];

  if (ranked.length === 0) {
    reasoning.push("no domain triggers matched");
    return { domain: "unknown", confidence: 0, reasoning };
  }

  const [topDomain, topScore] = ranked[0];
  const runnerUp = ranked[1]?.[1] ?? 0;
  reasoning.push(`trigger score: ${topDomain}=${topScore} runner=${runnerUp}`);

  // Ambiguous when top score doesn't win by ≥ 2. Fall through to legacy.
  if (topScore - runnerUp < 2 && runnerUp > 0) {
    reasoning.push("top score does not clear runner-up by 2 · classifying as unknown");
    return { domain: "unknown", confidence: 0.3, reasoning };
  }

  const confidence = Math.min(1, 0.5 + topScore * 0.1);
  return { domain: topDomain, confidence, reasoning };
}
