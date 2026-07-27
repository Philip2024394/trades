#!/usr/bin/env node
// Similarity scan for knowledge/staircase.json — finds pairs of
// entries whose QUESTIONS share a lot of content-word tokens, or
// whose ANSWERS overlap heavily. Author reviews the pairs to decide
// whether to merge, tighten or keep as-is.
//
// Read-only — reports pairs; makes no edits.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","so","because","for","of","in",
  "on","at","to","from","by","with","as","is","are","was","were","be","been",
  "being","do","does","did","done","have","has","had","having","will","would",
  "could","should","may","might","can","cannot","not","no","yes","this","that",
  "these","those","it","its","itself","he","she","they","them","their","there",
  "which","who","whom","whose","when","where","why","how","what","about","into",
  "out","up","down","over","under","again","further","once","also","just","only",
  "than","too","very","one","two","some","most","other","own","same","such","new",
  "old","first","last","many","much","more","less","few","every","any","all",
  "before","after","during","between","through","against","above","below","off",
  "onto","upon","get","got","let","us","you","your","yours","yourself","i","me",
  "my","we","us","our","staircase","staircases","stair","stairs","step","steps",
  "make","made","use","used","using","need","want","see","look","think","know"
]);

function tokenise(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[.,;:!?()"'’‘“”\-–—/]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 3 && !STOPWORDS.has(t));
}

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

const entries = doc.entries.map(e => ({
  id: e.id,
  q: e.question,
  a: e.answer,
  qTok: tokenise(e.question),
  aTok: tokenise(e.answer)
}));

// Q-similarity pairs (topic overlap)
const Q_THRESHOLD = 0.35;   // fairly aggressive
const A_THRESHOLD = 0.30;

const qPairs = [];
const aPairs = [];
for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const qSim = jaccard(entries[i].qTok, entries[j].qTok);
    const aSim = jaccard(entries[i].aTok, entries[j].aTok);
    if (qSim >= Q_THRESHOLD) qPairs.push({ i, j, qSim, aSim });
    else if (aSim >= A_THRESHOLD) aPairs.push({ i, j, qSim, aSim });
  }
}
qPairs.sort((a, b) => b.qSim - a.qSim);
aPairs.sort((a, b) => b.aSim - a.aSim);

console.log(`Total entries: ${entries.length}`);
console.log(`Q-similarity pairs ≥ ${Q_THRESHOLD}: ${qPairs.length}`);
console.log(`A-similarity pairs ≥ ${A_THRESHOLD} (question-distinct): ${aPairs.length}`);
console.log();

console.log("═══ TOP QUESTION-SIMILARITY PAIRS ═══");
for (const p of qPairs.slice(0, 30)) {
  const A = entries[p.i], B = entries[p.j];
  console.log(`\nqSim=${p.qSim.toFixed(2)} · aSim=${p.aSim.toFixed(2)}`);
  console.log(`  ${A.id}: ${A.q}`);
  console.log(`  ${B.id}: ${B.q}`);
}

console.log("\n\n═══ TOP ANSWER-SIMILARITY PAIRS (with distinct questions) ═══");
for (const p of aPairs.slice(0, 20)) {
  const A = entries[p.i], B = entries[p.j];
  console.log(`\naSim=${p.aSim.toFixed(2)}`);
  console.log(`  ${A.id}: ${A.q}`);
  console.log(`  ${B.id}: ${B.q}`);
}
