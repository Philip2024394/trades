// Staircase Advisor · LLM-grounded composition (Philip 2026-08-01)
//
// The unified pipeline · Philip's architectural correction:
//    Retrieve evidence → LLM reasons over evidence → generate answer →
//    attach evidence trail.
//
// Nex is NOT a search engine returning verbatim paragraphs. She's an
// advisor who understands the evidence and explains it in her voice.
//
// Rules baked into the prompt:
//   - Grounded ONLY in the evidence snippets provided (no invention)
//   - Nex identity NEVER revealed as AI/LLM/model
//   - Warm, professional, staircase-specialist voice
//   - Refuses off-topic (staircase + Nex Stairplan business only)
//   - Concise · 2-4 short paragraphs typically
//   - Answers the ACTUAL question first
//   - Cites which evidence snippets were used

import "server-only";
import { complete } from "@/lib/llm/anthropic";
import { getTruthIndex, type IndexedSnippet } from "./truth-index";
import { semanticSearch, isSemanticIndexReady } from "./semantic-index";
import {
  findConfirmedImages,
  imageStatesComposerHint,
  type ImageMatch,
  type ImageState,
} from "@/lib/nex/images/confirmed-library";
import { buildCountryHint, type Country } from "./regional-terminology";

const TOP_N_SNIPPETS = 5;
const MIN_MATCH_SCORE_FOR_LLM = 2; // Lower than verbatim path · LLM can synthesize weaker matches
const SEMANTIC_MIN_SIMILARITY = 0.35; // below this, semantic hit is noise

const COMMON_TOKENS = new Set([
  "staircase", "staircases", "stair", "stairs",
  "the", "a", "an", "for", "of", "to", "in", "on", "and", "or", "but",
  "i", "me", "my", "you", "your", "we", "us", "our",
  "is", "are", "am", "be", "was", "were",
  "with", "about", "at", "by",
  "can", "could", "will", "would", "should",
  "have", "has", "had", "do", "does", "did",
  "not", "no", "yes",
  "this", "that", "these", "those",
  "what", "how", "when", "why", "which",
]);

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

function scoreSnippet(msgTokens: string[], snippet: IndexedSnippet): number {
  const distinctive = msgTokens.filter((t) => !COMMON_TOKENS.has(t));
  if (distinctive.length === 0) return 0;

  const sectionTokens = new Set(
    snippet.section.toLowerCase()
      .replace(/[^\w\s'-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !COMMON_TOKENS.has(t))
      .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t)),
  );
  let titleHits = 0;
  for (const t of distinctive) if (sectionTokens.has(t)) titleHits += 1;

  let bodyHits = 0;
  for (const t of distinctive) if (snippet.tokens.has(t)) bodyHits += 1;

  return titleHits * 10 + bodyHits * 2;
}

/** Retrieve top-N snippets via HYBRID ranking (semantic + keyword).
 *  Falls back to keyword-only when semantic index isn't built or
 *  OpenAI is unavailable.
 */
async function retrieveTopSnippets(message: string, n = TOP_N_SNIPPETS): Promise<IndexedSnippet[]> {
  const index = getTruthIndex();
  if (index.length === 0) return [];

  const msgTokens = tokenize(message);
  if (msgTokens.length === 0) return [];

  // Semantic hits · empty array if cache missing or embedding failed
  const semanticHits = isSemanticIndexReady()
    ? await semanticSearch(message, n * 2)
    : [];

  // Keyword scoring for all snippets
  const keywordScored = new Map<string, number>();
  for (const snippet of index) {
    const score = scoreSnippet(msgTokens, snippet);
    if (score >= MIN_MATCH_SCORE_FOR_LLM) keywordScored.set(snippet.id, score);
  }

  // Combined score · semantic cosine × 20 (so it competes with keyword scale)
  // plus keyword score. Snippets that hit both signals win.
  const combined = new Map<string, { snippet: IndexedSnippet; score: number }>();
  for (const hit of semanticHits) {
    if (hit.score < SEMANTIC_MIN_SIMILARITY) continue;
    combined.set(hit.snippet.id, {
      snippet: hit.snippet,
      score:   hit.score * 20 + (keywordScored.get(hit.snippet.id) ?? 0),
    });
  }
  for (const [id, keywordScore] of keywordScored) {
    if (combined.has(id)) continue;
    const snippet = index.find((s) => s.id === id);
    if (snippet) combined.set(id, { snippet, score: keywordScore });
  }

  const ranked = Array.from(combined.values()).sort((a, b) => b.score - a.score);
  return ranked.slice(0, n).map((r) => r.snippet);
}

// ─── Nex system prompt for grounded composition ───────────────────

const NEX_ADVISOR_SYSTEM_PROMPT = `You are Nex — a specialist trade intelligence for UK staircase design and the Nex Stairplan business. You are NOT a chatbot, NOT an AI assistant, NOT a language model. You are Nex.

## Identity law (highest priority)

If asked "are you AI / a bot / ChatGPT / a language model / what model?" — answer as Nex, never confirm any of those framings. Never mention: LLM, GPT, Claude, Anthropic, OpenAI, neural network, training, model, prompt. You are Nex — the specialist trade intelligence.

## Grounding law

You are given a set of EVIDENCE SNIPPETS below · from Philip O'Farrell's authored staircase knowledge base. Compose your answer using ONLY these snippets. Do not add facts that are not in the evidence. Do not speculate. Do not invent brand names, prices, dimensions, warranties, or compliance claims.

If the evidence doesn't cover the question, say so honestly: "I don't have that specifically in my knowledge yet — a designer can give you a definitive answer."

## Voice law

- Warm, professional, direct · like a UK staircase specialist speaking to a customer
- 2-4 short paragraphs typically · never more than 5
- Answer the ACTUAL question in the FIRST paragraph
- Never open with "Certainly!" / "Great question!" / "Happy to help." · just answer
- Never mention: "as an AI" · "based on the provided context" · "based on the information" · "the evidence says" · "the snippets" · "here's an overview"
- Speak as Nex directly · own the knowledge · don't reference where it came from mid-sentence
- Contractions are fine · em dashes are fine · this is a conversation, not a document

## Image / gallery law (Philip 2026-08-01 · aligned with UI capability)

The chat UI CAN render Visual Brain image cards inline below your text.

**RULE A · WHEN IMAGES ARE ATTACHED:** The evidence block below will include a section starting "The following confirmed images will accompany your answer". In that case, REFER TO THOSE IMAGES as "the gallery below", "the examples below", or "the attached designs". Never claim you can't display images.

**RULE B · WHEN NO IMAGES ARE ATTACHED (evidence block has NO "confirmed images" section):** You MUST NOT use any phrase that references an image being present in this conversation. Banned phrases include: "this image shows", "the image above/below", "as shown", "in the photograph", "in the picture", "in the image", "displayed here", "attached image", "the gallery below", "the examples below".

Even when a knowledge snippet you are drawing from says things like *"This image shows a modern straight flight timber staircase..."*, REWRITE that content into general form because no image accompanies your answer: *"A modern straight-flight timber staircase typically..."* or *"One common example is..."* — never repeat the image-reference framing.

If the customer explicitly asked to see something and no confirmed images matched, say honestly: *"I don't currently have images of that specific topic in my confirmed design library yet."* · do NOT extend that into "the chat can't display images" (it can · the library just doesn't have a match).

## Boundary law

Nex CANNOT:
- Quote exact prices (say "a quote needs a survey")
- Guarantee fit or compliance (say "a designer needs to measure")
- Give structural or building-regulation approval (route to qualified professional)
- Diagnose unsafe existing staircases (recommend inspection)
- Recommend a specific manufacturer without approved data

## Scope law

If the question is off-topic (weather, sports, politics, medical, legal, financial advice, generic tech), respond briefly as Nex staying in her lane:
"That's not something I'm built for — I'm the staircase and Nex Stairplan specialist. What can I help you with in that space?"

## Attribution

At the end of your answer, on a new line, add a hidden marker: [[used: 1,3]] listing the snippet numbers you used. This is for internal use · do NOT explain it to the customer.`;

// Deprecated · replaced by AdvisorImageAttachment in advisor/index.ts.
// Kept for backwards-compat import references.
export type ComposerImageAttachment = {
  url:                  string;
  customer_description: string;
  staircase_type:       string;
  design_style:         string;
  matched_attributes:   string[];
};

export type LlmComposedAnswer = {
  text:               string;                       // customer-facing answer (marker stripped)
  used_snippet_ids:   string[];                     // snippet ids the LLM claims to have used
  all_retrieved_ids:  string[];                     // all snippets that were provided as evidence
  confidence:         "evidence-backed" | "no-evidence-fallback";
  // Note · Visual Brain images are attached at the Advisor level (index.ts)
  // using its own retrieveConfirmedImages() call · not surfaced here.
};

function stripAttributionMarker(text: string): { text: string; usedIndexes: number[] } {
  const match = text.match(/\[\[used:\s*([\d,\s]+)\]\]/);
  if (!match) return { text: text.trim(), usedIndexes: [] };
  const usedIndexes = match[1]
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1);
  const cleaned = text.replace(/\[\[used:[^\]]*\]\]/g, "").trim();
  return { text: cleaned, usedIndexes };
}

/**
 * Compose an answer to the customer question · grounded in retrieved evidence.
 * Returns null when LLM is unavailable · caller should fall back to verbatim path.
 */
/** Parallel Visual Brain retrieval · runs alongside knowledge retrieval.
 *  Extracts attribute hints from the customer message · matches against
 *  Confirmed Images only. LLM never decides which images to use · retrieval
 *  engine decides · UI displays them separately from the text answer.
 *  Exported so other Advisor paths (truth_retrieval, truth_answer, etc.)
 *  can attach the same visual results alongside their text output.
 *
 *  Philip 2026-08-01 · state-aware retrieval. When state is provided, the
 *  accumulated conversation context (design_enquiry_context from Turn 1 +
 *  style/timber/balustrade extracted across turns) enriches the query so
 *  Turn N's short reply ("modern") is scored against everything the customer
 *  has already told Nex (staircase_type=straight from Turn 1, install context,
 *  etc.), not only the latest message.
 *
 *  Merge priority:
 *   - Current message parses attributes first
 *   - State fills in any attribute the message didn't specify
 *   - Never overwrites a message-derived attribute (customer's current focus wins)
 */
export function retrieveConfirmedImages(
  message: string,
  state?: import("./state").AdvisorState,
): ImageMatch[] {
  const lower = message.toLowerCase();
  const query: Parameters<typeof findConfirmedImages>[0] = {};

  // ─── Step 1 · Parse attributes from current message ─────────────
  if (/\bmodern|contemporary|minimal\b/.test(lower))        query.design_style = "contemporary";
  else if (/\btraditional|classic|heritage|victorian\b/.test(lower)) query.design_style = "traditional";
  else if (/\bindustrial|loft|reclaimed\b/.test(lower))     query.design_style = "industrial";
  else if (/\bluxury|premium\b/.test(lower))                query.design_style = "luxury";

  if (/\bspiral|helical\b/.test(lower))                     query.staircase_type = "spiral";
  else if (/\bcurved|sweeping\b/.test(lower))               query.staircase_type = "curved";
  else if (/\bfloating|cantilever\b/.test(lower))           query.staircase_type = "floating";
  else if (/\bquarter[\s-]turn|l[\s-]shaped\b/.test(lower)) query.staircase_type = "quarter-turn";
  else if (/\bstraight\b/.test(lower))                      query.staircase_type = "straight";
  else if (/\bhalf[\s-]turn|u[\s-]shaped\b/.test(lower))    query.staircase_type = "half-turn";

  const materials: string[] = [];
  if (/\boak\b/.test(lower))           materials.push("oak");
  if (/\bwalnut\b/.test(lower))        materials.push("walnut");
  if (/\bpine\b/.test(lower))          materials.push("pine");
  if (/\bglass\b/.test(lower))         materials.push("glass");
  if (/\bsteel|metal\b/.test(lower))   materials.push("steel");
  if (/\bcarpet|runner\b/.test(lower)) materials.push("carpet");
  if (materials.length > 0) query.materials = materials;

  if (/\bnew\s+build\b/.test(lower))        query.project_suitability = ["new_build"];
  else if (/\bfamily\s+home\b/.test(lower)) query.project_suitability = ["family_home"];
  else if (/\bloft\b/.test(lower))          query.project_suitability = ["loft"];

  // ─── Step 2 · State enrichment · never overwrites message-derived values ──
  if (state) {
    // (a) Turn 1's design_enquiry_context · captured attributes from the
    //     original design-browse question ("have you got straight stairs?")
    const ctx = state.design_enquiry_context;
    if (ctx) {
      if (!query.staircase_type && ctx.staircase_type) query.staircase_type = ctx.staircase_type;
      if (!query.design_style && ctx.design_style)     query.design_style = ctx.design_style;
      if (ctx.materials && ctx.materials.length > 0) {
        const merged = new Set<string>(query.materials ?? []);
        for (const m of ctx.materials) merged.add(m);
        query.materials = Array.from(merged);
      }
    }

    // (b) style field extracted across turns · maps to design_style
    if (!query.design_style && state.style) {
      const s = state.style.toLowerCase();
      if (s === "modern" || s === "contemporary" || s === "minimal" || s === "minimalist") query.design_style = "contemporary";
      else if (s === "traditional") query.design_style = "traditional";
      else if (s === "industrial")  query.design_style = "industrial";
    }

    // (c) timber field extracted across turns · appended to materials
    if (state.timber) {
      const t = state.timber.toLowerCase();
      const knownTimbers = ["oak", "pine", "walnut", "ash", "mahogany", "cherry"];
      if (knownTimbers.includes(t)) {
        const merged = new Set<string>(query.materials ?? []);
        merged.add(t);
        query.materials = Array.from(merged);
      }
    }

    // (d) balustrade field · maps to materials (glass/timber/steel)
    if (state.balustrade) {
      const b = state.balustrade.toLowerCase();
      const merged = new Set<string>(query.materials ?? []);
      if (b === "glass")           merged.add("glass");
      else if (b === "timber")     merged.add("oak");        // timber balustrade → timber-family materials
      else if (b === "metal")      merged.add("steel");
      if (merged.size > 0) query.materials = Array.from(merged);
    }
  }

  // No attribute hints at all · return nothing (no images to show)
  if (Object.keys(query).length === 0) return [];
  return findConfirmedImages(query, 3);
}

export async function composeGroundedAnswer(
  message: string,
  opts: { country?: Country } = {},
): Promise<LlmComposedAnswer | null> {
  const snippets = await retrieveTopSnippets(message, TOP_N_SNIPPETS);

  if (snippets.length === 0) {
    // No evidence retrieved · let the caller fall through to Runtime Core / composer
    return null;
  }

  // Format evidence with numbered snippets so LLM can cite them
  const evidenceBlock = snippets.map((s, i) => {
    return `Snippet ${i + 1} · from ${s.file} · section "${s.section}":
${s.text}`;
  }).join("\n\n---\n\n");

  // Parallel Visual Brain retrieval · runs alongside knowledge retrieval
  // LLM sees image metadata for context but never selects/ranks · never sees URLs
  const imageMatches = retrieveConfirmedImages(message);
  // Philip 2026-08-02 · Visual Brain Connection v1 · every attached image
  // carries its transparency state so the composer never over-claims provenance.
  // Unset defaults to "concept" (safest) matching imagesToAttachments in the advisor.
  const imageStates: ImageState[] = imageMatches.map((m) => m.image.image_state ?? "concept");
  const imagesBlock = imageMatches.length > 0
    ? `\n\nThe following confirmed images will accompany your answer. Refer to them naturally if helpful ("the first example shows..." · "another design that matches your requirements is..."). Do NOT mention URLs, filenames, or image IDs. The UI renders the gallery separately.\n\n${imageMatches.map((m, i) => {
        const state = m.image.image_state ?? "concept";
        return `Image ${i + 1} [state: ${state}] (${m.image.staircase_type}): ${m.image.customer_description}`;
      }).join("\n\n")}`
    : "";

  const userMessage = `Customer question: ${message}

EVIDENCE SNIPPETS (use only these to compose your answer):

${evidenceBlock}${imagesBlock}

Now compose your answer as Nex.`;

  // Regional Language Layer (Philip 2026-08-02 · Priority 1 intelligence layer).
  // Visual Brain Connection    (Philip 2026-08-02 · Priority 2 intelligence layer).
  // Both hints append to the system prompt · empty string when not applicable.
  const systemPrompt =
    NEX_ADVISOR_SYSTEM_PROMPT
    + buildCountryHint(opts.country)
    + imageStatesComposerHint(imageStates);

  const llmText = await complete({
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 800,
    temperature: 0.3, // lower · reduces invention
  });

  if (!llmText) return null; // API key missing or LLM failed · fall through

  const { text, usedIndexes } = stripAttributionMarker(llmText);
  const usedSnippetIds = usedIndexes
    .filter((i) => i <= snippets.length)
    .map((i) => snippets[i - 1].id);

  return {
    text,
    used_snippet_ids:  usedSnippetIds.length > 0 ? usedSnippetIds : snippets.map((s) => s.id),
    all_retrieved_ids: snippets.map((s) => s.id),
    confidence:        "evidence-backed",
  };
}
