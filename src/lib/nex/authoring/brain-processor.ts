// Nex Brain Processor · Author Mode (Philip 2026-08-01)
//
// Product Engineer Directive from Philip:
//   "The founder is the primary knowledge author. The authoring system
//   must optimise for speed of knowledge capture, not governance.
//   Founder-authored content is processed automatically through grammar
//   correction, spelling correction, formatting, indexing, embeddings,
//   topic extraction, and storage without approval loops. The system
//   may only interrupt when it cannot determine the author's intended
//   meaning with high confidence."
//
// Flow:
//   Raw paste → LLM processor → structured file written directly to
//   corpus with `advisor_status: approved` (no review queue) → summary
//   returned to admin.

import "server-only";
import { completeJson } from "@/lib/llm/anthropic";
import { publishParsed } from "./writer";
import type { ParsedSection } from "./parser";

const BRAIN_PROCESSOR_SYSTEM_PROMPT = `You are the Nex Brain Processor. Your job is to take raw notes from Philip O'Farrell (the founder and domain author for Nex Stairplan) and turn them into clean, structured Nex-format knowledge that goes directly into the Brain.

## What you MUST do

1. **Preserve Philip's meaning exactly.** Do not add facts. Do not remove facts. Do not soften or embellish. His expertise is the source of truth.

2. **Fix grammar and spelling silently.** No comments about what you fixed · just fix it.

3. **Structure into clear sections.** Each ## heading = one searchable topic. Group related content together. Keep sections focused (60-2500 chars each).

4. **Write ## headings as customer questions or clear topics.**
   - GOOD: "Why is oak popular?" · "How do I choose a staircase style?" · "Oak vs pine"
   - BAD: "Notes on oak" · "Section 1" · "Various points"

5. **Write section bodies in warm professional prose.**
   - Full sentences (not just bullets)
   - UK spelling (colour, favourite, organise)
   - Direct · specialist tone

6. **Return a topic_name** — a clean file title like "Oak Staircase" or "Installation Process".

## What you MUST NOT do

- Do not invent facts Philip didn't write
- Do not add prices (this violates the Nex contract)
- Do not add guarantees or compliance claims
- Do not add citations to external sources
- Do not add "AI-generated" markers
- Do not soften Philip's opinions · he is the authority

## When to interrupt with an ambiguity

Only interrupt when a phrase in the raw notes has two possible meanings and choosing wrong would change the facts materially. Example:
- Raw: "The string is fixed to..."
- Ambiguous: closed string vs cut string
- Return an ambiguity so Philip can choose

Do NOT interrupt for stylistic choices, grammar decisions, or section organisation. Just decide and move on.

## Output format

Return JSON matching this shape:

{
  "topic_name": "Oak Staircase",
  "sections": [
    {
      "heading": "What is oak?",
      "body": "Oak is a hardwood timber...",
      "source_phrase": "oak - hardwood, most popular for premium"
    },
    {
      "heading": "Why oak is popular",
      "body": "...",
      "source_phrase": "warm colour, hardwearing, european oak is uk default"
    }
  ],
  "summary_bullets": [
    "Added 5 topics",
    "Covered oak, walnut, pine",
    "Linked to timber guidance"
  ],
  "ambiguities": []
}

The "source_phrase" field is CRITICAL · it's the exact snippet from Philip's raw notes that this section is derived from. Philip uses this to verify meaning was preserved. Quote his exact words (up to ~100 chars).

Return ONLY valid JSON · no markdown fences · no prose commentary.`;

export type AuthorDiffEntry = {
  original_snippet: string;   // exact source phrase from Philip's raw notes
  published_body:   string;   // what Nex actually saved
  published_heading: string;  // ## heading for the section
};

export type ConflictWarning = {
  new_section:      string;   // heading of new section
  existing_file:    string;   // path to existing file that may conflict
  existing_section: string;   // heading of existing section
  summary:          string;   // one-sentence description of the contradiction
};

export type BrainProcessorResult = {
  file_slug:        string;
  topic_name:       string;
  sections_written: number;
  summary_bullets:  string[];
  ambiguities:      Array<{ phrase: string; options: string[] }>;
  author_diff:      AuthorDiffEntry[];   // Philip 2026-08-01 · verify meaning preserved
  conflicts:        ConflictWarning[];   // Philip 2026-08-01 · flag knowledge contradictions
  md_path:          string;
  meta_path:        string;
};

type LlmOutput = {
  topic_name: string;
  sections:   Array<{ heading: string; body: string; source_phrase?: string }>;
  summary_bullets: string[];
  ambiguities: Array<{ phrase: string; options: string[] }>;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Process raw author notes through the LLM · write to Brain directly.
 * Returns summary bullets for the admin toast.
 * Returns ambiguities (non-empty array) if Philip needs to disambiguate before save.
 */
export async function processAuthorNotes(rawNotes: string, suggestedTopic?: string): Promise<BrainProcessorResult | { ambiguities: BrainProcessorResult["ambiguities"] }> {
  if (!rawNotes || rawNotes.trim().length < 40) {
    throw new Error("Raw notes too short · need at least 40 characters");
  }

  const userMessage = suggestedTopic
    ? `Topic hint: ${suggestedTopic}\n\nRaw notes from Philip:\n\n${rawNotes}`
    : `Raw notes from Philip:\n\n${rawNotes}`;

  const result = await completeJson<LlmOutput>({
    system: BRAIN_PROCESSOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 4000,
    temperature: 0.2,
  });

  if (!result) {
    throw new Error("Brain Processor unavailable · LLM API failure");
  }

  // If ambiguities present · return them without publishing
  if (Array.isArray(result.ambiguities) && result.ambiguities.length > 0) {
    return { ambiguities: result.ambiguities };
  }

  // Validate structure
  if (!result.topic_name || !Array.isArray(result.sections) || result.sections.length === 0) {
    throw new Error("Brain Processor returned incomplete structure");
  }

  // Convert to ParsedSection[] for the writer
  const parsedSections: ParsedSection[] = result.sections.map((s, i) => ({
    id:                 slugify(s.heading) || `section-${i}`,
    order:              i,
    heading:            s.heading,
    body:               s.body,
    char_count:         s.body.length,
    word_count:         s.body.trim().split(/\s+/).length,
    sentence_count:     s.body.split(/[.!?]+\s/).filter((x) => x.trim()).length,
    issues:             [],
    status:             "unreviewed",  // parser status · writer promotes to approved via meta below
    auto_fix_available: false,
  }));

  const fileSlug = `nex-knowledge-base-${slugify(result.topic_name)}`;
  const write = publishParsed(result.topic_name, fileSlug, parsedSections, "customer_facing");

  // Author Mode · promote all sections to approved status immediately
  // (Philip is the author · his content is trusted by definition)
  const { updateSectionStatus } = await import("./writer");
  for (const s of parsedSections) {
    updateSectionStatus(fileSlug, s.id, "approved", "Philip O'Farrell (author mode)");
  }

  // Author Diff · Philip verifies meaning preserved without slowing down
  const authorDiff: AuthorDiffEntry[] = result.sections.map((s) => ({
    original_snippet: s.source_phrase ?? "",
    published_heading: s.heading,
    published_body:   s.body,
  }));

  // Knowledge conflict detection · runs asynchronously against existing corpus
  const { detectConflicts } = await import("./conflict-detector");
  let conflicts: ConflictWarning[] = [];
  try {
    conflicts = await detectConflicts(fileSlug, result.sections);
  } catch {
    // Conflict detection failure · not fatal · continue with empty conflicts
  }

  return {
    file_slug:        fileSlug,
    topic_name:       result.topic_name,
    sections_written: write.written_sections,
    summary_bullets:  result.summary_bullets ?? [],
    ambiguities:      [],
    author_diff:      authorDiff,
    conflicts,
    md_path:          write.md_path,
    meta_path:        write.meta_path,
  };
}
