// Compute the NEX Conversational Intelligence baseline (dry-run · read-only).
// Loads the TypeScript module compiled at runtime via a naive .ts loader shim.
// Since we're avoiding tsc setup, we duplicate the counting logic here in JS
// against the same files. Same regexes, same YAML parser.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const CWD = process.cwd();
const CI_DIR = join(CWD, "data", "nex-reference-brains", "staircase-preparation", "conversational-intelligence");
const TEST_SUITE = join(CWD, "tests", "nex-conversational", "pilot-starting-steps.yaml");

function readFile(p) { return existsSync(p) ? readFileSync(p, "utf8") : ""; }
function fileExists(name) { return existsSync(join(CI_DIR, name)); }
function countMatches(filename, re) {
  const c = readFile(join(CI_DIR, filename));
  return (c.match(re) || []).length;
}

const EXPECTED_FILES = [
  "README.md",
  "customer-language-glossary.md",
  "question-variations.md",
  "intent-patterns.md",
  "customer-intent-scenarios.md",
  "follow-up-questions.md",
  "explanation-patterns.md",
  "recommendation-language.md",
  "uncertainty-language.md",
  "what-not-to-say.md",
  "conversation-examples.md",
];

function parseSuite() {
  const raw = readFile(TEST_SUITE);
  if (!raw) return [];
  const tests = [];
  const blocks = raw.split(/^\s*-\s*id:\s*/m).slice(1);
  for (const block of blocks) {
    const idM = block.match(/^([^\n]+)/); if (!idM) continue;
    const id = idM[1].trim();
    const inputM = block.match(/input:\s*"([^"]+)"/);
    const tierM = block.match(/expected_tier:\s*(\w+)/);
    const shapeM = block.match(/expected_shape:\s*(\w+)/);
    const retrievalM = block.match(/expected_retrieval:\s*(?:\[\]|\n((?:\s{6}-[^\n]+\n)+))/);
    const retrieval = [];
    if (retrievalM && retrievalM[1]) {
      for (const line of retrievalM[1].split("\n")) {
        const m = line.match(/-\s*(\S+)/); if (m) retrieval.push(m[1]);
      }
    }
    tests.push({
      id,
      input: inputM ? inputM[1] : "",
      tier: tierM ? tierM[1] : "",
      shape: shapeM ? shapeM[1] : "",
      retrieval,
    });
  }
  return tests;
}

function scoreTest(test) {
  const intent = readFile(join(CI_DIR, "intent-patterns.md"));
  const scenarios = readFile(join(CI_DIR, "customer-intent-scenarios.md"));
  const glossary = readFile(join(CI_DIR, "customer-language-glossary.md"));
  const variations = readFile(join(CI_DIR, "question-variations.md"));
  const combined = intent + "\n" + scenarios + "\n" + glossary + "\n" + variations;

  const inputMatch = combined.toLowerCase().includes(test.input.toLowerCase());

  // Match `**Intent tier:** Clear` OR `**Intent tier:** **Ambiguous**` — some tiers are additionally emphasised in scenarios.
  const tierRegex = new RegExp(`Intent tier:\\*\\*\\s*(?:\\*\\*)?${test.tier}`, "i");
  const inputInIntent = intent.toLowerCase().includes(test.input.toLowerCase());
  const inputInScenarios = scenarios.toLowerCase().includes(test.input.toLowerCase());
  const tierOk = (inputInIntent || inputInScenarios) && (tierRegex.test(intent) || tierRegex.test(scenarios));

  let retrievalOk = true;
  if (test.retrieval.length === 0) {
    retrievalOk = /ask.first|DO NOT retrieve/i.test(intent) || /ask.first|DO NOT retrieve/i.test(scenarios);
  } else {
    for (const src of test.retrieval) {
      const stem = src.split("#")[0];
      if (!combined.toLowerCase().includes(stem.toLowerCase())) { retrievalOk = false; break; }
    }
  }

  const shapeVocab = {
    direct: [/Response shape:\s*direct/i, /direct answer/i],
    hedged_with_follow_up: [/hedged interpretation/i, /follow-up option/i, /hedged.*follow/i],
    ask_first: [/ASK/i, /clarifying question/i, /STOP\.\s*Do not answer/i],
  };
  const regs = shapeVocab[test.shape] || [];
  const shapeOk = regs.some((r) => r.test(intent) || r.test(scenarios));

  const pass = inputMatch && tierOk && retrievalOk && shapeOk;
  return { id: test.id, interp: inputMatch, tier: tierOk, retrieval: retrievalOk, shape: shapeOk, pass };
}

// Counts
const filesPresent = EXPECTED_FILES.filter(fileExists).length;
const glossary = countMatches("customer-language-glossary.md", /^\|\s*"[^"]+"\s*\|/gm);
const variations = countMatches("question-variations.md", /^-\s+"[^"]+"/gm);
const intentPatterns = countMatches("intent-patterns.md", /^###\s+Pattern\s+[A-Z]{2}-\d{2}/gm);
const scenarios = countMatches("customer-intent-scenarios.md", /^##\s+Scenario\s+\d+\s+·/gm);
const followUps = countMatches("follow-up-questions.md", /^###\s+FU-[A-Z]+-\d{2}/gm);
const explanations = countMatches("explanation-patterns.md", /^##\s+Pattern\s+EX-\d{2}/gm);
const shapes = countMatches("recommendation-language.md", /^###\s+Shape\s+R-\d{2}/gm);
const modes = countMatches("uncertainty-language.md", /^###\s+Mode\s+U-\d{2}/gm);
const banned = countMatches("what-not-to-say.md", /^##\s+Banned\s+Category\s+\d+/gm);
const conversations = countMatches("conversation-examples.md", /^##\s+Conversation\s+\d+\s+·/gm);

// Tests
const tests = parseSuite();
const outcomes = tests.map(scoreTest);
const passed = outcomes.filter((o) => o.pass).length;
const total = outcomes.length;
const passRate = total ? Math.round((passed / total) * 100) : 0;

// Composite
const filesScore = (filesPresent / EXPECTED_FILES.length) * 30;
const testScore = (passRate / 100) * 40;
const entriesScore = Math.min(30,
  (glossary / 60) * 5 +
  (variations / 100) * 5 +
  (intentPatterns / 30) * 5 +
  (scenarios / 20) * 5 +
  (followUps / 30) * 3 +
  (conversations / 30) * 7
);
const compositeScore = Math.round(filesScore + testScore + entriesScore);

console.log("=".repeat(60));
console.log("NEX CONVERSATIONAL INTELLIGENCE · BASELINE (2026-08-14)");
console.log("=".repeat(60));
console.log("");
console.log("Files present:            ", filesPresent, "/", EXPECTED_FILES.length);
console.log("Glossary entries:         ", glossary);
console.log("Question variations:      ", variations);
console.log("Intent patterns:          ", intentPatterns);
console.log("Intent scenarios:         ", scenarios);
console.log("Follow-up questions:      ", followUps);
console.log("Explanation patterns:     ", explanations);
console.log("Recommendation shapes:    ", shapes);
console.log("Uncertainty modes:        ", modes);
console.log("Banned categories:        ", banned);
console.log("Conversation examples:    ", conversations);
console.log("");
console.log("Test suite: " + passed + "/" + total + " passed (" + passRate + "%)");
console.log("");
console.log("Per-test outcomes:");
for (const o of outcomes) {
  const flags = `interp=${o.interp?"✓":"✗"} tier=${o.tier?"✓":"✗"} retr=${o.retrieval?"✓":"✗"} shape=${o.shape?"✓":"✗"}`;
  const passFail = o.pass ? "PASS" : "fail";
  console.log(`  ${o.id.padEnd(10)} ${passFail.padEnd(5)}  ${flags}`);
}
console.log("");
console.log("Composite coverage score: " + compositeScore + "/100");
console.log("  Files score:  " + Math.round(filesScore) + "/30");
console.log("  Test score:   " + Math.round(testScore) + "/40");
console.log("  Entries score:" + Math.round(entriesScore) + "/30");
console.log("");
console.log("Baseline saved: 2026-08-14 · pilot on starting steps");
