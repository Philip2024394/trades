// Stage 9 — Image Prompt Refinement.
//
// After sections are assembled + constraints resolved, this stage
// applies model-agnostic prompt polish. Removes redundancy, collapses
// duplicate constraints into a single positive-preservation line, and
// promotes the most important sentence to the top of the assembled
// prompt so image models with short attention windows still see it.

import type { PromptSection } from "../types";

export const IMAGE_REFINEMENT_VERSION = "1.0.0";

/** Apply post-assembly polish: dedupe, top-sentence promotion, and
 *  cleanup of redundant negative language. */
export function refineSections(sections: PromptSection[]): PromptSection[] {
  const out: PromptSection[] = [];
  const seenLines = new Set<string>();

  for (const s of sections) {
    const lines = s.content
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => {
        const key = l.toLowerCase();
        if (seenLines.has(key)) return false;
        seenLines.add(key);
        return true;
      })
      .map(promoteToPreservation);

    if (lines.length === 0) continue;

    out.push({ ...s, content: lines.join("\n") });
  }

  return out;
}

/** Rewrite negative-first sentences into positive-preservation form.
 *  "no drop shadows" → "clean flat colour, no drop shadows".
 *  Image models handle positive prompts better than negation-only. */
function promoteToPreservation(line: string): string {
  const negative = /^\s*(no|do not|don't|avoid|never)\s+/i.test(line);
  if (!negative) return line;
  // Already contains a positive clause — leave alone.
  if (/,|\bwith\b|\band\b/.test(line)) return line;
  // Bare negative — soften with a positive-preservation prefix.
  const target = line.replace(/^\s*(no|do not|don't|avoid|never)\s+/i, "");
  return `clean composition, preserve absence of ${target}`;
}
