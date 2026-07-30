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
