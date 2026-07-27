#!/usr/bin/env node
// faq-to-brain — pipeline that takes a raw FAQ file (numbered
// Markdown Q&A dump from ChatGPT or wherever) and produces a
// Nex-voice Brain JSON file ready for Author review + substrate
// ingest.
//
// Usage:
//   node scripts/brain-pipeline/faq-to-brain.mjs <category> <input.md> [options]
//
//   Options:
//     --dry-run      Parse + dedup + structure, skip LLM voice rewrite
//     --batch N      Q&As per LLM call (default 15)
//     --out PATH     Output file (default: .staging-brain-<category>.json)
//
// Example:
//   node scripts/brain-pipeline/faq-to-brain.mjs cement docs/brains/cement-faqs-raw.md
//
// Environment:
//   ANTHROPIC_API_KEY — required unless --dry-run
//
// Cost: batching 15 Q&As per LLM call at ~$0.05/batch. 200 Q&As ≈ $0.70.

import fs from "node:fs";
import path from "node:path";
import { NEX_VOICE_SYSTEM } from "./_voice-prompt.mjs";

// Load .env.local so ANTHROPIC_API_KEY is available. Deliberately
// OVERRIDES any existing shell env — Next.js does the same, and
// Windows sometimes has stale system-level keys hanging around.
function loadDotEnv() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    process.env[k] = v.replace(/^["']|["']$/g, "");
  }
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";           // Sonnet 4.6 — cost-effective voice rewrite

// ── Args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node scripts/brain-pipeline/faq-to-brain.mjs <category> <input.md> [--dry-run] [--batch N] [--out PATH]");
  process.exit(1);
}
const category = args[0];
const inputPath = args[1];
const dryRun = args.includes("--dry-run");
const batchIdx = args.indexOf("--batch");
const BATCH_SIZE = batchIdx >= 0 ? parseInt(args[batchIdx + 1], 10) || 15 : 15;
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : `scripts/.staging-brain-${category}.json`;

// ── Main ──────────────────────────────────────────────────────
async function main() {
  loadDotEnv();

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(inputPath, "utf8");
  const parsed = parseFaqs(raw);
  console.log(`📥 Parsed ${parsed.length} Q&A pairs from ${inputPath}`);

  const deduped = dedupe(parsed);
  const removed = parsed.length - deduped.length;
  if (removed > 0) console.log(`♻️  Removed ${removed} near-duplicates`);

  let rewritten;
  if (dryRun) {
    console.log("🚧 Dry run — skipping LLM voice rewrite");
    rewritten = deduped.map((q, i) => ({
      id: `${category}-faq-${String(i + 1).padStart(3, "0")}`,
      question: q.question,
      answer_nex_voice: q.answer, // unchanged in dry-run
      fact_check: null
    }));
  } else {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("❌ ANTHROPIC_API_KEY not set (add to .env.local or pass --dry-run)");
      process.exit(1);
    }
    rewritten = await rewriteInBatches(deduped, category, BATCH_SIZE);
  }

  const brainDoc = buildBrainDoc(category, rewritten);
  fs.writeFileSync(outPath, JSON.stringify(brainDoc, null, 2) + "\n", "utf8");

  const factChecks = rewritten.filter((r) => r.fact_check);
  console.log(`\n✅ Done: ${rewritten.length} entries → ${outPath}`);
  if (factChecks.length > 0) {
    console.log(`\n⚠️  ${factChecks.length} fact-check flags (review before publish):`);
    for (const f of factChecks) console.log(`   • ${f.id}: ${f.fact_check}`);
  }
  console.log(`\nNext: review ${outPath}, then hand to Trade Brain Author for sign-off.`);
}

// ── Parse ─────────────────────────────────────────────────────
// Accepts either numbered format (`123. Question...\n\nAnswer...`)
// or Markdown H3 format (`### Question\n\nAnswer`).
function parseFaqs(raw) {
  const items = [];
  // Try numbered format first (most common ChatGPT output)
  const numbered = raw.split(/\n(?=\s*\d+\.\s+)/).map((s) => s.trim()).filter(Boolean);
  for (const block of numbered) {
    const m = block.match(/^\s*(\d+)\.\s+(.+?)\n+([\s\S]+?)$/);
    if (!m) continue;
    const [, , q, a] = m;
    const qClean = q.trim().replace(/^\s*[\d]+\s*[\.\)]\s*/, "").trim();
    // Strip trailing sections not part of the answer (marketing tails etc)
    const aClean = a
      .replace(/^\s*Answer:\s*/i, "")
      .split(/\n{2,}These FAQs|\n{2,}I can/i)[0]
      .trim();
    if (qClean && aClean) items.push({ question: qClean, answer: aClean });
  }
  return items;
}

// ── Dedupe ────────────────────────────────────────────────────
// Simple heuristic: normalise question text (lowercase, strip
// punctuation + articles + auxiliary verbs) and compare. Merges
// duplicates by keeping the longer/more informative answer.
function dedupe(items) {
  const seen = new Map();
  for (const it of items) {
    const key = normaliseQuestion(it.question);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, it);
    } else if (it.answer.length > existing.answer.length) {
      seen.set(key, it);
    }
  }
  return [...seen.values()];
}
function normaliseQuestion(q) {
  return q
    .toLowerCase()
    .replace(/[?.!,;:]/g, "")
    .replace(/\b(is|are|does|do|can|will|should|the|a|an|of|for|to|my|i|it|from|on|in|by)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Rewrite in batches via Anthropic ─────────────────────────
async function rewriteInBatches(items, category, batchSize) {
  const out = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize).map((it, j) => ({
      id: `${category}-faq-${String(i + j + 1).padStart(3, "0")}`,
      question: it.question,
      answer: it.answer
    }));
    process.stdout.write(`\r✍️  Rewriting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} entries)…`);
    try {
      const result = await callAnthropic(batch);
      for (const r of result) out.push(r);
    } catch (err) {
      console.error(`\n❌ Batch ${i}: ${err.message}`);
      // Fall back to un-rewritten entries so we don't lose them
      for (const b of batch) {
        out.push({
          id: b.id,
          question: b.question,
          answer_nex_voice: b.answer,
          fact_check: `LLM failed — original voice retained: ${err.message}`
        });
      }
    }
  }
  process.stdout.write("\n");
  return out;
}

async function callAnthropic(batch) {
  const payload = {
    model: MODEL,
    max_tokens: 4000,
    temperature: 0.4,
    system: NEX_VOICE_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          "Rewrite this batch of Q&A pairs in Nex voice. Return ONLY the JSON array.\n\n" +
          JSON.stringify(batch, null, 2)
      }
    ]
  };
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  const parsed = tryParseJsonArray(text);
  if (!Array.isArray(parsed)) throw new Error("model returned non-array");
  return parsed;
}
function tryParseJsonArray(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  // Strip markdown fences if the model added them despite instructions
  const stripped = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try { return JSON.parse(stripped); } catch { /* fall through */ }
  // Find the outermost [ ... ]
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* give up */ }
  }
  return null;
}

// ── Build Brain doc ───────────────────────────────────────────
// Structured for review-then-ingest. Matches the general shape the
// substrate loader expects; final ingest happens after Author +
// Admin sign-off via the existing pending-migrations flow.
function buildBrainDoc(category, entries) {
  return {
    kind: "brain_faqs",
    category,
    prompt_version: "faq-to-brain.v1",
    generated_at: new Date().toISOString(),
    source: `Raw FAQ input processed through NEX voice pipeline (batch size ${BATCH_SIZE})`,
    author_status: "pending_review",
    count: entries.length,
    entries: entries.map((e) => ({
      id: e.id,
      kind: "faq",
      question: e.question,
      answer: e.answer_nex_voice,
      category_tag: category,
      audience_level: null,          // Author sets
      classification: "industry_good_practice", // Author refines
      safety_note: null,             // Author sets when relevant
      source_verified_at: null,      // Author sets
      fact_check_flag: e.fact_check ?? null
    }))
  };
}

main().catch((err) => {
  console.error("❌ Pipeline failed:", err);
  process.exit(1);
});
