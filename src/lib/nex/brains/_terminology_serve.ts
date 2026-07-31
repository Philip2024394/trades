// Terminology direct-serve — smallest possible path from the 88
// authored atoms to a truthful runtime answer (Path B.1 · Philip 2026-07-30).
//
// This module bypasses the full V1 loader chain (_loader.ts strict-mode)
// and reads the Terminology draft JSON directly. Reason: reality has
// earned permission for Terminology · but has NOT earned permission for
// craft/regulations/materials/workflow/defects/pricing_model stubs to
// exist as empty placeholders just to satisfy the legacy loader. Empty
// stubs would be complexity that hasn't earned its place.
//
// When Gate 4 publishes to `hammerex_nex_brain_versions` and the DB
// path becomes real, this helper can be replaced with the normal
// retrieval chain. Until then it is the smallest path that respects
// the constitution.
//
// Rule B compliance: this file composes runtime responses from the
// atoms Philip authored. It does not author trade content itself.
// Rule A compliance: when no term matches, the caller receives null
// and must produce a truthful gap-naming response · never fabricate.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { TerminologyModuleSchema, type TerminologyModule, type TerminologyTerm } from "./_schema/terminology";
import { composeTeaching, type TeachingInput, type PresentedAnswer, type PresentationSection, extractBullets } from "./_presentation";

const DRAFTS_ROOT = ".author-studio-drafts";

type LoadedDraft = { payload: unknown };

/** Load the Terminology draft JSON for a brain. Returns null if the
 *  draft doesn't exist or fails schema validation · never throws. */
export async function loadTerminologyModule(brain_slug: string): Promise<TerminologyModule | null> {
  const p = path.join(process.cwd(), DRAFTS_ROOT, brain_slug, "terminology.json");
  let raw: string;
  try {
    raw = await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
  let json: LoadedDraft;
  try {
    json = JSON.parse(raw) as LoadedDraft;
  } catch {
    return null;
  }
  const parsed = TerminologyModuleSchema.safeParse(json.payload);
  if (!parsed.success) return null;
  return parsed.data;
}

/** Result of matching a user query against a Terminology module. */
export type TerminologyMatch =
  | { kind: "canonical"; term: TerminologyTerm }
  | { kind: "alias"; term: TerminologyTerm; matched_alias: string }
  | { kind: "none" };

/** Match a user query to a term in a Terminology module. Matching is
 *  intentionally simple: normalise the query, look for a canonical
 *  term or alias appearing as a whole word. First match wins. Rule B
 *  compliant: does not compose new content · returns pointers to
 *  authored atoms only. */
export function matchTerminology(module: TerminologyModule, query: string): TerminologyMatch {
  const q = query.toLowerCase();

  // Try canonical terms first (longer/more specific wins over shorter)
  const sorted = [...module.terms].sort((a, b) => b.term.length - a.term.length);
  for (const term of sorted) {
    if (wordContains(q, term.term.toLowerCase())) {
      return { kind: "canonical", term };
    }
  }
  // Then aliases
  for (const term of sorted) {
    for (const alias of term.aliases) {
      if (wordContains(q, alias.toLowerCase())) {
        return { kind: "alias", term, matched_alias: alias };
      }
    }
  }
  return { kind: "none" };
}

function wordContains(haystack: string, needle: string): boolean {
  // Whole-word match to avoid "landing" false-matching inside "understanding".
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, "i");
  return re.test(haystack);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compose the four-question atom set into a single truthful answer
 *  string. Rule B compliant: only concatenates already-authored strings ·
 *  never generates new trade content. */
export function composeTerminologyAnswer(term: TerminologyTerm): string {
  return [
    term.what_is_it,
    "",
    term.what_does_it_do,
    "",
    `**What homeowners call it:** ${term.what_do_homeowners_call_it}`,
    "",
    `**Commonly confused with:** ${term.commonly_confused_with}`
  ].join("\n");
}

/** List the canonical terms this module currently covers · used to
 *  build the truthful gap-naming response when a query doesn't match.
 *  Master constitutional prompt: "smallest truthful gap." */
export function listCoveredTerms(module: TerminologyModule): string[] {
  return module.terms.map((t) => t.term);
}

/** Adapt a Terminology term into TeachingInput. Teaching Intelligence takes it
 *  from there. Rule B compliant: only reorganises Philip's authored 4-question
 *  atoms · never invents. */
export function terminologyToTeaching(term: TerminologyTerm): TeachingInput {
  const primary_definition = term.what_is_it;
  const purpose_bullets = extractBullets(term.what_does_it_do);
  const fact_bullets = purpose_bullets.length > 0 ? purpose_bullets : [term.what_does_it_do];

  const glance_rows: Array<{ label: string; value: string }> = [];
  if (term.aliases.length > 0) {
    glance_rows.push({ label: "Also called", value: term.aliases.join(" · ") });
  }
  if (term.confused_with.length > 0) {
    glance_rows.push({ label: "Commonly confused with", value: term.confused_with.join(" · ") });
  }

  const common_questions = [
    `What is a ${term.term}?`,
    `What does a ${term.term} do?`,
    `What do homeowners call a ${term.term}?`,
    `What is a ${term.term} commonly confused with?`,
  ];

  const all_sections: PresentationSection[] = [
    { title: "What it is",           bullets: [term.what_is_it],                  truncated: false, full_count: 1, atom_type: "definition" },
    { title: "What it does",         bullets: [term.what_does_it_do],             truncated: false, full_count: 1, atom_type: "function" },
    { title: "What homeowners call it", bullets: [term.what_do_homeowners_call_it], truncated: false, full_count: 1, atom_type: "homeowner_language" },
    { title: "Commonly confused with", bullets: [term.commonly_confused_with],    truncated: false, full_count: 1, atom_type: "confusion" },
  ];

  const learn_more_topics: string[] = [];
  if (term.confused_with.length > 0) learn_more_topics.push("Related components");
  learn_more_topics.push("Materials");
  learn_more_topics.push("Installation");
  learn_more_topics.push("Design considerations");

  return {
    subject_name:                      term.term.charAt(0).toUpperCase() + term.term.slice(1),
    subject_subtitle:                  term.aliases[0] ?? null,
    primary_definition,
    fact_bullets,
    glance_rows,
    advantages:                        [],
    disadvantages_and_considerations:  [term.commonly_confused_with],
    compatible_options:                [],
    related_topics:                    term.confused_with,
    common_questions,
    all_sections,
    learn_more_topics,
    image_url:                         null,
  };
}

/** Compose a Terminology answer as a PresentedAnswer via Teaching Intelligence. */
export function composeTerminologyPresentation(term: TerminologyTerm): PresentedAnswer {
  return composeTeaching(terminologyToTeaching(term));
}
