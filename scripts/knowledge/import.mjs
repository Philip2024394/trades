#!/usr/bin/env node
// import.mjs — credit-free structural import.
// Takes raw Q&A content (Markdown / CSV / JSON) and structures it
// into the NEX knowledge schema. NO LLM call, NO voice rewrite —
// preserves the source voice as-is. Author reviews via validate.mjs.
//
// Use this when:
//   · You already have Q&As written in Nex voice (from an Author,
//     copywriter, or ChatGPT paste — you did the voice pass)
//   · You want to migrate existing content into the pipeline without
//     hitting any API
//   · You're building the knowledge base offline
//
// Usage:
//   node scripts/knowledge/import.mjs <category> <input>
//     --format md|csv|json     (auto-detect from extension by default)
//     --resume                 (append to existing knowledge/<cat>.json)
//     --start-id N             (default: continue from highest existing id)
//     --classification <val>   (default: industry_good_practice)
//
// Examples:
//   node scripts/knowledge/import.mjs cement docs/brains/cement-faqs-raw.md
//   node scripts/knowledge/import.mjs sand   docs/brains/sand.csv --format csv
//   node scripts/knowledge/import.mjs oak    docs/brains/oak.json --resume

import fs from "node:fs";
import path from "node:path";
import { KNOWLEDGE_DIR, normaliseQuestion } from "./_lib.mjs";

// ── Args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node scripts/knowledge/import.mjs <category> <input> [--format md|csv|json] [--resume] [--start-id N] [--classification <val>]");
  process.exit(1);
}
const category  = args[0];
const inputPath = args[1];
const formatIdx = args.indexOf("--format");
const format    = formatIdx >= 0 ? args[formatIdx + 1] : detectFormat(inputPath);
const resume    = args.includes("--resume");
const startIdx  = args.indexOf("--start-id");
const explicitStartId = startIdx >= 0 ? parseInt(args[startIdx + 1], 10) : null;
const classIdx  = args.indexOf("--classification");
const classification = classIdx >= 0 ? args[classIdx + 1] : "industry_good_practice";

function detectFormat(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".csv") return "csv";
  if (ext === ".json") return "json";
  throw new Error(`Cannot detect format from ${p} — pass --format md|csv|json`);
}

// ── Parsers ───────────────────────────────────────────────────

function parseMd(raw) {
  const items = [];
  const numbered = raw.split(/\n(?=\s*\d+\.\s+)/).map((s) => s.trim()).filter(Boolean);
  for (const block of numbered) {
    const m = block.match(/^\s*(\d+)\.\s+(.+?)\n+([\s\S]+?)$/);
    if (!m) continue;
    const q = m[2].trim();
    const a = m[3]
      .replace(/^\s*Answer:\s*/i, "")
      .split(/\n{2,}These FAQs|\n{2,}I can/i)[0]
      .trim();
    if (q && a) items.push({ question: q, answer: a });
  }
  return items;
}

// Minimal CSV parser — handles quoted fields with escaped quotes.
// Expects header row with columns `question` and `answer` (case-insensitive).
// Extra columns (e.g. audience_level, safety_note) are carried through.
function parseCsv(raw) {
  const rows = csvRows(raw);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const qIdx = header.indexOf("question");
  const aIdx = header.indexOf("answer");
  if (qIdx < 0 || aIdx < 0) {
    throw new Error("CSV must have `question` and `answer` columns");
  }
  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const q = (row[qIdx] ?? "").trim();
    const a = (row[aIdx] ?? "").trim();
    if (!q || !a) continue;
    const extra = {};
    for (let c = 0; c < header.length; c++) {
      if (c === qIdx || c === aIdx) continue;
      if (row[c] !== undefined && row[c] !== "") extra[header[c]] = row[c];
    }
    items.push({ question: q, answer: a, extra });
  }
  return items;
}

function csvRows(raw) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"' && raw[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\r") { /* skip */ }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function parseJson(raw) {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("JSON input must be an array of { question, answer, … } objects");
  }
  return parsed
    .filter((o) => o && o.question && o.answer)
    .map((o) => ({
      question: String(o.question).trim(),
      answer:   String(o.answer).trim(),
      extra:    Object.fromEntries(Object.entries(o).filter(([k]) => k !== "question" && k !== "answer"))
    }));
}

// ── Dedupe within incoming batch ─────────────────────────────
function dedupeIncoming(items) {
  const seen = new Map();
  let removed = 0;
  for (const it of items) {
    const key = normaliseQuestion(it.question);
    const prior = seen.get(key);
    if (!prior) { seen.set(key, it); continue; }
    if ((it.answer?.length ?? 0) > (prior.answer?.length ?? 0)) {
      seen.set(key, it);
      removed++;
    } else {
      removed++;
    }
  }
  return { items: [...seen.values()], removed };
}

// ── Main ──────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(inputPath, "utf8");
  let incoming;
  if (format === "md")   incoming = parseMd(raw);
  else if (format === "csv")  incoming = parseCsv(raw);
  else if (format === "json") incoming = parseJson(raw);
  else { console.error(`❌ Unknown format: ${format}`); process.exit(1); }

  const { items: deduped, removed } = dedupeIncoming(incoming);
  console.log(`📥 Parsed ${incoming.length} from ${inputPath} (${format})`);
  if (removed) console.log(`♻️  Removed ${removed} near-duplicates in incoming batch`);

  // Resume mode: load existing file, append with fresh IDs
  const outPath = path.join(KNOWLEDGE_DIR, `${category}.json`);
  let existing = null;
  let startId = 1;

  if (resume && fs.existsSync(outPath)) {
    existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
    if (Array.isArray(existing?.entries) && existing.entries.length > 0) {
      const maxN = existing.entries.reduce((acc, e) => {
        const m = String(e.id ?? "").match(/-(\d+)$/);
        return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
      }, 0);
      startId = maxN + 1;
      console.log(`↩️  Resuming — ${existing.entries.length} existing entries, appending from id ${category}-faq-${String(startId).padStart(3, "0")}`);

      // Skip incoming Q&As whose normalised question already exists
      const seen = new Set(existing.entries.map((e) => normaliseQuestion(e.question)));
      const before = deduped.length;
      const filtered = deduped.filter((it) => !seen.has(normaliseQuestion(it.question)));
      const skipped = before - filtered.length;
      if (skipped) console.log(`♻️  Skipped ${skipped} that already exist in ${category}.json`);
      deduped.length = 0;
      deduped.push(...filtered);
    }
  }

  if (explicitStartId !== null && !Number.isNaN(explicitStartId)) {
    startId = explicitStartId;
  }

  const newEntries = deduped.map((it, i) => {
    const idNum = startId + i;
    const entry = {
      id:                 `${category}-faq-${String(idNum).padStart(3, "0")}`,
      kind:               "faq",
      question:           it.question,
      answer:             it.answer,
      category_tag:       category,
      audience_level:     it.extra?.audience_level ? Number(it.extra.audience_level) : null,
      classification:     it.extra?.classification || classification,
      safety_note:        it.extra?.safety_note || null,
      source_verified_at: it.extra?.source_verified_at || null,
      fact_check_flag:    it.extra?.fact_check_flag || null
    };
    return entry;
  });

  const combined = existing
    ? [...existing.entries, ...newEntries]
    : newEntries;

  const doc = {
    kind:           "brain_faqs",
    category,
    generated_at:   new Date().toISOString(),
    source:         `Structural import from ${path.basename(inputPath)} (${format}, no LLM)`,
    author_status:  "pending_review",
    count:          combined.length,
    entries:        combined
  };

  if (!fs.existsSync(KNOWLEDGE_DIR)) fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8");

  console.log(`\n✅ ${outPath}`);
  console.log(`   + ${newEntries.length} new entries`);
  console.log(`   = ${combined.length} total entries in ${category}.json`);
  console.log(`\nNext: npm run knowledge:validate  (voice + spelling checks)`);
  console.log(`      npm run knowledge:build     (merges into master)`);
}

try { main(); } catch (err) {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
}
