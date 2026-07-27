#!/usr/bin/env node
// interactive.mjs — CLI wizard for authoring knowledge entries by
// hand. Ask one Q at a time, type answer in Nex voice, saves to
// knowledge/<category>.json after every entry.
//
// Zero external dependencies. Zero API cost. Ctrl+C anytime saves
// progress. Resume mode picks up where you left off.
//
// Usage:
//   node scripts/knowledge/interactive.mjs <category>
//   node scripts/knowledge/interactive.mjs cement
//
// Keys inside the prompt:
//   Enter               Submit answer
//   Empty question      Save + quit
//   :skip               Skip this Q (don't save)
//   :undo               Delete the last saved entry
//   :list               Show entries you've added this session
//   :help               Show these commands

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { KNOWLEDGE_DIR } from "./_lib.mjs";

const category = process.argv[2];
if (!category) {
  console.error("Usage: node scripts/knowledge/interactive.mjs <category>");
  process.exit(1);
}

const outPath = path.join(KNOWLEDGE_DIR, `${category}.json`);
if (!fs.existsSync(KNOWLEDGE_DIR)) fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });

// Load or init doc
let doc;
if (fs.existsSync(outPath)) {
  doc = JSON.parse(fs.readFileSync(outPath, "utf8"));
  if (!Array.isArray(doc.entries)) doc.entries = [];
  console.log(`↩️  Resuming — ${doc.entries.length} existing entries in ${category}.json`);
} else {
  doc = {
    kind: "brain_faqs",
    category,
    generated_at: new Date().toISOString(),
    source: "Authored interactively",
    author_status: "pending_review",
    count: 0,
    entries: []
  };
  console.log(`🆕 Starting new ${category}.json`);
}

const sessionAdded = [];

function nextIdNum() {
  const maxN = doc.entries.reduce((acc, e) => {
    const m = String(e.id ?? "").match(/-(\d+)$/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return maxN + 1;
}
function saveDoc() {
  doc.count = doc.entries.length;
  doc.generated_at = new Date().toISOString();
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
}
function help() {
  console.log(`
  ── commands ──
  <empty question>   save + quit
  :skip              skip this Q (don't save)
  :undo              delete the last saved entry
  :list              show entries you've added this session
  :help              show these commands
`);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q) => new Promise((r) => rl.question(q, r));

console.log(`
╔═══════════════════════════════════════════════╗
║   NEX Knowledge · Interactive Author Mode     ║
║   Category: ${category.padEnd(33)}║
║   Ctrl+C to quit — progress saves after each  ║
╚═══════════════════════════════════════════════╝
Type :help for commands.
`);

rl.on("SIGINT", () => {
  console.log("\n\n⌘ Quit. All progress saved to " + outPath);
  process.exit(0);
});

async function main() {
  while (true) {
    const q = (await prompt("\nQuestion (empty=quit): ")).trim();
    if (!q) break;
    if (q === ":help") { help(); continue; }
    if (q === ":list") {
      if (sessionAdded.length === 0) console.log("  (none this session)");
      else sessionAdded.forEach((e) => console.log(`  · ${e.id} — ${e.question}`));
      continue;
    }
    if (q === ":undo") {
      const last = doc.entries.pop();
      const sessLast = sessionAdded.pop();
      if (last) { saveDoc(); console.log(`  ↶ removed ${last.id}`); }
      else console.log("  (nothing to undo)");
      continue;
    }
    if (q === ":skip") continue;

    const a = (await prompt("Answer (Nex voice): ")).trim();
    if (!a) { console.log("  (empty answer — skipped)"); continue; }
    if (a === ":skip") continue;

    // Optional metadata — press Enter to keep default
    const audienceRaw   = (await prompt("Audience level 1-5 (Enter=skip): ")).trim();
    const audience      = audienceRaw && !isNaN(Number(audienceRaw)) ? Number(audienceRaw) : null;
    const classRaw      = (await prompt("Classification (Enter=industry_good_practice): ")).trim();
    const classification = classRaw || "industry_good_practice";
    const safetyRaw     = (await prompt("Safety note (Enter=none): ")).trim();
    const safety_note   = safetyRaw || null;

    const idNum = nextIdNum();
    const entry = {
      id:                 `${category}-faq-${String(idNum).padStart(3, "0")}`,
      kind:               "faq",
      question:           q,
      answer:             a,
      category_tag:       category,
      audience_level:     audience,
      classification,
      safety_note,
      source_verified_at: null,
      fact_check_flag:    null
    };
    doc.entries.push(entry);
    sessionAdded.push(entry);
    saveDoc();
    console.log(`  ✔ saved ${entry.id} (${doc.entries.length} total)`);
  }

  saveDoc();
  console.log(`\n═══ session summary ═══`);
  console.log(`  saved this session:  ${sessionAdded.length}`);
  console.log(`  total in ${category}: ${doc.entries.length}`);
  console.log(`  file:                ${outPath}`);
  console.log(`\nNext: npm run knowledge:validate && npm run knowledge:build`);
  rl.close();
}

main().catch((err) => {
  console.error("❌", err);
  saveDoc();
  process.exit(1);
});
