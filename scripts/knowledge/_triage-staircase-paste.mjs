#!/usr/bin/env node
// Parses tmp/staircase-paste-2026-07-25.md, extracts each Q + A pair,
// and triages each against knowledge/staircase.json to produce a plan:
//   NEW              — no overlapping topic in existing brain
//   OVERLAP-EXTEND   — an existing entry covers the topic, but the new
//                      paste may add fresh info worth merging
//   DUPLICATE        — existing entry already covers this fully
//
// Overlap detection is keyword-based (topic tokens like "wedge", "squeak",
// "sand", "varnish", "cover slip", "scribing", "warranty", "delivery",
// "acclimatise", "underfloor heating", etc.). Author reviews the report
// before any rewriting begins.

import fs from "node:fs";
import path from "node:path";

const PASTE = path.resolve("tmp/staircase-paste-2026-07-25.md");
const BRAIN = path.resolve("knowledge/staircase.json");

const raw = fs.readFileSync(PASTE, "utf8");
const brain = JSON.parse(fs.readFileSync(BRAIN, "utf8"));

// ── Parse the markdown into Q/A pairs. Supports both `## Q:` (h2 form)
// and `# Q:` (h1 form) used in the paste.
const pairs = [];
{
  const lines = raw.split(/\r?\n/);
  let currentSection = null;
  let currentQ = null;
  let mode = null;          // 'A' | null
  let answerBuf = [];

  const flush = () => {
    if (currentQ && answerBuf.length) {
      pairs.push({
        section: currentSection,
        q: currentQ.trim(),
        a: answerBuf.join("\n").trim()
      });
    }
    currentQ = null;
    answerBuf = [];
    mode = null;
  };

  for (const ln of lines) {
    const sectionMatch = ln.match(/^#\s+Professional Staircase NEX Brain\s*[–-]\s*(.+)$/);
    if (sectionMatch) { flush(); currentSection = sectionMatch[1].trim(); continue; }

    const qMatch = ln.match(/^#{1,3}\s*Q:\s*(.+?)\s*$/);
    if (qMatch) { flush(); currentQ = qMatch[1]; mode = null; continue; }

    const aMatch = ln.match(/^#{2,4}\s*A:\s*$/);
    if (aMatch) { mode = "A"; continue; }

    // Section separator or another header — flush current Q if any
    if (/^---\s*$/.test(ln)) { continue; }

    if (mode === "A" && currentQ) {
      answerBuf.push(ln);
    }
  }
  flush();
}

// ── Topic keyword extractor. Case-insensitive. Multiword tokens matter
// (e.g. "cover slip", "underfloor heating", "site survey").
const TOPIC_TOKENS = [
  "squeak", "wedge", "angle block", "riser", "tread", "string",
  "handrail", "baluster", "spindle", "newel", "landing", "winder",
  "cover slip", "scribe", "scribing", "packer",
  "sand", "sanding", "grit", "abrasive",
  "varnish", "coating", "finish", "recoat", "stain", "wax", "oil",
  "carpet", "gripper", "underlay",
  "storey", "story",
  "measure", "measurement", "opening", "site survey", "surveyor",
  "quotation", "quote", "order", "lead time", "payment terms",
  "warranty", "guarantee", "after-sales", "after sales",
  "delivery", "transport", "damage", "packaging", "store", "storage", "garage",
  "acclimatise", "acclimatize", "humidity", "moisture",
  "central heating", "underfloor heating", "temperature",
  "sunlight", "colour", "colour change", "fade",
  "install", "installation", "install day", "fitting", "fit",
  "building regulation", "building regulations", "building control", "approved doc",
  "listed building", "old house", "historic",
  "carpenter", "joiner", "installer", "trade", "trades",
  "modify", "modification", "trim", "cutting", "alter",
  "photograph", "photo", "video", "drawing", "drawings",
  "cover slip", "gap", "wall out of square", "wall out of plumb", "level", "plumb",
  "inspect", "inspection", "snag", "snagging",
  "clean", "cleaning", "product", "bleach", "ammonia",
  "pet", "dog", "claw", "furniture", "moving upstairs",
  "chip", "scratch", "crack", "split",
  "renovate", "renovation", "restore", "restoration", "repair", "replace",
  "modernise", "modernize", "glass panel",
  "paint", "primer",
  "showroom", "compare", "social media",
  "protect", "protection", "sheeting", "dust sheet", "adhesive tape",
  "acclimatise", "manufacturer contact", "spare",
  "assumption", "check drawing",
  "written record", "email", "paperwork",
  "site visit", "call out",
  "responsibility", "blame", "cause",
  "value", "resale",
  "cover", "cover slip",
  "children", "pet safety", "safety",
  "weather", "weather tight",
  "wall out of square", "corners", "square",
  "settlement", "movement", "flex",
  "workshop", "factory"
];

function tokensIn(text) {
  const t = text.toLowerCase();
  const found = new Set();
  for (const tok of TOPIC_TOKENS) {
    const rx = new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (rx.test(t)) found.add(tok);
  }
  return found;
}

function overlap(a, b) {
  let count = 0;
  for (const t of a) if (b.has(t)) count += 1;
  return count;
}

// ── Pre-tokenise existing brain
const existing = brain.entries.map((e) => ({
  id: e.id,
  q: e.question,
  a: e.answer,
  tokens: tokensIn(`${e.question} ${e.answer}`)
}));

// ── Triage each paste pair
const NEW = [];
const OVERLAP = [];
const DUPLICATE = [];

for (const p of pairs) {
  const pTokens = tokensIn(`${p.q} ${p.a}`);
  const scored = existing
    .map((e) => ({ e, score: overlap(pTokens, e.tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const topScore = scored[0]?.score ?? 0;
  const category = topScore === 0
    ? "NEW"
    : topScore >= 4
      ? "DUPLICATE"
      : "OVERLAP";

  const record = { section: p.section, q: p.q, a: p.a, tokens: [...pTokens], nearby: scored.map((s) => ({ id: s.e.id, q: s.e.q, score: s.score })) };
  if (category === "NEW") NEW.push(record);
  else if (category === "DUPLICATE") DUPLICATE.push(record);
  else OVERLAP.push(record);
}

// ── Report
const out = {
  parsed_pairs: pairs.length,
  new_count: NEW.length,
  overlap_count: OVERLAP.length,
  duplicate_count: DUPLICATE.length,
  new: NEW,
  overlap: OVERLAP,
  duplicate: DUPLICATE
};

const OUT = path.resolve("tmp/staircase-paste-triage.json");
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

console.log(`Parsed ${pairs.length} Q&A pairs`);
console.log(`  NEW:        ${NEW.length}`);
console.log(`  OVERLAP:    ${OVERLAP.length}  (existing entry shares ≥1 topic token, <4)`);
console.log(`  DUPLICATE:  ${DUPLICATE.length}  (existing entry shares ≥4 topic tokens — check before merging)`);
console.log(`\nWritten: ${OUT}`);
console.log(`\nSection breakdown:`);
const bySec = {};
for (const p of pairs) bySec[p.section ?? "?"] = (bySec[p.section ?? "?"] ?? 0) + 1;
for (const [s, c] of Object.entries(bySec)) console.log(`  ${String(c).padStart(3)} · ${s}`);
