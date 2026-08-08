#!/usr/bin/env node
// claim-taxonomy.test.mjs
//
// Proves the rule-based classifier correctly assigns classes AND
// enforcement levels to well-known offending patterns from the
// forbidden-claims data file. Runs entirely in-process, no DB.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");

// Inline classifier mirroring src/lib/nex/comms-social/content/claims.ts
// so we don't need a TS runtime.
const forbidden = JSON.parse(readFileSync(join(REPO, "data", "nex-comms-social", "forbidden-claims-v1.json"), "utf8"));
const whitelist = JSON.parse(readFileSync(join(REPO, "data", "nex-comms-social", "subjective-descriptors-whitelist-v1.json"), "utf8"));

const CATEGORY_TO_CLASS = {
  guarantees_warranties:          "factual",
  qualifications_credentials:     "implicit_qualification",
  comparative_superlative:        "comparative",
  pricing_offers:                 "urgency_scarcity",
  safety_regulatory:              "factual",
  environmental_green:            "factual",
  review_required_needs_evidence: "social_proof",
  hashtags_implicit_credential:   "implicit_qualification",
};

function classify(text) {
  const claims = [];
  for (const cat of forbidden.categories) {
    for (const p of cat.patterns) {
      const re = new RegExp(p.match, "gi");
      let m; while ((m = re.exec(text)) !== null) {
        claims.push({ text: m[0], class: CATEGORY_TO_CLASS[cat.category], enforcement: cat.enforcement, category: cat.category });
      }
    }
  }
  const reject = new Set(whitelist.explicit_reject.map(s => s.toLowerCase()));
  const seen = new Set();
  for (const w of text.match(/\b[a-z][a-z\-']{2,}\b/gi) ?? []) {
    const n = w.toLowerCase();
    if (seen.has(n)) continue; seen.add(n);
    if (reject.has(n)) claims.push({ text: w, class: "subjective_descriptor", enforcement: "hard_block", category: "explicit_reject" });
  }
  return claims;
}

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

process.stdout.write("claim-taxonomy.test.mjs\n");

// TC1 · "lifetime guarantee" → guarantees_warranties hard_block
{
  const c = classify("We offer a lifetime guarantee on every staircase.");
  const hit = c.find(x => /lifetime\s+guarantee/i.test(x.text));
  record("TC1 lifetime guarantee → hard_block", hit && hit.enforcement === "hard_block" && hit.class === "factual");
}

// TC2 · "certified installer" → implicit_qualification hard_block
{
  const c = classify("We are certified installers.");
  const hit = c.find(x => /certified/i.test(x.text));
  record("TC2 certified → hard_block · implicit_qualification", hit && hit.enforcement === "hard_block" && hit.class === "implicit_qualification");
}

// TC3 · superlative "the best" → comparative hard_block
{
  const c = classify("Nottingham's the best staircase team.");
  const hit = c.find(x => /the\s+best/i.test(x.text));
  record("TC3 the best → hard_block · comparative", hit && hit.enforcement === "hard_block" && hit.class === "comparative");
}

// TC4 · urgency "limited time" → urgency_scarcity hard_block
{
  const c = classify("Limited time offer this month.");
  const hit = c.find(x => /limited\s+time/i.test(x.text));
  record("TC4 limited time → hard_block · urgency_scarcity", hit && hit.enforcement === "hard_block" && hit.class === "urgency_scarcity");
}

// TC5 · "award-winning" → social_proof review_required
{
  const c = classify("An award-winning staircase design.");
  const hit = c.find(x => /award/i.test(x.text));
  record("TC5 award-winning → review_required · social_proof", hit && hit.enforcement === "review_required" && hit.class === "social_proof");
}

// TC6 · hashtag #TrustedBuilder → implicit_qualification hard_block
{
  const c = classify("Book us today #TrustedBuilder");
  const hit = c.find(x => /Trusted/i.test(x.text));
  record("TC6 #TrustedBuilder → hard_block", hit && hit.enforcement === "hard_block" && hit.class === "implicit_qualification");
}

// TC7 · "eco-friendly" → factual hard_block · green claim
{
  const c = classify("Our eco-friendly staircases save trees.");
  const hit = c.find(x => /eco[- ]friendly/i.test(x.text));
  record("TC7 eco-friendly → hard_block · factual", hit && hit.enforcement === "hard_block" && hit.class === "factual");
}

// TC8 · explicit_reject descriptor "premium" → hard_block
{
  const c = classify("This is a premium staircase.");
  const hit = c.find(x => x.text.toLowerCase() === "premium");
  record("TC8 'premium' descriptor → hard_block · subjective", hit && hit.enforcement === "hard_block");
}

// TC9 · green descriptors do NOT trigger claims
{
  const c = classify("A beautiful modern oak staircase.");
  const hits = c.filter(x => ["beautiful","modern"].includes(x.text.toLowerCase()));
  record("TC9 green descriptors are not flagged", hits.length === 0, `hits=${hits.length}`);
}

// TC10 · clean caption produces zero claims
{
  const c = classify("Newly completed oak staircase in Nottingham.");
  record("TC10 clean caption → zero claims", c.length === 0, `n=${c.length}`);
}

process.stdout.write(`\nSummary · ${results.filter(r => r.pass).length}/${results.length} passed\n`);
process.exit(results.every(r => r.pass) ? 0 : 1);
