// Knowledge conflict detector (Philip 2026-08-01)
//
// Philip's biggest remaining gap:
//   "Imagine Philip later writes: Oak Guide 2026 → European Oak is best.
//   Six months later: Luxury Stair Guide → American White Oak is preferred.
//   Now the brain has conflicting truth. Someone needs to know."
//
// Flow:
//   1. New content published
//   2. For each new section · find existing sections that discuss the
//      same subject (keyword-based match against section titles + body)
//   3. If overlaps found · ask LLM whether the new statement contradicts
//      any existing statement
//   4. Return conflict warnings for Philip to see
//
// Runs asynchronously after publish · non-blocking · zero risk to save.

import "server-only";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { completeJson } from "@/lib/llm/anthropic";

const CORPUS_ROOT = "data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-instances";

export type ConflictWarning = {
  new_section:      string;
  existing_file:    string;
  existing_section: string;
  summary:          string;
};

type ExistingSection = {
  file:    string;
  heading: string;
  body:    string;
};

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const closeIdx = raw.indexOf("\n---", 3);
  if (closeIdx <= 0) return raw;
  return raw.slice(closeIdx + 4).replace(/^\r?\n/, "");
}

/** Load every ## section from every knowledge-base file (except the one we
 *  just wrote) · used as the candidate set for conflict checks. */
function loadExistingSections(excludeFileSlug: string): ExistingSection[] {
  const dir = join(process.cwd(), CORPUS_ROOT);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith(`${excludeFileSlug}.`));
  const sections: ExistingSection[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), "utf8");
      const body = stripFrontmatter(raw);
      const lines = body.split("\n");
      let currentHeading = "";
      let currentBody: string[] = [];

      const commit = () => {
        const bodyText = currentBody.join("\n").trim();
        if (currentHeading && bodyText.length > 40 && bodyText.length < 2500) {
          sections.push({ file, heading: currentHeading, body: bodyText });
        }
      };

      for (const line of lines) {
        const h2 = line.match(/^##\s+(.+?)\s*$/);
        if (h2) {
          commit();
          currentHeading = h2[1].trim();
          currentBody = [];
          continue;
        }
        if (/^#\s+/.test(line)) continue;
        currentBody.push(line);
      }
      commit();
    } catch {
      // skip unreadable
    }
  }
  return sections;
}

/** Quick keyword-overlap check · used to pre-filter which existing sections
 *  are worth sending to the LLM for conflict comparison. */
function tokenSet(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^\w\s'-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let hits = 0;
  for (const t of a) if (b.has(t)) hits += 1;
  return hits;
}

const CONFLICT_CHECK_PROMPT = `You compare two sections of a knowledge base to check if they CONTRADICT each other.

Return JSON:
{
  "contradicts": true | false,
  "summary": "one-sentence description of the contradiction · empty string if no contradiction"
}

A CONTRADICTION means the two statements make claims that cannot both be true. Examples of contradictions:
- Statement A: "European Oak is the best premium choice"
- Statement B: "American White Oak is preferred for premium work"
- → contradicts (opinion-vs-opinion on same question)

- Statement A: "Oak treads should be 32mm thick"
- Statement B: "Oak treads must be 40mm thick minimum"
- → contradicts (concrete facts disagree)

NOT contradictions:
- Two sections that cover DIFFERENT topics
- Same claim worded differently
- One general statement + one specific exception
- Different recommendations for different contexts (e.g. one for modern, one for traditional)

Only flag genuine contradictions. Be conservative · false positives waste Philip's time.

Return ONLY the JSON · no prose.`;

type LlmConflictOutput = {
  contradicts: boolean;
  summary:     string;
};

async function checkPairForConflict(
  newSection: { heading: string; body: string },
  existing: ExistingSection,
): Promise<ConflictWarning | null> {
  const userMessage = `NEW SECTION (just published):
Heading: ${newSection.heading}
Body: ${newSection.body}

EXISTING SECTION (from ${existing.file}):
Heading: ${existing.heading}
Body: ${existing.body}

Do these contradict?`;

  const result = await completeJson<LlmConflictOutput>({
    system: CONFLICT_CHECK_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 200,
    temperature: 0,
    model: "claude-haiku-4-5-20251001",
  });

  if (!result || !result.contradicts) return null;
  return {
    new_section:      newSection.heading,
    existing_file:    existing.file,
    existing_section: existing.heading,
    summary:          result.summary || "Possible contradiction",
  };
}

/**
 * Compare each new section against existing corpus · flag contradictions.
 * Uses keyword overlap to pre-filter candidates then LLM to confirm.
 */
export async function detectConflicts(
  newFileSlug: string,
  newSections: Array<{ heading: string; body: string }>,
): Promise<ConflictWarning[]> {
  const existingSections = loadExistingSections(newFileSlug);
  if (existingSections.length === 0) return [];

  const warnings: ConflictWarning[] = [];
  const MIN_OVERLAP = 4;   // require 4+ shared tokens to bother the LLM
  const MAX_CHECKS_PER_SECTION = 3; // cap LLM calls per new section

  for (const newSection of newSections) {
    const newTokens = tokenSet(newSection.heading + " " + newSection.body);
    // Rank existing sections by keyword overlap
    const ranked = existingSections
      .map((es) => ({ es, score: overlapScore(newTokens, tokenSet(es.heading + " " + es.body)) }))
      .filter((r) => r.score >= MIN_OVERLAP)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CHECKS_PER_SECTION);

    for (const { es } of ranked) {
      const conflict = await checkPairForConflict(newSection, es);
      if (conflict) warnings.push(conflict);
    }
  }
  return warnings;
}
