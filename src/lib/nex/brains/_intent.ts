// src/lib/nex/brains/_intent.ts
//
// D1 Runtime · Intent Detection (Philip 2026-07-28)
// ─────────────────────────────────────────────────
// Keyword-based intent classifier. Given a user query, returns the
// intent kind + candidate topic slugs. Deliberately simple for v1:
// exact matches + basic plural/synonym rules. No LLM. No invention.
//
// Intents:
//   terminology_lookup    · user asks for a definition
//   comparison            · user asks "difference between X and Y"
//   how_to                · user asks how to do something
//   fault_diagnosis       · user asks about a symptom / problem
//   regulation_check      · user asks about compliance / code
//   estimating            · user asks about method (no prices)
//   out_of_scope          · question belongs to a different brain
//   unknown_intent        · could not classify

import type { LoadedBrain } from "./_types";

export type IntentKind =
  | "terminology_lookup"
  | "comparison"
  | "how_to"
  | "fault_diagnosis"
  | "regulation_check"
  | "estimating"
  | "out_of_scope"
  | "unknown_intent";

export type Intent = {
  kind: IntentKind;
  candidate_topics: string[];      // e.g. ["housed_string"] or ["going", "run"]
  candidate_modules: string[];      // e.g. ["terminology", "construction"]
  matched_keywords: string[];
  confidence: number;               // 0..1 · rough certainty in the classification
  raw_query: string;
  normalised_query: string;
};

// Terminology intent trigger phrases (case-insensitive)
const DEFINE_TRIGGERS = [
  "what is", "what's", "what does", "define", "definition of",
  "explain", "meaning of", "means what", "what do you mean by",
];
const COMPARISON_TRIGGERS = [
  "difference between", "how does .* differ", "vs", " vs.", "compared to",
  "compare", "what's the difference",
];
const HOW_TO_TRIGGERS = ["how do i", "how to", "how would you", "how should"];
const FAULT_TRIGGERS = [
  "why is", "why does", "why did", "problem with", "cracked", "split",
  "loose", "squeak", "movement", "failure", "broken",
];
const REGULATION_TRIGGERS = [
  "doc k", "approved document", "regulation", "regulations", "compliant",
  "compliance", "building code", "bs en", "bs 5395",
];
const ESTIMATING_TRIGGERS = [
  "how much labour", "how many hours", "estimate", "estimating",
  "how do you quote", "how do you price",
];

// Out-of-scope keywords for the Staircase Brain (borrowed from garden_staircase memory)
const OUT_OF_SCOPE_HINTS: Record<string, string[]> = {
  staircase: [
    "garden staircase", "outdoor stair", "external stair", "decking stair",
    "patio stair", "plumbing", "electrical wiring", "roof", "roofing", "boiler",
  ],
};

function normalise(q: string): string {
  return q.trim().replace(/\s+/g, " ").toLowerCase();
}

function anyTrigger(q: string, triggers: string[]): string[] {
  const matched: string[] = [];
  for (const t of triggers) {
    if (t.includes(".*")) {
      const re = new RegExp(t, "i");
      if (re.test(q)) matched.push(t);
    } else if (q.includes(t)) {
      matched.push(t);
    }
  }
  return matched;
}

/**
 * Detect intent by scanning the query against loaded brain module keys
 * and trigger keywords. Returns a rich Intent object the retrieval
 * step can use to focus its lookup.
 */
export function detectIntent(query: string, brain: LoadedBrain): Intent {
  const normalised = normalise(query);
  const slug = brain.manifest.slug;

  // Out-of-scope check first
  const oosHints = OUT_OF_SCOPE_HINTS[slug] ?? [];
  const oosMatches = anyTrigger(normalised, oosHints);
  if (oosMatches.length > 0) {
    return {
      kind: "out_of_scope",
      candidate_topics: [],
      candidate_modules: [],
      matched_keywords: oosMatches,
      confidence: 0.9,
      raw_query: query,
      normalised_query: normalised,
    };
  }

  // Collect all known topic keys from the brain's modules
  const topicIndex = buildTopicIndex(brain);

  // Match topic keys against the query (exact + relaxed)
  const matchedTopics = findTopicMatches(normalised, topicIndex);

  // Trigger detection
  const defTriggers = anyTrigger(normalised, DEFINE_TRIGGERS);
  const cmpTriggers = anyTrigger(normalised, COMPARISON_TRIGGERS);
  const howTriggers = anyTrigger(normalised, HOW_TO_TRIGGERS);
  const faultTriggers = anyTrigger(normalised, FAULT_TRIGGERS);
  const regTriggers = anyTrigger(normalised, REGULATION_TRIGGERS);
  const estTriggers = anyTrigger(normalised, ESTIMATING_TRIGGERS);

  // Order matters: more specific triggers first
  let kind: IntentKind = "unknown_intent";
  let matched: string[] = [];
  let modules: string[] = [];
  let confidence = 0.1;

  if (faultTriggers.length > 0) {
    kind = "fault_diagnosis";
    matched = faultTriggers;
    modules = ["fault_finding", "installation", "construction"];
    confidence = 0.7;
  } else if (regTriggers.length > 0) {
    kind = "regulation_check";
    matched = regTriggers;
    modules = ["regulations"];
    confidence = 0.8;
  } else if (estTriggers.length > 0) {
    kind = "estimating";
    matched = estTriggers;
    modules = ["estimating"];
    confidence = 0.7;
  } else if (cmpTriggers.length > 0 && matchedTopics.length >= 2) {
    kind = "comparison";
    matched = cmpTriggers;
    modules = ["terminology", "construction"];
    confidence = 0.8;
  } else if (howTriggers.length > 0) {
    kind = "how_to";
    matched = howTriggers;
    modules = ["installation", "construction", "manufacturing", "maintenance"];
    confidence = 0.65;
  } else if (defTriggers.length > 0 || matchedTopics.length > 0) {
    kind = "terminology_lookup";
    matched = defTriggers.length > 0 ? defTriggers : [];
    modules = ["terminology"];
    confidence = matchedTopics.length > 0 ? 0.85 : 0.55;
  }

  return {
    kind,
    candidate_topics: matchedTopics,
    candidate_modules: modules,
    matched_keywords: matched,
    confidence,
    raw_query: query,
    normalised_query: normalised,
  };
}

// ---------- Topic index (extracted from brain modules) ----------

type TopicIndex = {
  // key = normalised token · value = list of { module, topic_slug }
  [token: string]: Array<{ module: string; topic: string }>;
};

function buildTopicIndex(brain: LoadedBrain): TopicIndex {
  const index: TopicIndex = {};
  const modules = (brain as unknown as { modules?: Record<string, unknown> }).modules;
  if (!modules) return index;
  for (const [modName, modContent] of Object.entries(modules)) {
    if (!modContent || typeof modContent !== "object") continue;
    for (const key of Object.keys(modContent as Record<string, unknown>)) {
      if (key.startsWith("_")) continue;
      const tokens = key.split(/[_\s-]+/).map((t) => t.toLowerCase()).filter(Boolean);
      // Index both the full key and each individual token
      addToIndex(index, key.toLowerCase().replace(/_/g, " "), modName, key);
      for (const t of tokens) {
        if (t.length < 3) continue;         // skip trivial tokens like "of"
        addToIndex(index, t, modName, key);
      }
    }
  }
  return index;
}

function addToIndex(index: TopicIndex, token: string, module: string, topic: string): void {
  if (!index[token]) index[token] = [];
  if (!index[token].some((e) => e.module === module && e.topic === topic)) {
    index[token].push({ module, topic });
  }
}

function findTopicMatches(normalised: string, index: TopicIndex): string[] {
  const found = new Set<string>();
  // Prefer full-phrase matches first
  for (const token of Object.keys(index)) {
    if (token.length < 3) continue;
    if (normalised.includes(token)) {
      for (const entry of index[token]) {
        found.add(entry.topic);
      }
    }
  }
  return Array.from(found);
}
