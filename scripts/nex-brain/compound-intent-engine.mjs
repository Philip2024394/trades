// NEX Compound Intent Engine (Philip 2026-08-14 architectural change).
// Replaces "keyword → first-matching-family → answer" with:
//   detect ALL concepts → identify primary → identify secondary → identify preferences → identify missing info.
//
// This module is IMPORTED by scorers. Not standalone-runnable.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const CWD = process.cwd();
const CLASSIFIER = join(CWD, "scripts", "nex-brain", "classify-and-score-full-corpus.mjs");

// --- Extract concept families + markers from the classifier (source of truth) ---
const src = readFileSync(CLASSIFIER, "utf8");

function extractArray(varName) {
  const re = new RegExp("const\\s+" + varName + "\\s*=\\s*\\[([\\s\\S]*?)\\];", "m");
  const m = src.match(re);
  if (!m) return [];
  const items = [];
  const strRe = /"([^"\\]|\\.)*"/g;
  let sm;
  while ((sm = strRe.exec(m[1])) !== null) items.push(sm[0].slice(1, -1));
  return items;
}
export const AMBIGUOUS_MARKERS = extractArray("AMBIGUOUS_MARKERS");
export const LIKELY_MARKERS = extractArray("LIKELY_MARKERS");

// PRONOUN_ONLY_MARKERS
const pronounSrc = src.match(/const PRONOUN_ONLY_MARKERS = \[([\s\S]*?)\];/);
export const PRONOUN_ONLY_MARKERS = [];
if (pronounSrc) {
  const patternRe = /\/([^/\\]|\\.)+?\/i/g;
  let pm;
  while ((pm = patternRe.exec(pronounSrc[1])) !== null) {
    try {
      const s = pm[0];
      const lastSlash = s.lastIndexOf("/");
      PRONOUN_ONLY_MARKERS.push(new RegExp(s.slice(1, lastSlash), s.slice(lastSlash + 1)));
    } catch {}
  }
}

// CONCEPT_FAMILIES (family + all keywords, in declaration order)
export const CONCEPT_FAMILIES = [];
const familyBlockRe = /\{\s*family:\s*"([^"]+)",\s*kws:\s*\[([\s\S]*?)\]\s*\}/g;
let fm;
while ((fm = familyBlockRe.exec(src)) !== null) {
  const family = fm[1];
  const kws = [];
  const kwRe = /"([^"\\]|\\.)*"/g;
  let km;
  while ((km = kwRe.exec(fm[2])) !== null) kws.push(km[0].slice(1, -1));
  CONCEPT_FAMILIES.push({ family, kws });
}

// --- Primary/secondary precedence (LOCKED per Philip's construction → design hierarchy) ---
// When multiple concepts hit, the primary is determined by this precedence order.
// This preserves the "construction determines what's possible; design chooses within it" reasoning.
const PRECEDENCE = [
  "safety_regs",           // Regulations are always primary if invoked (compliance-first)
  "business_estimation",   // Cost questions are primary if invoked (routed honestly)
  "carpet_stepmats",       // Finish-first when carpet is mentioned with anything else
  "starting_steps",        // Starting step is primary when it's the featured decision
  "landing_railings",      // Landing continuity matters
  "stringers",             // Construction type
  "handrail",              // Handrail specifics
  "balusters",             // Balustrade specifics
  "newel_caps",            // Newel details
  "treads_risers",         // Tread/riser details
  "refacing",              // Refacing scope (secondary when combined with specifics)
  "understair",            // Under-stair uses
  "lighting",              // Lighting integration
  "design_style",          // Style cascade (LOWEST priority — usually secondary)
  "timber_species",        // Material selection
  "maintenance_repair",    // Repair procedure
  "material_science",      // Defer
  "wayfinding",            // Future brain
  "ergonomics",            // Future brain
  "carpentry_math",        // Partial on-brain
  "installation_process",  // Partial on-brain
  "outdoor_stairs",        // Partial on-brain
];

// --- Contextual concept patterns (relationship-aware · Philip 2026-08-14) ---
// These supplement bare-keyword matching so NEX activates the RIGHT concept from context,
// not just a literal token. Each entry: pattern → concept families to activate.
// Constitutional: patterns MUST reflect what the utterance actually implies. Never invent.
const CONTEXTUAL_PATTERNS = [
  // Newel-cap context — "cap" alone is ambiguous, but "cap" adjacent to newel is unambiguous.
  { re: /\b(?:newel\s+cap|cap\s+(?:on|for|of|at\s+the\s+top\s+of)\s+the\s+newel|cap\s+(?:on|for|at\s+the\s+top\s+of)\s+the\s+post|top\s+cap|flat\s+cap\s+on\s+the\s+newel)\b/i, concepts: ["newel_caps"] },
  { re: /\b(?:ball\s+finial|pyramidal|acorn\s+cap|mushroom\s+cap)\b/i, concepts: ["newel_caps"] },
  // Wall-fixed / two-sided are construction language → activate stringers
  { re: /\b(?:wall[- ]fixed|wall\s+fixed|fixed\s+to\s+the\s+wall|against\s+a\s+wall|one\s+side\s+against\s+a\s+wall)\b/i, concepts: ["stringers"] },
  { re: /\b(?:cantilever(?:ed)?|floating\s+treads?|floating\s+stair(?:case)?|cut\s+string|open\s+string|closed\s+string)\b/i, concepts: ["stringers"] },
  // LED lighting variants — activate BOTH lighting AND treads_risers when co-located
  { re: /\bled\s+under[- ]nosing\b/i, concepts: ["lighting", "treads_risers"] },
  { re: /\bled\s+under[- ]?tread\b/i, concepts: ["lighting", "treads_risers"] },
  { re: /\b(?:led\s+strip|strip\s+led|under[- ]step\s+light)/i, concepts: ["lighting"] },
  { re: /\bstep[- ]?lights?\b/i, concepts: ["lighting", "treads_risers"] },
  // Bare balustrade-material words — activate balusters concept even without the word "baluster"
  { re: /\b(?:glass\s+balustrade|frameless\s+glass|point[- ]fixed\s+glass|glass\s+panel|clamp[- ]mounted)\b/i, concepts: ["balusters"] },
  { re: /\b(?:matt[- ]black\s+(?:metal\s+)?rods?|matt[- ]black\s+spindles?|matt[- ]black\s+balusters?)\b/i, concepts: ["balusters"] },
  { re: /\b(?:brushed\s+stainless\s+spindles?|brushed\s+stainless\s+rods?|stainless\s+spindles?)\b/i, concepts: ["balusters"] },
  { re: /\bturned\s+(?:oak\s+)?spindles?\b/i, concepts: ["balusters"] },
  // Runner / carpet references not caught by bare kws
  { re: /\bcarpet\s+runner\b/i, concepts: ["carpet_stepmats"] },
  { re: /\bstair\s+rods?\b/i, concepts: ["carpet_stepmats"] },
  // Handrail phrases
  { re: /\boak\s+top\s+cap\s+on\s+the\s+glass\b/i, concepts: ["handrail", "balusters"] },
  { re: /\btop\s+cap\s+on\s+the\s+glass\b/i, concepts: ["handrail", "balusters"] },
  // Refacing / retention language beyond bare kws
  { re: /\b(?:structurally\s+fine|keep(?:ing)?\s+the\s+(?:existing\s+)?(?:stairs|staircase|structure|treads|newels?|handrail))\b/i, concepts: ["refacing"] },
  { re: /\b(?:modernise|modernize|update|refresh|refurbish)\s+(?:the\s+)?(?:balustrade|spindles?|handrail|look|staircase)\b/i, concepts: ["refacing"] },
  // Cost / regs language (should route correctly)
  { re: /\b(?:how\s+much|price\s+range|typical\s+cost|ballpark)\b/i, concepts: ["business_estimation"] },
  { re: /\b(?:building\s+regs?|building\s+regulations?|code\s+says|inspector)\b/i, concepts: ["safety_regs"] },
  // Timber tread/riser context
  { re: /\btreads?\s+(?:in|of)\s+(?:oak|walnut|pine|maple|ash|cherry|mahogany|beech)\b/i, concepts: ["treads_risers", "timber_species"] },
  // Landing continuation
  { re: /\blanding\s+(?:to\s+match|continue|same\s+design|same\s+system)/i, concepts: ["landing_railings"] },
  // Design intents that carry compound concepts
  { re: /\bmodern\s+staircase(?:s)?\b/i, concepts: ["design_style"] },
  { re: /\bstarting\s+step\s+to\s+fit\b/i, concepts: ["starting_steps"] },
  { re: /\bextended\s+square\s+platform\b/i, concepts: ["starting_steps"] },
  { re: /\bwhat\s+starting\s+step\s+suits\b/i, concepts: ["starting_steps"] },
];

// --- Detect ALL matching families (compound-aware, not first-match) ---
export function detectAllConcepts(text) {
  const lower = text.toLowerCase();
  const hits = new Set();
  const matchedKeywords = {};
  // Layer 1: literal keyword matching (source-of-truth precedence)
  for (const f of CONCEPT_FAMILIES) {
    if (f.family === "safety_regs_secondary") continue; // internal placeholder
    for (const k of f.kws) {
      if (lower.includes(k.toLowerCase())) {
        hits.add(f.family);
        matchedKeywords[f.family] = matchedKeywords[f.family] || [];
        matchedKeywords[f.family].push(k);
      }
    }
  }
  // Layer 2: contextual/relationship patterns (Philip 2026-08-14 architectural addition)
  for (const cp of CONTEXTUAL_PATTERNS) {
    if (cp.re.test(text)) {
      for (const c of cp.concepts) {
        hits.add(c);
        matchedKeywords[c] = matchedKeywords[c] || [];
        matchedKeywords[c].push(`(ctx) ${cp.re.source}`);
      }
    }
  }
  // Layer 3: preference-driven concept promotion — a stated preference implies its concept.
  const prefs = extractPreferences(text);
  if (prefs.balustrade_material) hits.add("balusters");
  if (prefs.timber_species) hits.add("timber_species");
  if (prefs.style) hits.add("design_style");
  if (prefs.finish === "carpet" || prefs.finish === "runner" || prefs.finish === "step_mats") hits.add("carpet_stepmats");
  if (prefs.construction) hits.add("stringers");
  return { families: [...hits], matched_keywords: matchedKeywords };
}

// --- Identify primary vs secondary from all-matching concepts ---
export function classifyPrimarySecondary(families) {
  if (families.length === 0) return { primary: "unclassified", secondary: [] };
  const rank = (fam) => {
    const idx = PRECEDENCE.indexOf(fam);
    return idx === -1 ? PRECEDENCE.length : idx;
  };
  const sorted = [...families].sort((a, b) => rank(a) - rank(b));
  return { primary: sorted[0], secondary: sorted.slice(1) };
}

// --- Detect intent tier (single-utterance, replicated from classifier) ---
export function detectTier(text) {
  const lower = text.toLowerCase();
  if (PRONOUN_ONLY_MARKERS.some((r) => r.test(text))) return "Ambiguous";
  if (AMBIGUOUS_MARKERS.some((m) => lower.includes(m.toLowerCase()))) return "Ambiguous";
  if (LIKELY_MARKERS.some((m) => lower.includes(m.toLowerCase()))) return "Likely";
  return "Clear";
}

// --- Detect query type (from classifier's detectQueryType) ---
export function detectQueryType(text) {
  if (/\[image_search\]/i.test(text)) return "image_retrieval";
  if (/^show me /i.test(text.trim())) return "image_retrieval";
  if (/^give me some/i.test(text.trim())) return "image_retrieval";
  if (/^i want to see/i.test(text.trim())) return "image_retrieval";
  if (/^let me see/i.test(text.trim())) return "image_retrieval";
  if (/examples of/i.test(text) || /pictures of/i.test(text) || /images of/i.test(text) || /photos of/i.test(text)) return "image_retrieval";
  if (/examples please/i.test(text) || /pictures please/i.test(text)) return "image_retrieval";
  if (/what do .* look like/i.test(text)) return "image_retrieval";
  if (/what does .* look like/i.test(text)) return "image_retrieval";
  if (/what would .* look like/i.test(text)) return "hybrid"; // hybrid: design interpretation + image
  if (/what .* pictures/i.test(text)) return "image_retrieval";
  if (/staircase examples/i.test(text) || /staircase pictures/i.test(text)) return "image_retrieval";
  if (/starting[- ]step (pictures|examples|ideas)/i.test(text)) return "image_retrieval";
  if (/(feature|design|first[- ]?step) ideas/i.test(text)) return "image_retrieval";
  if (/give me a picture/i.test(text) || /show a picture/i.test(text)) return "image_retrieval";
  if (/(can you|could you) (show|give me)/i.test(text)) return "image_retrieval";
  if (/I want to see/i.test(text)) return "image_retrieval";
  if (/different versions/i.test(text)) return "image_retrieval";
  return "text_answer";
}

// --- Detect refacing-retention constraint (modernise-existing signal) ---
export function hasRetentionConstraint(text) {
  const lower = text.toLowerCase();
  const retentionSignals = [
    "existing", "current staircase", "my staircase", "the current",
    "without replacing", "don't replace", "don't rip", "without a full replacement",
    "keep the", "retain the", "keep some", "keep it",
    "refurb", "refacing", "reface", "refresh", "makeover",
    "make it look modern without", "without touching",
  ];
  return retentionSignals.some((s) => lower.includes(s));
}

// --- Extract stated preferences from an utterance ---
export function extractPreferences(text) {
  const lower = text.toLowerCase();
  const preferences = {};
  // Timber preference
  const timberWords = ["oak", "pine", "walnut", "mahogany", "maple", "beech", "ash", "cherry", "sapele"];
  for (const t of timberWords) {
    if (new RegExp("\\b" + t + "\\b", "i").test(text)) { preferences.timber_species = t; break; }
  }
  // Style intent
  const styleWords = [
    ["modern", "modern"], ["contemporary", "modern"], ["minimalist", "modern"],
    ["traditional", "traditional"], ["classical", "traditional"], ["period", "traditional"], ["victorian", "traditional"],
    ["scandinavian", "scandi"], ["scandi", "scandi"],
    ["industrial", "industrial"], ["coastal", "coastal"], ["rustic", "rustic"], ["cottage", "rustic"], ["farmhouse", "rustic"],
  ];
  for (const [w, style] of styleWords) {
    if (new RegExp("\\b" + w + "\\b", "i").test(text)) { preferences.style = style; break; }
  }
  // Finish intent — check compounds first ("carpet runner" is a runner, not carpet).
  if (/\bcarpet\s+runner\b/i.test(text) || /\brunner\b/i.test(text)) preferences.finish = "runner";
  else if (/\bcarpet(?:ed|ing)?\b/i.test(text) || /full carpet/i.test(text)) preferences.finish = "carpet";
  else if (/\bstep mats?\b/i.test(text)) preferences.finish = "step_mats";
  else if (/exposed timber/i.test(text) || /keep .* wood/i.test(text) || /keep the timber/i.test(text)) preferences.finish = "exposed_timber";
  // Style — a negation guard: "too modern" / "too traditional" is REJECTION, not a preference.
  // Handled by the exclusion extractor; ensure we don't set style from those phrases here.
  const tooTraditional = /\btoo\s+traditional\b/i.test(text);
  const tooModern = /\btoo\s+modern\b/i.test(text);
  if (preferences.style === "traditional" && tooTraditional) delete preferences.style;
  if (preferences.style === "modern" && tooModern) delete preferences.style;
  // Balustrade preference — "turned" MUST be qualified as spindles/balusters, not "turned newel".
  if (/glass/i.test(text)) preferences.balustrade_material = "glass";
  else if (/matt[- ]?black/i.test(text) || /black spindles/i.test(text) || /black metal/i.test(text)) preferences.balustrade_material = "matt_black_metal";
  else if (/brushed stainless/i.test(text) || /stainless steel/i.test(text) || /brushed stainless spindles?/i.test(text)) preferences.balustrade_material = "brushed_stainless";
  else if (/\bturned\s+(?:oak\s+|pine\s+|walnut\s+)?(?:spindles?|balusters?)\b/i.test(text)) preferences.balustrade_material = "turned_timber";
  // Construction constraint — CONSTITUTIONAL: only when the customer stated a STRUCTURAL fact,
  // not when they described an aesthetic. "cantilevered" / "floating treads" = structural.
  // Bare "floating-looking" / "modern-floating aesthetic" is DESIGN INTENT, never construction.
  if (/against a wall/i.test(text) || /\bwall[- ]fixed\b/i.test(text) || /fixed to the wall/i.test(text)) {
    preferences.construction = "wall_fixed";
  } else if (/open on both sides/i.test(text) || /\btwo[- ]sided\b/i.test(text)) {
    preferences.construction = "two_sided";
  } else if (
    // "cantilever" / "cantilevered" / "cantilever floating treads" — explicit structural language
    /\bcantilever(?:ed)?\b/i.test(text) ||
    /\bfloating\s+treads?\b/i.test(text) ||
    /\bmono[- ]?stringer\b/i.test(text) ||
    /\bcentral\s+spine\b/i.test(text)
  ) {
    // "cantilever if possible" / "cantilever if it fits" = customer intent, still explicit
    preferences.construction = "cantilever";
  }
  // NOTE (LOCKED): bare "floating" or "floating-looking" is deliberately NOT promoted to construction.
  // That is aesthetic intent and must remain a design_style signal only — never fabricated as construction.
  return preferences;
}

// ---------- Utterance function classifier ----------
// What is the customer ACTUALLY asking FOR? Not what concept they're touching.
// Ten distinct utterance functions per Philip's Layer 4 policy rewrite.
export function classifyUtteranceFunction(text) {
  const t = text.trim();
  const lower = t.toLowerCase();

  // Image requests take priority (semantic)
  if (detectQueryType(text) === "image_retrieval") return "image_request";
  if (detectQueryType(text) === "hybrid") return "image_request";

  // Refinement / correction — highest-signal because it modifies prior state
  if (/^\s*(?:actually|sorry|i mean|on second thought|scratch that|forget that|no wait|wait,|change that|second thoughts)/i.test(t)) {
    return "refinement_correction";
  }
  if (/\b(?:instead of|rather than)\b/i.test(t) && /\b(?:no|not)\b/i.test(t)) return "refinement_correction";

  // Comparison requests
  if (
    /\b(?:versus|vs\.?|which is better|which is best|difference between|compare|or better)\b/i.test(t) ||
    /\bwhich\s+\w+(?:\s+\w+)?\s+is\s+(?:best|better)/i.test(t) ||
    /\b\w+\s+or\s+\w+\s*[\?\.]?\s*$/i.test(t) ||
    /\b\w+\s+or\s+\w+\s+for\b/i.test(t)
  ) return "comparison_request";

  // Recommendation requests
  if (
    /\b(?:recommend|suggest|advise|what would you|which would you|what should i|what should you|how about)\b/i.test(t) ||
    /\b(?:can you recommend|what do you think i should|what's the best .* for)/i.test(t)
  ) return "recommendation_request";

  // Options requests
  if (
    /\b(?:what .* options|what .* choices|options for|choices for)\b/i.test(t) ||
    /\b(?:what starting[- ]step|what balustrade|what newel|what handrail|what railing)\b.*\?/i.test(t) ||
    /\bwhat can i (?:have|do|change|use)\b/i.test(t) ||
    /\bshow me the options/i.test(t)
  ) return "options_request";

  // Existential questions ("Do I need X?" / "Is X required?")
  if (
    /^\s*(?:do i need|does it need|is (?:a |an |the )?(?:\w+ )?(?:required|needed|necessary)|is there a (?:legal|building) )/i.test(t) ||
    /\bis there a (?:rule|regulation|requirement)\b/i.test(t)
  ) return "existential_question";

  // Problem statements
  if (
    /\b(?:creaks?|creaking|squeaks?|squeaky|wobbly|wobbles|loose|rot|rotting|dented|chipped|scratched|damaged|worn|broken)\b/i.test(t) &&
    !/^what|^how|^why/i.test(t)
  ) return "problem_statement";
  if (/\b(?:the (?:stairs|staircase|railing|newel|handrail|balustrade) (?:is|are|has|have) (?:broken|damaged|loose|wobbly|creaking))\b/i.test(t)) return "problem_statement";

  // Factual queries ("What is X?" / "Explain X" / "Tell me about X")
  if (
    /^\s*(?:what is|what's|what are|what does|what do)\b/i.test(t) ||
    /^\s*(?:explain|tell me about|describe|define)\b/i.test(t) ||
    /\bwhat (?:is|are) (?:a |an |the )?(?:\w+ ){0,3}(?:\?|called)/i.test(t)
  ) return "factual_query";
  if (/\bwhy (?:does|do|is|are|can't|cant|can|would|should)\b/i.test(t)) return "factual_query";

  // Exploration requests ("How do I...?" / "Where do I start?" / "What about...?")
  if (
    /^\s*(?:how do i|how can i|how would i|how should i|where do i|where would i)\b/i.test(t) ||
    /^\s*(?:can i|could i|is it possible)\b/i.test(t) ||
    /\b(?:where do i start|not sure where to start|help me choose|help me decide|help me narrow|help me figure)/i.test(t) ||
    /^\s*(?:i don'?t know|not sure|no idea)\b/i.test(t)
  ) return "exploration_request";

  // Preference statements (declarative, no question mark, ends with a preference/decision)
  // Detected by: no question intent + presence of preference words + declarative tone
  const hasQuestionSignal = /\?/.test(t) || /^\s*(?:what|why|how|which|when|where|who)/i.test(t) || /\bcan\s+i\b|\bcould\s+i\b/i.test(t);
  const isPreferenceStatement = !hasQuestionSignal && (
    /\b(?:i want|i need|i'd like|i would like|going with|let's go with|we'll go|we're going|definitely)\b/i.test(t) ||
    /^\s*(?:oak|pine|walnut|mahogany|glass|matt[- ]?black|stainless|traditional|modern|contemporary|scandi|minimalist|industrial)\b/i.test(t)
  );
  if (isPreferenceStatement) return "preference_statement";

  // Default: exploration
  return "exploration_request";
}

// ---------- State richness assessment ----------
export function assessStateRichness(model) {
  const state = model || {};
  const prefsCount = Object.keys(state.explicit_preferences || {}).length;
  const constraintsCount = Object.keys(state.explicit_constraints || {}).length;
  const totalSignals = prefsCount + constraintsCount;
  if (totalSignals <= 1) return "empty";
  if (totalSignals <= 3) return "partial";
  return "rich";
}

// --- The full compound decomposition ---
export function decomposeUtterance(text) {
  const detected = detectAllConcepts(text);
  const { primary, secondary } = classifyPrimarySecondary(detected.families);
  const tier = detectTier(text);
  const queryType = detectQueryType(text);
  const preferences = extractPreferences(text);
  const retention = hasRetentionConstraint(text);
  const utterance_function = classifyUtteranceFunction(text);
  return {
    text,
    query_type: queryType,
    tier,
    utterance_function,
    all_concepts: detected.families,
    primary_concept: primary,
    secondary_concepts: secondary,
    preferences,
    retention_constraint: retention,
    matched_keywords: detected.matched_keywords,
    is_compound: detected.families.length >= 2,
  };
}

// --- Multi-turn state model ---
export function createSession() {
  return {
    turns: [],
    established: {
      timber_species: null,
      style: null,
      finish: null,
      balustrade_material: null,
      construction: null,
      scope: null, // "refacing" | "full_build" | null
      concepts_visited: new Set(),
    },
  };
}

export function updateSession(session, utteranceDecomp) {
  session.turns.push(utteranceDecomp);
  // Merge preferences into established state (later turns update earlier state; never fully wipe)
  for (const [k, v] of Object.entries(utteranceDecomp.preferences)) {
    if (v) session.established[k] = v;
  }
  if (utteranceDecomp.retention_constraint) session.established.scope = "refacing";
  for (const c of utteranceDecomp.all_concepts) session.established.concepts_visited.add(c);
  return session;
}
