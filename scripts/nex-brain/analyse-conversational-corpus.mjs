// NEX Conversational Corpus · Dry-run analyser (Philip 2026-08-14).
// Reads the raw corpus, deduplicates, buckets by section + query type + brain routing.
// Reports: raw / unique / duplicate-groups / most-repeated / brain-routing decisions.
// NO conversational-intelligence files are modified by this script.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CORPUS = join(process.cwd(), "data", "nex-conversational-corpus", "raw-corpus-2026-08-14.txt");
const OUT_DIR = join(process.cwd(), "data", "nex-conversational-corpus");
const OUT_REPORT = join(OUT_DIR, "dry-run-report-2026-08-14.json");

// --- Adjacent-brain routing (from Philip's decisions 2026-08-14) ---
// Every section maps to: on_brain | future_brain | defer
const SECTION_ROUTING = {
  "Architecture, Aesthetics & Design Styles": "on_brain",
  "Building Codes, Safety & Accessibility Standards": "future_brain:building_codes",
  "Building Codes, Safety & Standards (duplicate section)": "future_brain:building_codes",
  "Carpentry, Mathematics & Structural Framing": "partial_on_brain", // some design + some fabrication
  "Carpentry, Framework & Engineering": "partial_on_brain",
  "Stair Runner Carpets & Textile Selection": "on_brain",
  "Carpets, Runners & Textiles (duplicate section)": "on_brain",
  "Map Layouts, Floor Plans & Spatial Wayfinding": "future_brain:wayfinding",
  "Maintenance, Renovation & DIY Repair": "on_brain",
  "Material Science, Fabrication & Manufacturing": "defer",
  "Material Selection & Fabrication (duplicate section)": "defer",
  "Ergonomics, Biomechanics & Injury Prevention": "future_brain:ergonomics",
  "Dimensional Math & Structural Planning": "partial_on_brain",
  "Layout Types & Spatial Optimization": "on_brain",
  "Railings, Balustrades & Handrails": "on_brain",
  "Staircase Steps, Treads & Risers": "on_brain",
  "Lighting, Smart Automation & Storage": "on_brain",
  "Business, Estimating & Project Management": "future_brain:business_estimation",
};

// --- Reference Brain source-evidence lookup (very lightweight — heuristic keywords) ---
// If a question contains keywords from these clusters, it likely maps to the named source.
const EVIDENCE_CLUSTERS = [
  { source: "starting-steps-knowledge + types-carpet-and-design", keywords: ["starting step", "first step", "bottom step", "bullnose", "curtail", "volute", "flared bottom", "widen"] },
  { source: "landing-railings-continuity-and-construction", keywords: ["landing", "top newel", "base rail", "baserail", "continuity", "corner newel"] },
  { source: "staircase-handrail-components", keywords: ["handrail", "gooseneck", "swan-neck", "rosette", "bracket", "moulded profile", "wall-mounted handrail"] },
  { source: "newel-caps-knowledge", keywords: ["newel cap", "ball finial", "cap on the newel", "flat cap"] },
  { source: "staircase-timbers", keywords: ["oak", "pine", "walnut", "mahogany", "maple", "beech", "ash", "cherry", "timber species", "wood species"] },
  { source: "step-mats-knowledge", keywords: ["step mat", "step mats", "individual mat", "mats on"] },
  { source: "refacing-before-after-cards", keywords: ["refurbish", "refacing", "reface", "before after", "before/after"] },
  { source: "under_stair_scenes (batches 7/10)", keywords: ["under stair", "under-stair", "understair", "under my stairs", "under the stairs"] },
  { source: "batch_8_landing_railings_gallery", keywords: ["baluster", "spindle", "balustrade"] },
  { source: "handrail_components + memory", keywords: ["stringer", "cut string", "closed string", "open string", "mono-stringer"] },
];

function detectImageSearch(q) {
  return /\[image_search\]/i.test(q);
}
function cleanQuestion(q) {
  // Remove [image_search] tag, quotes, trailing punctuation whitespace
  return q.replace(/\[image_search\]/gi, "").replace(/^["']|["']$/g, "").trim();
}
function normaliseForDedupe(q) {
  return cleanQuestion(q)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function findEvidence(q) {
  const lower = q.toLowerCase();
  const hits = [];
  for (const cluster of EVIDENCE_CLUSTERS) {
    if (cluster.keywords.some((k) => lower.includes(k.toLowerCase()))) hits.push(cluster.source);
  }
  return hits;
}

// --- Parse the corpus ---
const raw = readFileSync(CORPUS, "utf8");
const lines = raw.split(/\r?\n/);
const entries = [];
let currentSection = null;

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") && !trimmed.startsWith("## SECTION:")) continue;
  const secMatch = trimmed.match(/^##\s*SECTION:\s*(.+)$/);
  if (secMatch) {
    currentSection = secMatch[1].trim();
    continue;
  }
  if (!currentSection) continue;
  if (!/[?!.]$/.test(trimmed) && !/\[image_search\]/i.test(trimmed)) {
    // Non-question line — skip.
    continue;
  }
  entries.push({
    section: currentSection,
    raw: trimmed,
    text: cleanQuestion(trimmed),
    normalised: normaliseForDedupe(trimmed),
    image_search: detectImageSearch(trimmed),
    routing: SECTION_ROUTING[currentSection] || "on_brain",
  });
}

// --- Bucket + dedupe ---
const bySection = {};
const byNorm = new Map();
for (const e of entries) {
  bySection[e.section] = (bySection[e.section] || 0) + 1;
  const list = byNorm.get(e.normalised) || [];
  list.push(e);
  byNorm.set(e.normalised, list);
}
const uniqueQuestions = Array.from(byNorm.values()).map((list) => list[0]);
const duplicateGroups = Array.from(byNorm.values()).filter((list) => list.length > 1);
const mostRepeated = duplicateGroups
  .map((g) => ({ text: g[0].text, count: g.length, sections: [...new Set(g.map((x) => x.section))] }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 25);

// --- Query type distribution ---
const imageQueries = uniqueQuestions.filter((q) => q.image_search).length;
const textQueries = uniqueQuestions.length - imageQueries;

// --- Brain routing distribution ---
const routingCounts = {};
for (const q of uniqueQuestions) routingCounts[q.routing] = (routingCounts[q.routing] || 0) + 1;

// --- Evidence coverage (crude keyword-based estimate) ---
let withEvidence = 0;
let withoutEvidence = 0;
const evidenceByCluster = {};
const gapExamples = [];
for (const q of uniqueQuestions) {
  const hits = findEvidence(q.text);
  if (hits.length) {
    withEvidence++;
    for (const h of hits) evidenceByCluster[h] = (evidenceByCluster[h] || 0) + 1;
  } else if (q.routing === "on_brain" || q.routing === "partial_on_brain") {
    withoutEvidence++;
    if (gapExamples.length < 30) gapExamples.push({ section: q.section, text: q.text });
  }
}

// --- Report ---
const report = {
  meta: {
    computed_at: new Date().toISOString(),
    corpus_file: "data/nex-conversational-corpus/raw-corpus-2026-08-14.txt",
    provenance: "philip-supplied 2026-08-14",
  },
  raw_counts: {
    raw_questions: entries.length,
    unique_questions: uniqueQuestions.length,
    duplicate_groups: duplicateGroups.length,
    duplicate_question_instances: entries.length - uniqueQuestions.length,
  },
  by_section: bySection,
  query_type_distribution: {
    text_answer: textQueries,
    image_retrieval: imageQueries,
    image_pct: uniqueQuestions.length ? Math.round((imageQueries / uniqueQuestions.length) * 100) : 0,
  },
  brain_routing_distribution: routingCounts,
  evidence_estimate_crude: {
    with_reference_brain_source: withEvidence,
    without_reference_brain_source_on_brain: withoutEvidence,
    coverage_pct_on_brain: (withEvidence + withoutEvidence) ? Math.round((withEvidence / (withEvidence + withoutEvidence)) * 100) : 0,
  },
  evidence_by_source_cluster: evidenceByCluster,
  most_repeated_top25: mostRepeated,
  on_brain_evidence_gap_examples: gapExamples,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2), "utf8");

// --- Console summary ---
console.log("=".repeat(72));
console.log("NEX Conversational Corpus · DRY-RUN ANALYSIS (Philip 2026-08-14)");
console.log("=".repeat(72));
console.log("");
console.log("RAW COUNTS");
console.log("  Raw questions (before dedupe):        ", report.raw_counts.raw_questions);
console.log("  Unique questions (after dedupe):      ", report.raw_counts.unique_questions);
console.log("  Duplicate groups:                     ", report.raw_counts.duplicate_groups);
console.log("  Duplicate instances (raw − unique):   ", report.raw_counts.duplicate_question_instances);
console.log("");
console.log("QUERY TYPE (of unique questions)");
console.log("  text_answer:              ", report.query_type_distribution.text_answer);
console.log("  image_retrieval:          ", report.query_type_distribution.image_retrieval, `(${report.query_type_distribution.image_pct}%)`);
console.log("");
console.log("BY SECTION (raw counts)");
for (const [sec, count] of Object.entries(bySection).sort((a,b) => b[1] - a[1])) {
  const routing = SECTION_ROUTING[sec] || "on_brain";
  console.log(`  ${count.toString().padStart(3)}  ${sec.slice(0, 60).padEnd(60)}  [${routing}]`);
}
console.log("");
console.log("BRAIN ROUTING (unique questions)");
for (const [r, c] of Object.entries(routingCounts).sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${c.toString().padStart(3)}  ${r}`);
}
console.log("");
console.log("EVIDENCE COVERAGE ESTIMATE (crude keyword-based, ON-BRAIN only)");
console.log("  With Reference Brain source (est):    ", report.evidence_estimate_crude.with_reference_brain_source);
console.log("  Without source · needs review:        ", report.evidence_estimate_crude.without_reference_brain_source_on_brain);
console.log("  Rough coverage %:                     ", report.evidence_estimate_crude.coverage_pct_on_brain + "%");
console.log("");
console.log("TOP-10 SOURCE CLUSTERS BY QUESTION COUNT");
const clusters = Object.entries(evidenceByCluster).sort((a,b) => b[1] - a[1]).slice(0, 10);
for (const [src, c] of clusters) console.log(`  ${c.toString().padStart(3)}  ${src}`);
console.log("");
console.log("MOST-REPEATED QUESTIONS (top 15)");
for (const r of mostRepeated.slice(0, 15)) {
  console.log(`  ×${r.count}  ${r.text.slice(0, 70)}...`);
  console.log(`         appears in: ${r.sections.join(" · ")}`);
}
console.log("");
console.log("ON-BRAIN EVIDENCE-GAP EXAMPLES (first 15)");
for (const g of gapExamples.slice(0, 15)) {
  console.log(`  · [${g.section.slice(0, 30)}] ${g.text.slice(0, 80)}`);
}
console.log("");
console.log("Full JSON report written: " + OUT_REPORT);
