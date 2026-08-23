// NEX Staircase Knowledge Adapter · Public API
//
// Philip 2026-08-17 · STANDING · LOAD-BEARING.
//
// The ONLY place the UI meets the frozen research corpus. Every
// staircase-facing component imports from `@/lib/staircase-knowledge`
// and NEVER touches the JSON files directly. See ./README.md for the
// full doctrine.
//
// The functions here are intentionally small · deterministic · pure ·
// side-effect free. They do not fetch, cache, mutate, or persist. The
// data is compiled in via JSON imports at build time.
//
// Missing knowledge is returned explicitly (undefined · confidence
// 'unknown') rather than filled with a guess. This is the UNKNOWN
// lifecycle rule from research-gaps.md:
//   CORRECT: UNKNOWN → research → source → confidence → validation → promoted
//   FORBIDDEN: UNKNOWN → developer guesses → permanent product behaviour
//
// If you need to add a concept, edit the JSON in `research/` (working
// set), snapshot a new v-directory, refresh the ./data/ copies, and
// bump CORPUS_VERSION. Never edit ./data/ files directly.

import terminologyJson from "./data/staircase-terminology-global.json";
import decisionTreeJson from "./data/staircase-decision-tree.json";
import compatibilityJson from "./data/staircase-compatibility.json";
import regionalJson from "./data/staircase-regional-terminology.json";

import type {
  AlternativeSet,
  CompatibilityFile,
  CompatibilityRule,
  ConceptRecord,
  Confidence,
  CountryCode,
  CustomerExplanation,
  DecisionNode,
  DecisionOption,
  DecisionTree,
  LayerKey,
  RegionalPack,
  RegionalTerminologyFile,
  SpecialistReviewRequirement,
  TerminologyGlobal,
  WizardNode,
} from "./types";

export const CORPUS_VERSION = "1.1.0";
export const CORPUS_SNAPSHOT = "2026-08-17";

// ─── Casts ─────────────────────────────────────────────────────────
// JSON imports come in as `unknown` shapes. Cast once here so the rest
// of the file benefits from typed access — the JSON schema is stable
// enough that this cast is safe as long as CORPUS_VERSION is bumped in
// step with data changes.

const TERMINOLOGY = terminologyJson as unknown as TerminologyGlobal;
const DECISION_TREE = decisionTreeJson as unknown as DecisionTree;
const COMPATIBILITY = compatibilityJson as unknown as CompatibilityFile;
const REGIONAL = regionalJson as unknown as RegionalTerminologyFile;

// ─── Index for O(1) concept lookup by id ───────────────────────────

const CONCEPT_INDEX: Map<string, { concept: ConceptRecord; layer: LayerKey }> =
  (() => {
    const map = new Map<string, { concept: ConceptRecord; layer: LayerKey }>();
    for (const [layerKey, layer] of Object.entries(TERMINOLOGY.layers ?? {})) {
      if (!layer?.concepts) continue;
      for (const concept of layer.concepts) {
        map.set(concept.id, { concept, layer: layerKey as LayerKey });
      }
    }
    return map;
  })();

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

/** Return a raw concept record by id, or undefined if the id is not in
 *  the corpus. Prefer `getCustomerExplanation` for UI use — it wraps
 *  the raw record with plain-English + regional label already resolved.
 */
export function getConcept(conceptId: string): ConceptRecord | undefined {
  return CONCEPT_INDEX.get(conceptId)?.concept;
}

/** List every concept in a given taxonomy layer, in the order the
 *  corpus declares them. */
export function getConceptsForLayer(layer: LayerKey): ConceptRecord[] {
  return TERMINOLOGY.layers[layer]?.concepts ?? [];
}

/** Every layer key that has at least one concept in the corpus. */
export function getLayers(): LayerKey[] {
  return Object.keys(TERMINOLOGY.layers) as LayerKey[];
}

/** The customer-facing explanation for a concept, including its regional
 *  label if a country is supplied. Never throws · returns an explicit
 *  UNKNOWN sentinel when the concept is missing. */
export function getCustomerExplanation(
  conceptId: string,
  country?: CountryCode,
): CustomerExplanation {
  const concept = CONCEPT_INDEX.get(conceptId)?.concept;
  if (!concept) {
    return {
      canonical: conceptId,
      plain: "This concept isn't in the current knowledge base yet.",
      confidence: "unknown",
    };
  }
  const regional = country ? getRegionalTerm(conceptId, country) : undefined;
  return {
    canonical: concept.canonical_en,
    plain:
      concept.customer_language ??
      // Fallback: no plain-English explanation exists yet — surface the
      // canonical name so the UI still has something to render, but
      // signal 'medium' rather than 'high' so downstream code can
      // choose to flag it for a copywriter.
      concept.canonical_en,
    confidence: concept.confidence ?? "medium",
    regional_label: regional,
    regional_notes: concept.notes,
  };
}

/** The local-language label for a concept in a given country, or
 *  undefined if the concept doesn't have a regional mapping for that
 *  country. Returns the raw string from the corpus — the UI may need
 *  to pick the first entry when the value contains " / " separated
 *  synonyms. */
export function getRegionalTerm(
  conceptId: string,
  country: CountryCode,
): string | undefined {
  const concept = CONCEPT_INDEX.get(conceptId)?.concept;
  if (!concept) return undefined;
  return (
    concept.regional?.[country] ??
    concept.regional_species?.[country] ??
    undefined
  );
}

/** Given a decision-tree option value, return the set of alternatives
 *  the wizard should visually compare when the customer picks "I'm not
 *  sure" — or `undefined` if that node has no comparison set.
 *
 *  Rule from research (customer-language principle): the customer
 *  chooses visually FIRST, learns terminology AFTER. */
export function getAlternatives(
  nodeId: string,
): AlternativeSet | undefined {
  const node = DECISION_TREE.nodes[nodeId];
  if (!node?.options) return undefined;
  const notSure = node.options.find(
    (opt) => opt.value === "not_sure" && Array.isArray(opt.compare),
  );
  if (!notSure?.compare) return undefined;

  const alternatives = notSure.compare
    .map((value) => {
      const opt = node.options?.find((o) => o.value === value);
      if (!opt) return null;
      const concept = opt.concept_id
        ? CONCEPT_INDEX.get(opt.concept_id)?.concept
        : undefined;
      const explanation = opt.concept_id
        ? getCustomerExplanation(opt.concept_id)
        : undefined;
      return {
        value: opt.value,
        label: opt.label,
        concept_id: opt.concept_id,
        plain_en: explanation?.plain,
        image_url: concept?.image_url,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    question_id: nodeId,
    question_plain_en:
      node.explanation_en ?? node.question_en ?? "Compare the options",
    alternatives,
  };
}

/** Return the compatibility rule that fires for a proposed
 *  combination of selections, if any. Never says "impossible" — the
 *  strongest response is `specialist_review_required`.
 *
 *  Matching is intentionally simple: every key in the rule's `if`
 *  block must equal the corresponding key in `selections`. Array
 *  values in `if` match if the selection is IN the array. Missing
 *  selections skip the rule (rules never fire on partial state). */
export function getCompatibility(
  selections: Record<string, string | undefined>,
): CompatibilityRule[] {
  const fires: CompatibilityRule[] = [];
  for (const rule of COMPATIBILITY.rules) {
    if (matchesRule(rule.if, selections)) fires.push(rule);
  }
  return fires;
}

function matchesRule(
  ifBlock: Record<string, unknown>,
  selections: Record<string, string | undefined>,
): boolean {
  for (const [key, expected] of Object.entries(ifBlock)) {
    const actual = selections[key];
    if (actual === undefined) return false; // partial state → skip
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else if (expected !== actual) {
      return false;
    }
  }
  return true;
}

/** Fetch a wizard node ready to render. Resolves country-aware option
 *  sets. Returns undefined if the node id is unknown. */
export function getDecisionNode(
  nodeId: string,
  country?: CountryCode,
): WizardNode | undefined {
  const node = DECISION_TREE.nodes[nodeId];
  if (!node) return undefined;

  // Country-aware option resolution: some nodes (e.g. Q7a_timber_species)
  // ship different options per country. As of corpus v1.2 each entry
  // is a full `DecisionOption` (value + label + optional image_url,
  // origin, hardness, compatible_with, next, etc.) — the adapter
  // passes the WHOLE option through UNCHANGED so downstream surfaces
  // (ST-M01 wood catalogue, NEX Brain, Submission) all read the same
  // identity + rendering metadata.
  //
  // Historic v1.0 shape (bare `string[]` where the adapter derived a
  // slug from the label) is still supported for defensive reading,
  // but will emit a console warning in development so drift is
  // visible during refactors.
  //
  // Prior implementation (pre-2026-08-20) remapped to
  // {value, label} only, silently dropping image_url et al — bug
  // caught when Q7a images stopped rendering after per-species images
  // were added to the UK country array (Philip 2026-08-20).
  let options: DecisionOption[] = node.options ?? [];
  if (
    node.region_aware &&
    node.options_by_country &&
    country &&
    node.options_by_country[country]
  ) {
    const raw = node.options_by_country[country]!;
    options = raw.map((entry) => {
      if (typeof entry === "string") {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[staircase-knowledge] Q${nodeId} country ${country}: legacy string option "${entry}" — bump corpus to v1.2+ shape (full DecisionOption).`,
          );
        }
        return {
          value: entry.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          label: entry,
        };
      }
      return entry;
    });
  }

  return {
    id: nodeId,
    question: node.question_en,
    explanation: node.explanation_en,
    type: node.type,
    options,
    isTerminal: node.type === "handoff" || node.type === "review_screen",
    // Type-specific pass-throughs (Philip 2026-08-18 · textarea + info_card
    // introduced for the project-classification block). Left undefined
    // when the node isn't one of those types · consumers gate on `type`
    // before reading these.
    placeholder: node.placeholder_en,
    maxLength: node.max_length,
    body: node.body_en,
    ctaLabel: node.cta_label_en,
  };
}

/** The root wizard node id (customer's first screen). */
export function getRootNodeId(): string {
  return DECISION_TREE.root;
}

/** Given the current node id and the customer's picked value, return
 *  the id of the next node. Uses `conditional_next` when present
 *  (checks selections for the matching condition), else falls back to
 *  the option's `next` or the node's `next`. Returns undefined when
 *  the wizard has reached its end. */
export function getNextNodeId(
  currentNodeId: string,
  pickedValue: string,
  allSelections: Record<string, string | undefined>,
): string | undefined {
  const node = DECISION_TREE.nodes[currentNodeId];
  if (!node) return undefined;

  const opt = node.options?.find((o) => o.value === pickedValue);
  if (opt?.route) return opt.route;
  if (opt?.next) return opt.next;

  if (node.conditional_next) {
    for (const [cond, target] of Object.entries(node.conditional_next)) {
      if (cond === "else") continue;
      // Two supported condition formats (Philip 2026-08-19):
      //   1. `if:<nodeId>=<value>`  — preferred, unambiguous split on `=`,
      //      keys straight against `allSelections` which is keyed by
      //      NODE ID (e.g. "Q3_geometry", "Q5_structural"). Example:
      //      `if:Q3_geometry=spiral`.
      //   2. `if_<field>_<value>`   — legacy format, retained for
      //      backwards-compat with any older `conditional_next` blocks.
      //      NOTE: this legacy pattern was silently broken for a long
      //      time (`allSelections["geometry"]` never resolved because
      //      answers were keyed by node ID). Historical blocks using
      //      this pattern should migrate to the `if:` form.
      const modernMatch = cond.match(/^if:([^=]+)=(.+)$/);
      if (modernMatch) {
        const [, nodeIdKey, value] = modernMatch;
        if (allSelections[nodeIdKey] === value) return target;
        continue;
      }
      const legacyMatch = cond.match(/^if_([a-z_]+?)_([a-z_]+)$/);
      if (legacyMatch) {
        const [, field, value] = legacyMatch;
        if (allSelections[field] === value) return target;
      }
    }
    if (node.conditional_next.else) return node.conditional_next.else;
  }

  return node.next;
}

/** Given a set of selections, does the wizard need to route to a
 *  specialist before it can proceed? Returns `required: true` when any
 *  compatibility rule fires with a `specialist_review_required`-style
 *  `then` value, or when any selected option carries a
 *  `specialist_review_required` flag. */
export function getSpecialistReviewRequirement(
  selections: Record<string, string | undefined>,
): SpecialistReviewRequirement {
  const fires = getCompatibility(selections);
  const strong = fires.find(
    (r) =>
      r.then === "specialist_review_required" ||
      r.then === "specialist_review_required_strong",
  );
  if (strong) {
    return {
      required: true,
      reason: strong.description,
      rule_id: strong.id,
      regional_thresholds: strong.regional_thresholds,
    };
  }
  // Also scan selections for options flagged specialist_review_required
  // directly in the decision tree (e.g. bifurcated geometry).
  for (const [field, value] of Object.entries(selections)) {
    if (!value) continue;
    for (const node of Object.values(DECISION_TREE.nodes)) {
      const opt = node.options?.find((o) => o.value === value);
      if (opt?.flag === "specialist_review_required") {
        return {
          required: true,
          reason: `${field}: ${opt.label} — specialist review recommended`,
        };
      }
    }
  }
  return { required: false };
}

/** Fetch the regional terminology pack for a country. Returns undefined
 *  when the country isn't in the corpus. */
export function getRegionalPack(country: CountryCode): RegionalPack | undefined {
  return REGIONAL.countries[country];
}

/** Every country the corpus knows about. */
export function getSupportedCountries(): CountryCode[] {
  return Object.keys(REGIONAL.countries) as CountryCode[];
}

/** Regional defaults for a country (most common geometry, material,
 *  structural approach etc.) — useful for pre-selecting sensible
 *  starting values in the wizard. */
export function getRegionalDefaults(country: CountryCode) {
  return COMPATIBILITY.regional_common_defaults[country];
}

// Re-exports so consumers can type their local state cleanly.
export type {
  AlternativeSet,
  CompatibilityRule,
  ConceptRecord,
  Confidence,
  CountryCode,
  CustomerExplanation,
  DecisionNode,
  DecisionOption,
  LayerKey,
  RegionalPack,
  SpecialistReviewRequirement,
  WizardNode,
};
