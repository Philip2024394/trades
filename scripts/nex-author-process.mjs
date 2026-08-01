// NEX Authoring Factory · Stage 2 processor · v3 (Philip 2026-08-02)
//
// V3 CHANGE (Philip 2026-08-02): Stage A no longer calls the LLM.
// Deterministic parsing (JS regex) extracts every ? line reliably.
// The LLM now only does clustering, classification, and gap detection — what
// it's actually best at. Faster · cheaper · 100% extraction integrity.
//
// PIPELINE:
//   Stage A · Deterministic line-parser · extracts every ? line · JS only
//   Stage B · Claude clusters into topics + classifies + related_questions
//   Stage C · Claude identifies knowledge gaps (bundled into Stage B call)
//
// V2 features kept:
//   - Expanded 7-domain classification
//   - related_questions per topic (natural conversation follow-ups)
//   - Question numbering preserved
//   - Higher max_tokens to handle 100+ question batches
//
// USAGE:
//   node scripts/nex-author-process.mjs data/nex-author-notes/<file>-raw.md
//
// REQUIRES:
//   ANTHROPIC_API_KEY environment variable
//
// OUTPUTS (alongside input file):
//   <name>-processed.json — machine-readable
//   <name>-processed.md   — human-readable summary for Philip's review
//
// RULES BAKED IN:
//   - Do NOT invent facts. Every intent traces to Philip's notes.
//   - Duplicates get grouped.
//   - Related intents get clustered under topics.
//   - Every intent classified with the expanded domain enum.
//   - Knowledge gaps returned explicitly (never silently filled).
//   - Never publishes · always draft.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const MODEL = "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";

const DOMAIN_ENUM = [
  "technical", "business", "sales", "regulation",
  "visual", "installation", "manufacturing",
];

// ─── CLI arg ─────────────────────────────────────────────────────
const inputPath = process.argv[2];
if (!inputPath) {
  console.error("USAGE: node scripts/nex-author-process.mjs <path-to-raw-notes.md>");
  process.exit(1);
}
if (!existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY env var not set. Set it and re-run.");
  process.exit(1);
}

const rawNotes = readFileSync(inputPath, "utf8");

async function callClaude({ system, user, maxTokens }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type":     "application/json",
      "x-api-key":        apiKey,
      "anthropic-version":"2023-06-01",
    },
    body: JSON.stringify({
      model:       MODEL,
      max_tokens:  maxTokens,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  const stopReason = data?.stop_reason;
  if (!text) throw new Error("Empty response from Claude");
  return { text, stopReason };
}

function parseJsonSafely(raw) {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

// ─── Stage A · v3 · DETERMINISTIC line-parser (no LLM) ─────────────
// Philip 2026-08-02 · removed the LLM · JS reliably splits by newlines and
// keeps every line whose trimmed form ends with "?". This eliminates the
// entire class of extraction hallucinations we saw in v1/v2.

function extractQuestionsDeterministic(text) {
  const lines = text.split(/\r?\n/);
  const questions = [];
  let n = 1;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    // Skip commented-out lines (author metadata · not customer content)
    if (line.startsWith("#")) continue;
    // A customer question ends with "?" (allow trailing punctuation like "?!" only if "?" is present)
    if (!/\?[!.\s]*$/.test(line)) continue;
    questions.push({ n: n++, text: line });
  }
  return questions;
}

console.log(`[nex-author-process] input: ${inputPath}`);
console.log(`[nex-author-process] model: ${MODEL}`);
console.log(`[nex-author-process] notes length: ${rawNotes.length} chars`);
console.log("");
console.log("[Stage A · v3 deterministic] extracting questions...");

const questions = extractQuestionsDeterministic(rawNotes);
const rawQuestionMarks = (rawNotes.match(/\?/g) ?? []).length;
const extracted = { count: questions.length, questions };

console.log(`[Stage A] questions extracted: ${extracted.count} · raw '?' count: ${rawQuestionMarks}`);
if (extracted.count !== rawQuestionMarks) {
  console.log(`[Stage A] note: mismatch is expected when raw notes contain '?' inside non-line-terminal positions (e.g. "?" mid-sentence)`);
}

// ─── Stage B · Group + classify + related + gaps ─────────────────
const STAGE_B_SYSTEM = `You are structuring a validated list of customer questions into topics for the NEX Staircase Brain.

STRICT RULES:
- DO NOT invent questions · use only the numbered list provided.
- DO NOT answer any question · Nex answers come later after human approval.
- Group semantically related questions into topics · one topic per coherent cluster.
- Remove duplicates (mark them as duplicates_of).
- Every topic gets: retrieval_tags · related_questions (natural follow-ups a customer might ask NEXT · 2-4 items) · classifications (see below).
- Every question gets a classification with domain from THIS enum:
    ${DOMAIN_ENUM.join(" · ")}
  Guidance:
    technical    · staircase geometry · materials science · engineering
    business     · policies · warranties · viewing · customer service
    sales        · quotes · discounts · deposits · payment · finance
    regulation   · building codes · fire · egress · handrail heights
    visual       · appearance · finishes · aesthetics · Visual Brain
    installation · on-site work · fitting · tolerances · site access
    manufacturing· lead times · production · CNC · sourcing · shipping
- Knowledge gaps: questions that surfaced but lack the factual data needed for a customer answer.

Return JSON ONLY (no prose, no markdown fences):
{
  "topics": [
    {
      "topic":            "Installation Duration & Sequence",
      "customer_intents": [
        { "n": 42, "text": "How long does installation take?" }
      ],
      "retrieval_tags":     ["installation","install-time","fitter"],
      "related_questions":  ["Do you clean up afterwards?","Do installers remove the old staircase?"],
      "classifications":    [
        { "n": 42, "text": "How long does installation take?", "domain": "installation" }
      ]
    }
  ],
  "knowledge_gaps":  ["Installer qualifications","Warranty on installation labour"],
  "notes_processed": "<one-sentence summary of what the batch covers>"
}`;

const questionsList = extracted.questions.map((q) => `${q.n}. ${q.text}`).join("\n");

console.log("");
console.log("[Stage B] grouping + classifying + gaps + related_questions...");

const stageB = await callClaude({
  system:    STAGE_B_SYSTEM,
  user:      `Validated customer questions (${extracted.count} total):\n\n${questionsList}`,
  maxTokens: 32000,
});
if (stageB.stopReason === "max_tokens") {
  console.warn("[Stage B] WARNING: hit max_tokens · output may be truncated");
}

let parsed;
try { parsed = parseJsonSafely(stageB.text); }
catch (err) {
  console.error("[Stage B] Failed to parse output:");
  console.error(stageB.text.slice(0, 1000));
  process.exit(1);
}

// Merge extraction meta into the final output
parsed.extraction = {
  extracted_count:      extracted.count,
  raw_question_marks:   rawQuestionMarks,
  match:                extracted.count === rawQuestionMarks,
};

// ─── Write outputs ───────────────────────────────────────────────
const inputName = basename(inputPath).replace(/-raw\.md$/, "").replace(/\.md$/, "");
const outDir = dirname(inputPath);
const jsonPath = join(outDir, `${inputName}-processed.json`);
const mdPath   = join(outDir, `${inputName}-processed.md`);

writeFileSync(jsonPath, JSON.stringify(parsed, null, 2), "utf8");
writeFileSync(mdPath,   renderHumanReadable(parsed, inputPath), "utf8");

console.log(`[nex-author-process] JSON  → ${jsonPath}`);
console.log(`[nex-author-process] MD    → ${mdPath}`);
console.log(`[nex-author-process] topics: ${parsed.topics?.length ?? 0} · gaps: ${parsed.knowledge_gaps?.length ?? 0}`);
console.log("[nex-author-process] STATUS: draft · human approval required before publishing");

// ─── Human-readable renderer ─────────────────────────────────────
function renderHumanReadable(p, source) {
  const lines = [];
  lines.push(`# Processed notes · draft · human approval required`);
  lines.push("");
  lines.push(`**Source:** \`${source}\``);
  lines.push(`**Summary:** ${p.notes_processed ?? "(none)"}`);
  if (p.extraction) {
    lines.push(`**Extraction integrity:** ${p.extraction.extracted_count} questions · raw '?' count ${p.extraction.raw_question_marks} · ${p.extraction.match ? "MATCH ✓" : "MISMATCH ✗"}`);
  }
  lines.push("");
  lines.push(`## Topics (${p.topics?.length ?? 0})`);
  for (const t of p.topics ?? []) {
    lines.push("");
    lines.push(`### ${t.topic}`);
    lines.push("");
    lines.push("**Customer Intents:**");
    for (const i of t.customer_intents ?? []) {
      const line = typeof i === "string" ? i : `${i.n}. ${i.text}`;
      lines.push(`- ${line}`);
    }
    lines.push("");
    lines.push(`**Retrieval Tags:** ${(t.retrieval_tags ?? []).join(" · ")}`);
    if (Array.isArray(t.related_questions) && t.related_questions.length > 0) {
      lines.push("");
      lines.push(`**Related Questions (natural follow-ups):**`);
      for (const r of t.related_questions) lines.push(`- ${r}`);
    }
    lines.push("");
    lines.push(`**Classifications:**`);
    lines.push("");
    lines.push("| # | Intent | Domain |");
    lines.push("|---|---|---|");
    for (const c of t.classifications ?? []) {
      const n = c.n ?? "—";
      const text = c.text ?? c.intent ?? "";
      lines.push(`| ${n} | ${text} | ${c.domain} |`);
    }
  }
  lines.push("");
  lines.push(`## Knowledge Gaps (${p.knowledge_gaps?.length ?? 0})`);
  lines.push("");
  lines.push("These questions surfaced from the notes but lack a factual answer. Philip's next authoring input should address them.");
  lines.push("");
  for (const g of p.knowledge_gaps ?? []) lines.push(`- [ ] ${g}`);
  lines.push("");
  lines.push(`---`);
  lines.push(`*Status: draft · not published · human approval required before entering the Knowledge Brain.*`);
  return lines.join("\n");
}
