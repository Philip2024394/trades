// Generic module direct-serve · Path B.1 extension (Philip 2026-07-30 activation).
//
// Extends the same "read draft JSON directly · Rule B compliant · smallest possible path"
// discipline that _terminology_serve.ts applies to Terminology · but for the other 6
// modules (Types · Materials · Components · Installation · Design · FAQ).
//
// Modules are extracted from Layer 2 markdown drafts by scripts/_extract-module-atoms.mjs
// into `.author-studio-drafts/staircase/{module}.json`.
//
// Rule A: no fabrication · returns only atoms Philip authored via composition.
// Rule B: source is expert-authored · composition preserves authorship.
// Rule C: every atom carries source_ref back to the Layer 2 draft.
// Rule NEW: no data missed at extraction · fallback truthful when nothing matches.
//
// When Gate 4 publishes to hammerex_nex_brain_versions, this helper is replaced
// by the normal retrieval chain. Until then it is the smallest path that
// respects the constitution for the remaining 6 modules.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { composeTeaching, type TeachingInput, type PresentedAnswer, type PresentationSection } from "./_presentation";

const DRAFTS_ROOT = ".author-studio-drafts";

export const ModuleAtomSchema = z.object({
  text:              z.string().min(1),
  source_ref:        z.string().nullable(),
  section:           z.string().nullable(),
  type:              z.string().nullable(),
  verification_note: z.string().nullable().optional(),
});
export type ModuleAtom = z.infer<typeof ModuleAtomSchema>;

export const ModulePayloadSchema = z.object({
  header: z.object({
    title:         z.string(),
    version:       z.string(),
    authored_by:   z.string(),
    authored_at:   z.string(),
    regions:       z.array(z.string()).default([]),
    source_draft:  z.string().optional(),
    note:          z.string().optional(),
  }),
  atoms:    z.array(ModuleAtomSchema).min(1),
  keywords: z.array(z.string()).default([]),
});
export type ModulePayload = z.infer<typeof ModulePayloadSchema>;

export const MODULE_SLUGS = ["types", "materials", "components", "installation", "design", "faq", "type_profiles"] as const;
export type ModuleSlug = typeof MODULE_SLUGS[number];

/** Load a module's runtime JSON. Never throws. Returns null on any failure. */
export async function loadModule(brain_slug: string, module_slug: ModuleSlug): Promise<ModulePayload | null> {
  const p = path.join(process.cwd(), DRAFTS_ROOT, brain_slug, `${module_slug}.json`);
  let raw: string;
  try { raw = await fs.readFile(p, "utf8"); } catch { return null; }
  let j: { payload?: unknown };
  try { j = JSON.parse(raw) as { payload?: unknown }; } catch { return null; }
  const parsed = ModulePayloadSchema.safeParse(j.payload);
  if (!parsed.success) return null;
  return parsed.data;
}

// ─── Matching ────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","must","shall",
  "i","you","he","she","it","we","they","me","him","her","us","them","my","your",
  "his","its","our","their","this","that","these","those","and","or","but","if",
  "then","when","where","what","which","who","whom","how","why","not","no","yes",
  "for","on","in","at","by","with","of","to","from","up","down","out","over","under",
  "some","any","all","each","every","most","many","much","more","less","few",
  "can","cannot","cant","dont","doesnt","don't","doesn't","isn't","isnt","aren't","arent",
  "about","tell","show","give","need","want","get","take","make","use","see","know",
  "please","help","just","also","only","really","very","too","so","then",
  "s","t","d","ll","re","ve","m",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

/** A candidate atom scored against a query. */
export type ModuleMatch = {
  atom:  ModuleAtom;
  score: number;
  matched_terms: string[];
};

/** Score every atom in a module against a query · return top matches
 *  above threshold · sorted by score descending. */
export function matchModule(module_data: ModulePayload, query: string, opts?: { limit?: number; minScore?: number }): ModuleMatch[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const querySet = new Set(queryTokens);

  const matches: ModuleMatch[] = [];
  for (const atom of module_data.atoms) {
    const atomTokens = tokenize(atom.text);
    if (atomTokens.length === 0) continue;
    const atomSet = new Set(atomTokens);
    let score = 0;
    const matched: string[] = [];
    for (const q of querySet) {
      if (atomSet.has(q)) { score++; matched.push(q); }
    }
    // Section title also contributes
    if (atom.section) {
      const sectionTokens = tokenize(atom.section);
      for (const s of sectionTokens) {
        if (querySet.has(s) && !matched.includes(s)) { score += 0.5; matched.push(s); }
      }
    }
    if (score > 0) matches.push({ atom, score, matched_terms: matched });
  }

  const minScore = opts?.minScore ?? 1;
  const limit = opts?.limit ?? 3;
  return matches
    .filter(m => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Compose an answer from matched atoms · Rule B compliant · returns null
 *  when no matches or matches are too weak to compose an honest answer. */
export function composeModuleAnswer(matches: ModuleMatch[], moduleTitle: string): string | null {
  if (matches.length === 0) return null;
  const top = matches[0];
  // Single strong match: just return its text
  if (matches.length === 1 || matches[0].score > matches[1].score * 1.5) {
    return `${top.atom.text}${top.atom.type ? ` *(${top.atom.type})*` : ""}`;
  }
  // Multiple matches: compose 2-3 with clear separators
  const parts = matches.slice(0, 3).map(m => `- ${m.atom.text}${m.atom.type ? ` *(${m.atom.type})*` : ""}`);
  return `From ${moduleTitle}:\n\n${parts.join("\n")}`;
}

/** Adapt findBestModule result into TeachingInput. Same shape as other adapters. */
export function moduleMatchToTeaching(
  result: { module_slug: ModuleSlug; module_title: string; matches: ModuleMatch[] },
  querySubject: string
): TeachingInput {
  const isType = (t: string | null | undefined, ...targets: string[]) =>
    t !== null && t !== undefined && targets.some(s => t === s || t.startsWith(s));

  const atoms = result.matches;
  const factualAtoms = atoms.filter(m => isType(m.atom.type, "factual", "classification"));
  const expertAtoms  = atoms.filter(m => isType(m.atom.type, "expert perspective"));
  const warningAtoms = atoms.filter(m => isType(m.atom.type, "warning"));
  const directiveAtoms = atoms.filter(m => isType(m.atom.type, "directive"));

  const primary_definition = (factualAtoms[0] ?? atoms[0])?.atom.text ?? "";
  const fact_bullets = factualAtoms.slice(0, 5).map(m => m.atom.text);
  const advantages   = expertAtoms.slice(0, 5).map(m => m.atom.text);
  const disadvantages_and_considerations = [
    ...warningAtoms.slice(0, 3).map(m => m.atom.text),
    ...directiveAtoms.slice(0, 3).map(m => m.atom.text),
  ];

  const all_sections: PresentationSection[] = [{
    title:      result.module_title,
    bullets:    atoms.map(m => m.atom.text),
    truncated:  false,
    full_count: atoms.length,
    atom_type:  "module_match",
  }];

  return {
    subject_name:                     querySubject.charAt(0).toUpperCase() + querySubject.slice(1),
    subject_subtitle:                 result.module_title,
    primary_definition,
    fact_bullets,
    glance_rows:                      [],
    advantages,
    disadvantages_and_considerations,
    compatible_options:               [],
    related_topics:                   [],
    common_questions:                 [],
    all_sections,
    learn_more_topics:                [result.module_title],
    image_url:                        null,
  };
}

/** Compose a findBestModule result as a PresentedAnswer via Teaching Intelligence. */
export function composeModuleMatchPresentation(
  result: { module_slug: ModuleSlug; module_title: string; matches: ModuleMatch[] },
  querySubject: string
): PresentedAnswer {
  return composeTeaching(moduleMatchToTeaching(result, querySubject));
}

/** Given a query, try every module and return the module with the best score
 *  plus its matches. Returns null when no module produces any match. */
export async function findBestModule(brain_slug: string, query: string): Promise<
  { module_slug: ModuleSlug; module_title: string; matches: ModuleMatch[] } | null
> {
  let best: { module_slug: ModuleSlug; module_title: string; matches: ModuleMatch[]; topScore: number } | null = null;
  for (const slug of MODULE_SLUGS) {
    const module_data = await loadModule(brain_slug, slug);
    if (!module_data) continue;
    const matches = matchModule(module_data, query, { limit: 3, minScore: 2 });
    if (matches.length === 0) continue;
    const topScore = matches[0].score;
    if (!best || topScore > best.topScore) {
      best = { module_slug: slug, module_title: module_data.header.title, matches, topScore };
    }
  }
  return best ? { module_slug: best.module_slug, module_title: best.module_title, matches: best.matches } : null;
}
