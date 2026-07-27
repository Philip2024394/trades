#!/usr/bin/env node
// generate.mjs — takes a raw FAQ markdown file (numbered list format
// from ChatGPT or wherever) and produces a per-category JSON file in
// knowledge/ with all answers rewritten in Nex voice via Anthropic.
//
// Superset of scripts/brain-pipeline/faq-to-brain.mjs — this version
// writes to the knowledge/ folder so it plugs directly into the
// validate → build pipeline.
//
// Usage:
//   node scripts/knowledge/generate.mjs <category> <input.md>
//   Options:
//     --dry-run    Skip LLM voice rewrite (structure only)
//     --batch N    Q&As per LLM call (default 20)
//
// Environment: ANTHROPIC_API_KEY (auto-loaded from .env.local)
// Cost: ~£0.05 per batch on Sonnet 4.6.

import fs from "node:fs";
import path from "node:path";
import { KNOWLEDGE_DIR } from "./_lib.mjs";

// ── Voice prompt (mirrors _voice-prompt.mjs but inline for portability)
const NEX_VOICE_SYSTEM = `You are the NEX voice editor.

Rewrite trade FAQ answers from spec-manual voice into Nex's warm workshop voice.

Rules:
- Direct "you" language, contractions, em dashes, workshop rhythms
- UK English EVERYWHERE (colour, favour, £, kerb, tyre, storey, aluminium)
- 2-4 sentences per answer
- Never invent facts, prices, brands or quantities not in the source
- If original is factually wrong, flag with "⚠️ FACT_CHECK:" and correct

Banned:
- "In most cases", "provided that", "It should be noted"
- "cheap" / "cheaper" — use "less expensive", "budget-friendly"
- Passive voice ("can be used", "is recommended") — rewrite active
- Marketing fluff ("world-class", "cutting-edge", "best-in-class")
- Any reference to yourself as AI, LLM, model, chatbot, database, memory layer, retrieval

Return ONLY a JSON array (no markdown fences, no prose), one object per input Q&A in the same order:
[
  { "id": "...", "question": "...", "answer_nex_voice": "...", "fact_check": null }
]`;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL         = "claude-sonnet-4-6";

function loadDotEnv() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node scripts/knowledge/generate.mjs <category> <input.md> [--dry-run] [--batch N]");
  process.exit(1);
}
const category  = args[0];
const inputPath = args[1];
const dryRun    = args.includes("--dry-run");
const batchIdx  = args.indexOf("--batch");
const BATCH     = batchIdx >= 0 ? parseInt(args[batchIdx + 1], 10) || 20 : 20;

// ── Parse ─────────────────────────────────────────────────────
function parseFaqs(raw) {
  const items = [];
  const numbered = raw.split(/\n(?=\s*\d+\.\s+)/).map((s) => s.trim()).filter(Boolean);
  for (const block of numbered) {
    const m = block.match(/^\s*(\d+)\.\s+(.+?)\n+([\s\S]+?)$/);
    if (!m) continue;
    const qClean = m[2].trim();
    const aClean = m[3].replace(/^\s*Answer:\s*/i, "").split(/\n{2,}These FAQs|\n{2,}I can/i)[0].trim();
    if (qClean && aClean) items.push({ question: qClean, answer: aClean });
  }
  return items;
}

// ── Dedupe ────────────────────────────────────────────────────
function normQ(q) {
  return q.toLowerCase().replace(/[?.!,;:]/g, "").replace(/\b(is|are|does|do|can|will|should|the|a|an|of|for|to|my|i|it|from|on|in|by)\b/g, " ").replace(/\s+/g, " ").trim();
}
function dedupe(items) {
  const seen = new Map();
  for (const it of items) {
    const k = normQ(it.question);
    const existing = seen.get(k);
    if (!existing || it.answer.length > existing.answer.length) seen.set(k, it);
  }
  return [...seen.values()];
}

// ── Rewrite via LLM ───────────────────────────────────────────
async function callAnthropic(batch) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4500,
      temperature: 0.4,
      system: NEX_VOICE_SYSTEM,
      messages: [
        { role: "user", content: "Rewrite this batch in Nex voice. JSON array only.\n\n" + JSON.stringify(batch, null, 2) }
      ]
    })
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  const clean = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  return JSON.parse(clean.slice(clean.indexOf("["), clean.lastIndexOf("]") + 1));
}

async function rewriteInBatches(items) {
  const out = [];
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map((it, j) => ({
      id: `${category}-faq-${String(i + j + 1).padStart(3, "0")}`,
      question: it.question,
      answer: it.answer
    }));
    process.stdout.write(`\r  batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(items.length / BATCH)}…`);
    try {
      const result = await callAnthropic(batch);
      out.push(...result);
    } catch (err) {
      console.error(`\n❌ batch ${i}: ${err.message}`);
      for (const b of batch) out.push({ id: b.id, question: b.question, answer_nex_voice: b.answer, fact_check: `LLM failed: ${err.message}` });
    }
  }
  process.stdout.write("\n");
  return out;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  loadDotEnv();
  if (!fs.existsSync(inputPath)) { console.error(`❌ ${inputPath} not found`); process.exit(1); }

  const raw = fs.readFileSync(inputPath, "utf8");
  const parsed = parseFaqs(raw);
  const deduped = dedupe(parsed);
  console.log(`📥 ${parsed.length} parsed · ${parsed.length - deduped.length} deduped · ${deduped.length} to rewrite`);

  let rewritten;
  if (dryRun) {
    console.log("🚧 dry-run — skipping LLM");
    rewritten = deduped.map((q, i) => ({
      id: `${category}-faq-${String(i + 1).padStart(3, "0")}`,
      question: q.question, answer_nex_voice: q.answer, fact_check: null
    }));
  } else {
    if (!process.env.ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY missing"); process.exit(1); }
    rewritten = await rewriteInBatches(deduped);
  }

  // Structure as knowledge/*.json format expected by build.mjs
  const doc = {
    kind: "brain_faqs",
    category,
    generated_at: new Date().toISOString(),
    author_status: "pending_review",
    count: rewritten.length,
    entries: rewritten.map((r) => ({
      id: r.id, kind: "faq",
      question: r.question,
      answer: r.answer_nex_voice,
      category_tag: category,
      audience_level: null,
      classification: "industry_good_practice",
      safety_note: null,
      source_verified_at: null,
      fact_check_flag: r.fact_check ?? null
    }))
  };

  const outPath = path.join(KNOWLEDGE_DIR, `${category}.json`);
  if (!fs.existsSync(KNOWLEDGE_DIR)) fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8");

  const flags = rewritten.filter((r) => r.fact_check).length;
  console.log(`✅ ${outPath} · ${rewritten.length} entries · ${flags} fact-check flags`);
  console.log(`Next: npm run knowledge:validate && npm run knowledge:build`);
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
