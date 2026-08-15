// NEX Adversarial Phrasings Scorer (Philip 2026-08-14).
// Measures LANGUAGE COVERAGE: does the classifier route many phrasings of the same
// underlying intent to the same concept + tier?
//
// A concept "passes" only if ALL phrasings in it resolve to the same
// (concept_family, tier) pair as the expected values. Partial matches
// are scored per-phrasing (informative but not counted as concept-pass).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CWD = process.cwd();
const SUITE = join(CWD, "tests", "nex-conversational", "adversarial-phrasings-2026-08-14.yaml");
const CLASSIFIED = join(CWD, "data", "nex-conversational-corpus", "classified-corpus-2026-08-14.jsonl");
const CLASSIFIER = join(CWD, "scripts", "nex-brain", "classify-and-score-full-corpus.mjs");
const OUT = join(CWD, "data", "nex-conversational-corpus", "adversarial-report-2026-08-14.json");

// Import classifier logic — parse the classifier script's inline definitions
// (simpler than restructuring: re-implement the core detectors here from the
// classifier's actual regex / keyword lists by literally reading them out).

// --- Extract AMBIGUOUS_MARKERS + LIKELY_MARKERS + PRONOUN_ONLY + CONCEPT_FAMILIES from classifier source ---
const classifierSrc = readFileSync(CLASSIFIER, "utf8");

function extractArray(varName) {
  const re = new RegExp("const\\s+" + varName + "\\s*=\\s*\\[([\\s\\S]*?)\\];", "m");
  const m = classifierSrc.match(re);
  if (!m) return [];
  const body = m[1];
  // Extract quoted strings
  const items = [];
  const strRe = /"([^"\\]|\\.)*"/g;
  let sm;
  while ((sm = strRe.exec(body)) !== null) {
    items.push(sm[0].slice(1, -1));
  }
  return items;
}

const AMBIGUOUS_MARKERS = extractArray("AMBIGUOUS_MARKERS");
const LIKELY_MARKERS = extractArray("LIKELY_MARKERS");

// Extract PRONOUN_ONLY_MARKERS regexes
const pronounSrc = classifierSrc.match(/const PRONOUN_ONLY_MARKERS = \[([\s\S]*?)\];/);
const pronounRegexes = [];
if (pronounSrc) {
  const patternRe = /\/([^/\\]|\\.)+?\/i/g;
  let pm;
  while ((pm = patternRe.exec(pronounSrc[1])) !== null) {
    // Convert the found regex literal back to a RegExp object
    try {
      const src = pm[0];
      // Parse out pattern and flags
      const lastSlash = src.lastIndexOf("/");
      const patternBody = src.slice(1, lastSlash);
      const flags = src.slice(lastSlash + 1);
      pronounRegexes.push(new RegExp(patternBody, flags));
    } catch {}
  }
}

// Extract CONCEPT_FAMILIES (family + first 4 keywords for speed)
const familyBlockRe = /\{\s*family:\s*"([^"]+)",\s*kws:\s*\[([\s\S]*?)\]\s*\}/g;
const CONCEPT_FAMILIES = [];
let fm;
while ((fm = familyBlockRe.exec(classifierSrc)) !== null) {
  const family = fm[1];
  const kws = [];
  const kwRe = /"([^"\\]|\\.)*"/g;
  let km;
  while ((km = kwRe.exec(fm[2])) !== null) kws.push(km[0].slice(1, -1));
  CONCEPT_FAMILIES.push({ family, kws });
}

function detectQueryType(text) {
  if (/\[image_search\]/i.test(text)) return "image_retrieval";
  if (/^show me /i.test(text.trim())) return "image_retrieval";
  if (/^give me some/i.test(text.trim())) return "image_retrieval";
  if (/^i want to see/i.test(text.trim())) return "image_retrieval";
  if (/examples of/i.test(text) || /pictures of/i.test(text) || /images of/i.test(text) || /photos of/i.test(text)) return "image_retrieval";
  if (/examples please/i.test(text) || /pictures please/i.test(text)) return "image_retrieval";
  if (/what do .* look like/i.test(text)) return "image_retrieval";
  if (/what does .* look like/i.test(text)) return "image_retrieval";
  if (/what .* pictures/i.test(text)) return "image_retrieval";
  if (/staircase examples/i.test(text) || /staircase pictures/i.test(text)) return "image_retrieval";
  if (/starting[- ]step (pictures|examples|ideas)/i.test(text)) return "image_retrieval";
  if (/(feature|design|first[- ]?step) ideas/i.test(text)) return "image_retrieval";
  if (/give me a picture/i.test(text) || /show a picture/i.test(text)) return "image_retrieval";
  return "text_answer";
}

function detectTier(text) {
  const lower = text.toLowerCase();
  if (pronounRegexes.some((r) => r.test(text))) return "Ambiguous";
  if (AMBIGUOUS_MARKERS.some((m) => lower.includes(m.toLowerCase()))) return "Ambiguous";
  if (LIKELY_MARKERS.some((m) => lower.includes(m.toLowerCase()))) return "Likely";
  return "Clear";
}

function detectConceptFamily(text) {
  const lower = text.toLowerCase();
  for (const f of CONCEPT_FAMILIES) {
    if (f.kws.some((k) => lower.includes(k.toLowerCase()))) return f.family;
  }
  return "unclassified";
}

// --- Parse the adversarial suite (line-based, robust) ---
const suiteText = readFileSync(SUITE, "utf8");
const lines = suiteText.split(/\r?\n/);
const concepts = [];
let current = null;
let inPhrasings = false;
for (const rawLine of lines) {
  const line = rawLine.replace(/\r$/, "");
  const trimmed = line.trim();
  // Start of a new concept block
  const conceptStart = line.match(/^\s*-\s*concept:\s*(.+)$/);
  if (conceptStart) {
    if (current) concepts.push(current);
    current = {
      name: conceptStart[1].trim(),
      expected_family: "",
      expected_tier: "",
      expected_query_type: null,
      expected_routing: null,
      phrasings: [],
    };
    inPhrasings = false;
    continue;
  }
  if (!current) continue;
  // Field lines
  const familyM = line.match(/^\s*expected_family:\s*(.+)$/);
  if (familyM) { current.expected_family = familyM[1].trim(); inPhrasings = false; continue; }
  const tierM = line.match(/^\s*expected_tier:\s*(.+)$/);
  if (tierM) { current.expected_tier = tierM[1].trim(); inPhrasings = false; continue; }
  const qtM = line.match(/^\s*expected_query_type:\s*(.+)$/);
  if (qtM) { current.expected_query_type = qtM[1].trim(); inPhrasings = false; continue; }
  const routM = line.match(/^\s*expected_routing:\s*"([^"]+)"/);
  if (routM) { current.expected_routing = routM[1]; inPhrasings = false; continue; }
  // Phrasings marker
  if (/^\s*phrasings:\s*$/.test(line)) { inPhrasings = true; continue; }
  // Phrasing line
  if (inPhrasings) {
    const phrM = line.match(/^\s+-\s+"([^"]+)"/);
    if (phrM) { current.phrasings.push(phrM[1]); continue; }
    // Non-phrasing line while in phrasings mode — check if it's another field
    if (/^\s*\w+:/.test(line)) { inPhrasings = false; }
  }
}
if (current) concepts.push(current);

// --- Score each concept ---
const conceptResults = [];
let totalConceptsPass = 0;
let totalPhrasings = 0;
let totalPhrasingsCorrect = 0;

for (const c of concepts) {
  const perPhrasing = c.phrasings.map((p) => {
    const family = detectConceptFamily(p);
    const tier = detectTier(p);
    const queryType = detectQueryType(p);
    const familyOk = family === c.expected_family;
    const tierOk = tier === c.expected_tier;
    const queryTypeOk = !c.expected_query_type || queryType === c.expected_query_type;
    const pass = familyOk && tierOk && queryTypeOk;
    return { phrasing: p, family, tier, queryType, familyOk, tierOk, queryTypeOk, pass };
  });
  const allPhrasingsPass = perPhrasing.every((r) => r.pass);
  const correctCount = perPhrasing.filter((r) => r.pass).length;
  conceptResults.push({
    concept: c.name,
    expected: { family: c.expected_family, tier: c.expected_tier, query_type: c.expected_query_type, routing: c.expected_routing },
    total_phrasings: c.phrasings.length,
    phrasings_correct: correctCount,
    concept_pass: allPhrasingsPass,
    per_phrasing: perPhrasing,
  });
  if (allPhrasingsPass) totalConceptsPass++;
  totalPhrasings += c.phrasings.length;
  totalPhrasingsCorrect += correctCount;
}

const report = {
  meta: { computed_at: new Date().toISOString(), suite: "adversarial-phrasings-2026-08-14" },
  summary: {
    total_concepts: concepts.length,
    concepts_full_pass: totalConceptsPass,
    concept_pass_rate_pct: Math.round((totalConceptsPass / concepts.length) * 100),
    total_phrasings: totalPhrasings,
    phrasings_correct: totalPhrasingsCorrect,
    phrasing_correct_rate_pct: Math.round((totalPhrasingsCorrect / totalPhrasings) * 100),
  },
  concepts: conceptResults,
};

mkdirSync(join(CWD, "data", "nex-conversational-corpus"), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");

// --- Console summary ---
console.log("=".repeat(74));
console.log("NEX Adversarial Phrasings · LANGUAGE COVERAGE (Philip 2026-08-14)");
console.log("Measures: same-intent recognition across many phrasings");
console.log("=".repeat(74));
console.log("");
console.log("Total concepts tested:        " + concepts.length);
console.log("Concepts fully understood:    " + totalConceptsPass + "  (" + report.summary.concept_pass_rate_pct + "%)");
console.log("Total phrasings tested:       " + totalPhrasings);
console.log("Phrasings correctly routed:   " + totalPhrasingsCorrect + "  (" + report.summary.phrasing_correct_rate_pct + "%)");
console.log("");
console.log("PER-CONCEPT BREAKDOWN");
for (const r of conceptResults) {
  const mark = r.concept_pass ? "✅" : "❌";
  console.log(`  ${mark}  ${r.concept.padEnd(52)} ${r.phrasings_correct}/${r.total_phrasings}`);
}
console.log("");
console.log("FAILURES (per concept, first failing phrasing shown)");
for (const r of conceptResults) {
  if (r.concept_pass) continue;
  const firstFail = r.per_phrasing.find((p) => !p.pass);
  console.log(`  ${r.concept}`);
  console.log(`    Expected: family=${r.expected.family} tier=${r.expected.tier}`);
  console.log(`    Got:      family=${firstFail.family} tier=${firstFail.tier}`);
  console.log(`    Phrasing: "${firstFail.phrasing}"`);
}
console.log("");
console.log("Report: " + OUT);
