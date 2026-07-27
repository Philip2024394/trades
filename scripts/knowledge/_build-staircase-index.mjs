#!/usr/bin/env node
// Builds a lightweight retrieval INDEX for the staircase brain.
// A serving layer loads this ~100KB file ONCE, holds it in RAM, and
// matches user queries in microseconds — without needing to parse
// the 825KB full-content knowledge/staircase.json on every request.
//
// Full-content lookup by entry_id happens only AFTER the right entry
// is known, and can also be cached in RAM or served from an object
// store keyed by id.
//
// Index schema (per entry):
//   id            — entry id (matches full brain)
//   q             — original question text
//   q_norm        — lowercased, punctuation-stripped, stop-worded
//   tokens        — content-word tokens (deduplicated, sorted)
//   audience      — 1-5 audience level
//   class         — classification
//   has_diagram   — true if a reference image is attached
//   topic         — inferred topic tag (squeak, glass, oak, etc.)
//   a_len         — full answer character length (helps serving layer
//                   pick short-answer entries for fast rendering)
//
// Also emits:
//   by_topic      — topic → [entry_ids] for fast topic-first retrieval
//   version, generated_at, source_checksum

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SRC = path.resolve("knowledge/staircase.json");
const OUT = path.resolve("knowledge_index/staircase.json");
// Deliberately NOT inside knowledge/ — the content validator scans
// every .json file in knowledge/ and would flag the index (different
// schema) as invalid content.
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const raw = fs.readFileSync(SRC, "utf8");
const doc = JSON.parse(raw);

// Stopwords — remove low-signal words from token index to keep it tight.
const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","so","for","of","in","on","at","to","from","by","with",
  "as","is","are","was","were","be","been","being","do","does","did","have","has","had","will","would",
  "could","should","may","might","can","not","no","yes","this","that","these","those","it","its","he",
  "she","they","them","their","there","which","who","whom","whose","when","where","why","how","what",
  "about","into","out","up","down","over","under","again","further","once","also","just","only","than",
  "too","very","one","two","some","most","other","own","same","such","new","old","first","last","many",
  "much","more","less","few","every","any","all","before","after","during","between","through","against",
  "above","below","off","onto","upon","get","got","let","us","you","your","yours","i","me","my","we"
]);

// Topic keyword map — used to derive `topic` tag for each entry.
// Broad topics only; a serving layer can layer on more specific tags later.
const TOPIC_KEYWORDS = [
  ["squeak",       ["squeak","squeaking","squeaks","creak","creaking","creaks","noise","noisy","movement"]],
  ["wedge",        ["wedge","wedges","angle block","angle blocks","glue block"]],
  ["balustrade",   ["balustrade","balustrades","baluster","balusters","spindle","spindles","handrail","handrails","newel","newels"]],
  ["glass",        ["glass","glazed","frameless","toughened","laminated","point fixing","spider","channel","spigot","crittall"]],
  ["timber",       ["timber","wood","wooden","oak","walnut","ash","maple","cherry","mahogany","pine","softwood","hardwood","grain","knot","knots"]],
  ["finish",       ["varnish","lacquer","finish","finishing","2-pack","2k","oil","wax","polish","coating","sealer","stain","paint","painted"]],
  ["safety",       ["approved doc k","doc k","building regulations","building control","safety","compliance","regs","regulations","cra","consumer rights"]],
  ["design",       ["design","style","modern","traditional","victorian","georgian","edwardian","farmhouse","scandinavian","coastal","industrial","luxury"]],
  ["measurement",  ["measurement","measure","rise","going","pitch","headroom","tread","riser","string","stringer","landing","opening","floor-to-floor","walking line"]],
  ["shape",        ["straight","spiral","curved","helical","winder","l-shape","u-shape","half-turn","quarter-turn","dog-leg","split","floating","cantilever"]],
  ["install",      ["install","installation","installer","fit","fitting","carpenter","joiner","plaster","plastering"]],
  ["cost",         ["price","cost","quote","quotation","deposit","payment","budget","expensive","affordable"]],
  ["lighting",     ["led","lighting","lights","light","under-tread","wall light","motion sensor","smart home"]],
  ["cleaning",     ["clean","cleaning","maintenance","dust","polish","water","chemicals","cleaner"]],
  ["repair",       ["repair","replace","replacement","refurbish","restoration","damaged","broken","loose"]],
  ["children",     ["child","children","kids","baby","toddler","family"]],
  ["stone",        ["stone","marble","concrete","porcelain"]],
  ["metal",        ["metal","steel","iron","brass","aluminium","bronze","powder-coat","powder coated"]],
  ["adversarial",  ["told me","claim","claims","true","really","actually","misleading","legally"]]
];

function normQ(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[.,;:!?()"'’‘“”\-–—/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenise(s) {
  const seen = new Set();
  for (const tok of normQ(s).split(" ")) {
    if (tok.length > 2 && !STOPWORDS.has(tok)) seen.add(tok);
  }
  return [...seen].sort();
}

function deriveTopic(q, a) {
  const t = (q + " " + a).toLowerCase();
  for (const [topic, kws] of TOPIC_KEYWORDS) {
    for (const kw of kws) {
      const rx = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (rx.test(t)) return topic;
    }
  }
  return "general";
}

const entries = [];
const byTopic = {};

for (const e of doc.entries) {
  const q_norm = normQ(e.question);
  const tokens = tokenise(e.question + " " + (e.answer ?? "").slice(0, 400));
  const topic = deriveTopic(e.question, e.answer ?? "");
  const idx = {
    id:          e.id,
    q:           e.question,
    q_norm,
    tokens,
    audience:    e.audience_level ?? null,
    class:       e.classification ?? null,
    has_diagram: Boolean(e.diagram),
    topic,
    a_len:       String(e.answer ?? "").length
  };
  entries.push(idx);
  (byTopic[topic] ??= []).push(e.id);
}

const checksum = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 12);

const index = {
  version:         1,
  generated_at:    new Date().toISOString(),
  source_checksum: checksum,
  category:        "staircase",
  entry_count:     entries.length,
  topics:          Object.keys(byTopic).sort(),
  by_topic:        Object.fromEntries(Object.entries(byTopic).map(([t, ids]) => [t, ids.sort()])),
  entries
};

fs.writeFileSync(OUT, JSON.stringify(index) + "\n", "utf8");

const outSize = fs.statSync(OUT).size;
const srcSize = fs.statSync(SRC).size;
const ratio = (outSize / srcSize * 100).toFixed(1);

console.log(`✅ Retrieval index built:`);
console.log(`   entries indexed:   ${entries.length}`);
console.log(`   topics extracted:  ${Object.keys(byTopic).length}`);
console.log(`   index size:        ${(outSize / 1024).toFixed(1)} KB (${ratio}% of full brain)`);
console.log(`   full brain size:   ${(srcSize / 1024).toFixed(1)} KB`);
console.log(`   source checksum:   ${checksum}`);
console.log(`   written to:        knowledge_index/staircase.json`);
console.log();
console.log(`Topic distribution (top 10):`);
const sorted = Object.entries(byTopic).sort((a, b) => b[1].length - a[1].length);
for (const [t, ids] of sorted.slice(0, 10)) {
  console.log(`   ${t.padEnd(15)} ${String(ids.length).padStart(3)} entries`);
}
