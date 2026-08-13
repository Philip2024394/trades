// scripts/prove-avery-reduction.mjs
//
// Step 5 · Avery SYSTEM_PROMPT reduction · post-implementation probe.
//
// This script extracts the SYSTEM_PROMPT template literal from
// knowledge-extractor.ts using precise character-boundary parsing (NOT regex),
// counts its actual character length, and asserts the reduction landed
// within the audited envelope (Step 4 baseline: 5,717 chars).
//
// It also asserts the invariants the Step 5 audit called out:
//   · S1 (role definition)   → present
//   · S2 (context bundle)    → present
//   · S3 (learning bundle)   → present with 5-category taxonomy · tail paragraph absent
//   · S4 (voice guide)       → present with one-line pointer to Voice Guide
//   · S4 old brand-use prose → ABSENT (delegated to Blake voice.brand_use_policy)
//   · S5 rules 1, 9, 12      → ABSENT
//   · S5 rule 10             → present but shortened (delegated to Blake voice.audience_voice_note)
//   · S5 rule 11 mechanic    → PRESERVED (Avery-unique · not owned by Blake)
//   · OUTPUT SCHEMA          → present · schema not touched
//
// This script is read-only · never posts to any endpoint · never mutates state.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTRACTOR = join(HERE, "..", "src", "lib", "nex", "brain", "workers", "knowledge-extractor.ts");

const BASELINE_CHARS = 5717;          // Step 2 runtime telemetry (authoritative)
const EXPECTED_MIN_DELTA = 900;       // ≥ ~900 chars removed (audit floor)
const EXPECTED_MAX_DELTA = 1500;      // ≤ ~1,500 chars removed (audit ceiling)

function extractSystemPrompt(source) {
  const marker = "const SYSTEM_PROMPT = `";
  const start = source.indexOf(marker);
  if (start === -1) throw new Error("SYSTEM_PROMPT declaration not found");
  const bodyStart = start + marker.length;
  // Find the CLOSING backtick · respect the "OUTPUT SCHEMA" anchor to disambiguate.
  const anchor = source.indexOf("OUTPUT SCHEMA (return this JSON, nothing else):", bodyStart);
  if (anchor === -1) throw new Error("OUTPUT SCHEMA anchor not found · file may be malformed");
  // Now find the first unescaped backtick after the anchor.
  let i = anchor;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "`") {
      // Guard against escaped backticks (there shouldn't be any in this file, but be safe).
      if (source[i - 1] !== "\\") return source.slice(bodyStart, i);
    }
    i += 1;
  }
  throw new Error("closing backtick of SYSTEM_PROMPT not found");
}

const src = readFileSync(EXTRACTOR, "utf8");
const prompt = extractSystemPrompt(src);
const chars = prompt.length;
const delta = BASELINE_CHARS - chars;

const checks = [];
const need = (label, pass, detail) => checks.push({ label, pass, detail });

// Structural section anchors.
need("S1 role definition present",
  prompt.startsWith("You are the NEX Knowledge Extractor"),
  "opens with role statement");
need("S2 context bundle section present",
  prompt.includes("CRITICAL — NEX ALREADY KNOWS THINGS (Knowledge Context)"),
  "context bundle heading");
need("S2 good-outcome sentence retained",
  prompt.includes("A good outcome looks like"),
  "healthy authoring ratio guidance is here (not duplicated in rules)");
need("S3 learning bundle present",
  prompt.includes("CRITICAL — NEX LEARNS FROM HUMAN FEEDBACK (Past Decisions)"),
  "learning bundle heading");
need("S3 taxonomy preserved (edits · approvals · rejections · corrections · voice_drift)",
  prompt.includes("edits") && prompt.includes("approvals") && prompt.includes("rejections") &&
  prompt.includes("corrections") && prompt.includes("voice_drift"),
  "5-category taxonomy still delivered");
need("S3 tail paragraph REMOVED (Rowan header owns it)",
  !prompt.includes("Weight past decisions heavily") &&
  !prompt.includes("The learning bundle is how NEX compounds"),
  "tail paragraph gone · Rowan renderLearning still emits equivalent header");
need("S4 voice guide section present",
  prompt.includes("CRITICAL — NEX HAS A VOICE (Voice & Brand Guide)"),
  "voice guide heading");
need("S4 brand-use prose REPLACED by pointer to Voice Guide",
  prompt.includes("See the BRAND-USE POLICY delivered in the VOICE GUIDE") &&
  !prompt.includes("Philip 2026-08-06") &&
  !prompt.includes("Brand language enhances the explanation"),
  "prose delegated to Blake voice.brand_use_policy");
need("S5 RULES section present",
  prompt.includes("RULES:"),
  "rules block still headed");
need("S5 rule 1 (role dup) REMOVED",
  !prompt.includes("You are NOT answering the user"),
  "role rule was redundant with S1");
need("S5 rule 9 (ratio dup) REMOVED",
  !prompt.includes("aim for MORE typed edges than new claims"),
  "ratio was already in S2 good-outcome");
need("S5 rule 12 (learning dup) REMOVED",
  !prompt.includes("your output MUST reflect what Philip changed") &&
  !prompt.includes("Do not repeat a pattern Philip already rejected"),
  "learning enforcement now owned by Rowan");
need("S5 rule 10 shortened (delegates audience-voice to Voice Guide)",
  prompt.includes("Follow the voice tone principles delivered in the VOICE GUIDE") &&
  !prompt.includes("homeowner content is warm and conversational"),
  "warm/expert-defensible language moved to Blake voice.audience_voice_note");
need("S5 rule 11 (nex_concepts vs industry_concepts) PRESERVED · Avery-unique",
  prompt.includes("Add brand terms to the record's nex_concepts array") &&
  prompt.includes("Add industry equivalents to industry_concepts") &&
  prompt.includes("Never mix these"),
  "array-mechanic rule is Avery-only · not owned by any other worker");
need("Rules renumbered 1-9 (no rule 10/11/12 numbering remains in text)",
  !/\n1[012]\.\s/.test(prompt),
  "post-reduction there are 9 rules · numbered 1-9");
need("HARD LAW retained (At NEX, we…)",
  prompt.includes(`Never use "At NEX, we…" phrasing (HARD LAW)`),
  "governance rule untouched");
need("Never-fabricate retained",
  prompt.includes("Never fabricate"),
  "Truth-Law rule untouched");
need("Sustainability alerts rule retained",
  prompt.includes("Sustainability alerts"),
  "safety rule untouched");
need("Typed-edge whitelist retained",
  prompt.includes("composes_material") && prompt.includes("regulated_by") &&
  prompt.includes("sustainability_alert_from"),
  "edge taxonomy fully preserved");
need("Confidence band mechanic retained",
  prompt.includes("confidence_band (high/medium/low)") &&
  prompt.includes("confidence_score (0.0-1.0)"),
  "claim shape unchanged");
need("OUTPUT SCHEMA anchor preserved · schema not touched",
  prompt.includes("OUTPUT SCHEMA (return this JSON, nothing else):"),
  "downstream JSON schema still governed by same anchor");

// Character-count envelope.
need(`Char count within audited envelope (baseline ${BASELINE_CHARS} · new ${chars} · delta ${delta})`,
  delta >= EXPECTED_MIN_DELTA && delta <= EXPECTED_MAX_DELTA,
  `expected reduction between ${EXPECTED_MIN_DELTA} and ${EXPECTED_MAX_DELTA} chars`);

// Report.
console.log("");
console.log("=".repeat(72));
console.log("STEP 5 · AVERY SYSTEM_PROMPT REDUCTION · PROOF");
console.log("=".repeat(72));
console.log(`file:            ${EXTRACTOR}`);
console.log(`baseline chars:  ${BASELINE_CHARS}  (Step 2 runtime telemetry)`);
console.log(`new chars:       ${chars}`);
console.log(`delta:           ${delta}  (${((delta / BASELINE_CHARS) * 100).toFixed(1)}% of baseline)`);
console.log(`envelope:        ${EXPECTED_MIN_DELTA} ≤ delta ≤ ${EXPECTED_MAX_DELTA}`);
console.log("");

let failures = 0;
for (const c of checks) {
  const badge = c.pass ? "PASS" : "FAIL";
  console.log(`  [${badge}] ${c.label}`);
  if (!c.pass) { console.log(`         ↳ ${c.detail}`); failures += 1; }
}

console.log("");
console.log("-".repeat(72));
if (failures === 0) {
  console.log(`RESULT: PASS · ${checks.length} assertions passed`);
  console.log("Runtime verification of extractor_prompt_assembled telemetry still");
  console.log("required to close the loop · this proof covers static invariants only.");
  process.exit(0);
} else {
  console.log(`RESULT: FAIL · ${failures}/${checks.length} assertions failed`);
  process.exit(1);
}
