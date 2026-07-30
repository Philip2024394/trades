// Terminology module — the smallest schema that truthfully represents
// the four-question atomic shape reality earned during Gates 1-3
// (Philip 2026-07-30 · Path B.1 · locked).
//
// Every term is one node with four two-sentence atoms + the graph edges
// they imply. Retrieval walks term → aliases → confusion edges. Nothing
// more. No Learning engine, no Discovery engine, no Curiosity engine,
// no graph database, no 15 composition modes.
//
// Constitutional shape (Philip 2026-07-30):
//   • WHAT IS IT?           — 2 sentences
//   • WHAT DOES IT DO?      — 2 sentences
//   • WHAT DO HOMEOWNERS
//     CALL IT?              — 2 sentences (also seeds aliases[])
//   • COMMONLY CONFUSED
//     WITH?                 — 2 sentences (also seeds confused_with[])
//
// The atoms preserve the four-question structure at runtime · they are
// not flattened into a single definition. The graph is emergent — the
// confused_with array is walked in code when a related-terminology
// answer is composed. No separate graph database is required or
// permitted.

import { z } from "zod";
import { EvidenceCiteSchema, ModuleHeaderSchema } from "./common";

/** One four-question atom set for one term. Every field is a two-sentence
 *  expert-authored string. Aliases and confused_with are derived from the
 *  authored answers and stored explicitly so retrieval can walk them
 *  without re-parsing the prose at query time. */
export const TerminologyTermSchema = z.object({
  /** Canonical form the module uses to identify the term. Lowercase.
   *  Example: "baluster", "rise", "going". */
  term:                        z.string().min(1),

  /** Answer to WHAT IS IT? — 2 sentences · expert-authored. */
  what_is_it:                  z.string().min(1),

  /** Answer to WHAT DOES IT DO? — 2 sentences · expert-authored. */
  what_does_it_do:             z.string().min(1),

  /** Answer to WHAT DO HOMEOWNERS CALL IT? — 2 sentences · expert-authored. */
  what_do_homeowners_call_it:  z.string().min(1),

  /** Answer to COMMONLY CONFUSED WITH? — 2 sentences · expert-authored. */
  commonly_confused_with:      z.string().min(1),

  /** Homeowner-language aliases derived from the authored WHAT DO
   *  HOMEOWNERS CALL IT? answer. Used by retrieval to match homeowner
   *  phrasing to the canonical term. Rule B compliant · derived only
   *  from expert-authored content. */
  aliases:                     z.array(z.string()).default([]),

  /** Terms this one is commonly confused with — canonical form of each.
   *  Derived from the authored COMMONLY CONFUSED WITH? answer. Used by
   *  the composer to walk the confusion graph when a user asks about
   *  a related term. */
  confused_with:               z.array(z.string()).default([]),

  /** Evidence citations for this term. Traces to Gate-1-verified source
   *  files. Rule C compliant. */
  evidence:                    z.array(EvidenceCiteSchema).default([])
});
export type TerminologyTerm = z.infer<typeof TerminologyTermSchema>;

export const TerminologyModuleSchema = z.object({
  header: ModuleHeaderSchema,
  terms:  z.array(TerminologyTermSchema).min(1)
});
export type TerminologyModule = z.infer<typeof TerminologyModuleSchema>;
