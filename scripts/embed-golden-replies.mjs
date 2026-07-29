#!/usr/bin/env node
// Offline embedding script for the Golden Reply Library.
//
// Reads docs/nex/golden-replies.md, extracts each numbered entry,
// computes a 1536-dim embedding for the `User:` field using OpenAI's
// text-embedding-3-small, and writes the result to
// data/nex/golden-replies.embeddings.json.
//
// Usage:
//   OPENAI_API_KEY=sk-... node scripts/embed-golden-replies.mjs
//   OPENAI_API_KEY=sk-... node scripts/embed-golden-replies.mjs --dry-run
//
// --dry-run prints the parsed entries and skips the API calls. Useful
// for verifying the parser after edits to golden-replies.md.
//
// Run this any time the golden library is edited. Committing the
// generated JSON is intentional — the retriever loads it at boot with
// no runtime OpenAI call for indexing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SOURCE  = path.join(ROOT, "docs", "nex", "golden-replies.md");
const OUT_DIR = path.join(ROOT, "data", "nex");
const OUT     = path.join(OUT_DIR, "golden-replies.embeddings.json");

const DRY_RUN = process.argv.includes("--dry-run");

// ─── Section metadata (must match golden-replies.md sections A-L) ──
const SECTION_INTENT = {
  A: "social",           // Social openers (short-circuited but kept for coverage)
  B: "social",           // Identity + frustration (short-circuited)
  C: "orientation",      // Browsing + orientation
  D: "design",           // Design + style
  E: "materials",        // Materials + finishes
  F: "price",            // Price
  G: "refurbishment",    // Refurbishment + restoration
  H: "photo",            // Photo + measurement
  I: "troubleshooting",  // Troubleshooting
  J: "confidence",       // Confidence + shared decisions
  K: "diy",              // DIY + logistics
  L: "closing",          // Closing
};

const SECTION_STAGE = {
  A: "opening",
  B: "objection",
  C: "discovery",
  D: "discovery",
  E: "discovery",
  F: "objection",
  G: "discovery",
  H: "discovery",
  I: "objection",
  J: "recommendation",
  K: "discovery",
  L: "closing",
};

// ─── Parser ───────────────────────────────────────────────────────
function parseGoldenReplies(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const entries = [];
  let current = null;
  let currentSection = null;
  let readingReply = false;
  let replyBuffer = [];

  const SECTION_RE = /^##\s+([A-Z])\s+·/;
  const HEADING_RE = /^###\s+(\d+)\.\s+(.+)$/;
  const USER_RE    = /^\*\*User:\*\*\s*(.*)$/;
  const NEX_RE     = /^\*\*NEX:\*\*\s*(.*)$/;
  const BREAK_RE   = /^---\s*$/;

  function finalise() {
    if (current) {
      if (readingReply) {
        current.reply = replyBuffer.join("\n").trim();
      }
      if (current.input && current.reply) entries.push(current);
    }
    current = null;
    readingReply = false;
    replyBuffer = [];
  }

  for (const line of lines) {
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      finalise();
      currentSection = sectionMatch[1];
      continue;
    }

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      finalise();
      const num = parseInt(headingMatch[1], 10);
      const id = currentSection
        ? `${currentSection}-${String(num).padStart(2, "0")}`
        : `X-${String(num).padStart(2, "0")}`;
      current = {
        id,
        section: currentSection,
        num,
        title:   headingMatch[2].trim(),
        input:   "",
        reply:   "",
      };
      readingReply = false;
      replyBuffer = [];
      continue;
    }

    if (!current) continue;

    const userMatch = line.match(USER_RE);
    if (userMatch) {
      readingReply = false;
      current.input = userMatch[1].trim();
      continue;
    }

    const nexMatch = line.match(NEX_RE);
    if (nexMatch) {
      readingReply = true;
      replyBuffer = [];
      if (nexMatch[1].trim()) replyBuffer.push(nexMatch[1]);
      continue;
    }

    if (BREAK_RE.test(line)) {
      finalise();
      continue;
    }

    if (readingReply) {
      replyBuffer.push(line);
    }
  }
  finalise();
  return entries;
}

// ─── Embedding ────────────────────────────────────────────────────
async function embed(text) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required (or use --dry-run).");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method:  "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body:    JSON.stringify({
      input:      text.slice(0, 8192),
      model:      "text-embedding-3-small",
      dimensions: 1536,
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== 1536) {
    throw new Error(`Bad embedding response for text: ${text.slice(0, 60)}`);
  }
  return vec;
}

// ─── Metadata helpers ─────────────────────────────────────────────
function lengthTier(reply) {
  const chars = reply.length;
  if (chars < 200) return "short";
  if (chars < 600) return "medium";
  return "long";
}

const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","should","could","may","might","must","can",
  "need","want","use","help","tell","give","get","let","see","look","take","make",
  "find","choose","know","think","feel","say","understand","just","only","also",
  "well","much","many","some","any","one","two","three","or","and","but","if",
  "when","then","so","for","to","of","in","on","at","by","with","from","up","down",
  "out","over","about","into","through","during","before","after","above","below",
  "between","under","again","further","once","here","there","where","which","who",
  "whom","what","why","how","this","that","these","those","i","you","we","they",
  "he","she","it","me","us","them","him","her","my","your","our","their","its",
  "his","hers","yours","mine","ours","theirs","not","no","yes","dont","cant",
  "wont","isnt","arent","doesnt","havent","really","very","quite","like","would"
]);

function keywordsFrom(input, reply) {
  const combined = (input + " " + reply).toLowerCase();
  const freq = new Map();
  const tokens = combined.replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  for (const t of tokens) {
    if (t.length <= 3 || STOPWORDS.has(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    process.exit(1);
  }
  const md = fs.readFileSync(SOURCE, "utf-8");
  const parsed = parseGoldenReplies(md);
  console.log(`Parsed ${parsed.length} entries from ${path.relative(ROOT, SOURCE)}`);

  if (parsed.length === 0) {
    console.error("No entries parsed. Check the format of golden-replies.md.");
    process.exit(1);
  }

  if (DRY_RUN) {
    for (const e of parsed) {
      const family = SECTION_INTENT[e.section] ?? "orientation";
      const stage  = SECTION_STAGE[e.section]  ?? "discovery";
      console.log(`  ${e.id.padEnd(6)} · ${family.padEnd(15)} · ${stage.padEnd(15)} · ${e.title.slice(0, 50)}`);
    }
    console.log(`\n--dry-run: skipping embeddings and file write.`);
    return;
  }

  const out = [];
  let i = 0;
  for (const entry of parsed) {
    i++;
    const intent_family = SECTION_INTENT[entry.section] ?? "orientation";
    const stage         = SECTION_STAGE[entry.section]  ?? "discovery";
    process.stdout.write(`  [${i}/${parsed.length}] ${entry.id} · ${entry.title.slice(0, 40)}... `);
    const embedding = await embed(entry.input);
    out.push({
      id:            entry.id,
      intent_family,
      stage,
      input:         entry.input,
      reply:         entry.reply,
      length:        lengthTier(entry.reply),
      keywords:      keywordsFrom(entry.input, entry.reply),
      embedding,
    });
    console.log("ok");
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const sizeKb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`\nWrote ${out.length} entries (${sizeKb} KB) to ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => {
  console.error("\nEmbedding failed:", err.message ?? err);
  process.exit(1);
});
