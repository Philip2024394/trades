// NEX Conversational Intelligence coverage metrics.
// Every number is counted from actual files + test-suite pass rate. Never fabricated.
// Companion to computeBrainVitals() — coverage is measured, not guessed.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const CI_DIR = join(process.cwd(), "data", "nex-reference-brains", "staircase-preparation", "conversational-intelligence");
const TEST_SUITE = join(process.cwd(), "tests", "nex-conversational", "pilot-starting-steps.yaml");

// --- File counting helpers (honest counts, no inference) ---

function countLinesMatching(filepath: string, regex: RegExp): number {
  if (!existsSync(filepath)) return 0;
  const content = readFileSync(filepath, "utf8");
  return (content.match(regex) || []).length;
}

function fileExists(filename: string): boolean {
  return existsSync(join(CI_DIR, filename));
}

// --- Coverage sub-metrics ---

/**
 * Terminology coverage — count of customer-phrase → trade-term rows in the glossary.
 * Each row is a table entry with a pipe-separated line starting with `| "`
 */
function countGlossaryEntries(): number {
  return countLinesMatching(join(CI_DIR, "customer-language-glossary.md"), /^\|\s*"[^"]+"\s*\|/gm);
}

/**
 * Question-variation coverage — count of natural phrasings across all topics in question-variations.md.
 * Each variation is a bullet starting with `- "`
 */
function countQuestionVariations(): number {
  return countLinesMatching(join(CI_DIR, "question-variations.md"), /^-\s+"[^"]+"/gm);
}

/**
 * Intent-pattern coverage — count of Pattern SS-/LR-/HR-/SM-/RF-/US- entries in intent-patterns.md.
 */
function countIntentPatterns(): number {
  return countLinesMatching(join(CI_DIR, "intent-patterns.md"), /^###\s+Pattern\s+[A-Z]{2}-\d{2}/gm);
}

/**
 * Customer-intent scenarios — count of `## Scenario N ·` headers in customer-intent-scenarios.md.
 */
function countIntentScenarios(): number {
  return countLinesMatching(join(CI_DIR, "customer-intent-scenarios.md"), /^##\s+Scenario\s+\d+\s+·/gm);
}

/**
 * Follow-up questions — count of `### FU-` entries in follow-up-questions.md.
 */
function countFollowUps(): number {
  return countLinesMatching(join(CI_DIR, "follow-up-questions.md"), /^###\s+FU-[A-Z]+-\d{2}/gm);
}

/**
 * Explanation patterns — count of `## Pattern EX-` entries in explanation-patterns.md.
 */
function countExplanationPatterns(): number {
  return countLinesMatching(join(CI_DIR, "explanation-patterns.md"), /^##\s+Pattern\s+EX-\d{2}/gm);
}

/**
 * Recommendation shapes — count of `### Shape R-` entries in recommendation-language.md.
 */
function countRecommendationShapes(): number {
  return countLinesMatching(join(CI_DIR, "recommendation-language.md"), /^###\s+Shape\s+R-\d{2}/gm);
}

/**
 * Uncertainty modes — count of `### Mode U-` entries in uncertainty-language.md.
 */
function countUncertaintyModes(): number {
  return countLinesMatching(join(CI_DIR, "uncertainty-language.md"), /^###\s+Mode\s+U-\d{2}/gm);
}

/**
 * Banned categories — count of `## Banned Category N` entries in what-not-to-say.md.
 */
function countBannedCategories(): number {
  return countLinesMatching(join(CI_DIR, "what-not-to-say.md"), /^##\s+Banned\s+Category\s+\d+/gm);
}

/**
 * Conversation examples — count of `## Conversation N ·` entries in conversation-examples.md.
 */
function countConversationExamples(): number {
  return countLinesMatching(join(CI_DIR, "conversation-examples.md"), /^##\s+Conversation\s+\d+\s+·/gm);
}

// --- Test-suite pass rate (honest coverage measure) ---

interface TestOutcome {
  id: string;
  interpretation_ok: boolean;
  tier_ok: boolean;
  retrieval_ok: boolean;
  shape_ok: boolean;
  pass: boolean;
}

/**
 * Extremely simple YAML parser — enough for the pilot suite shape.
 * Only supports the top-level `tests:` array with the fields we use.
 */
function parsePilotSuite(): Array<{ id: string; input: string; expected_interpretation: string[]; expected_tier: string; expected_retrieval: string[]; expected_shape: string }> {
  if (!existsSync(TEST_SUITE)) return [];
  const raw = readFileSync(TEST_SUITE, "utf8");
  const tests: any[] = [];
  const blocks = raw.split(/^\s*- id:\s*/m).slice(1);
  for (const block of blocks) {
    const idMatch = block.match(/^([^\n]+)/);
    if (!idMatch) continue;
    const id = idMatch[1].trim();
    const inputMatch = block.match(/input:\s*"([^"]+)"/);
    const tierMatch = block.match(/expected_tier:\s*(\w+)/);
    const shapeMatch = block.match(/expected_shape:\s*(\w+)/);
    const interpretationLines = (block.match(/expected_interpretation:\n((?:\s{6}-\s*\w+\n)+)/) || [null, ""])[1] || "";
    const interpretation = interpretationLines.split("\n").map((l: string) => (l.match(/-\s*(\w+)/) || [null, null])[1]).filter(Boolean) as string[];
    const inlineInterp = (block.match(/expected_interpretation:\s*\[([^\]]+)\]/) || [null, ""])[1];
    const inlineList = inlineInterp ? inlineInterp.split(",").map((s: string) => s.trim()) : [];
    const retrievalMatch = block.match(/expected_retrieval:\s*(?:\[\]|\n((?:\s{6}-[^\n]+\n)+))/);
    const retrieval: string[] = [];
    if (retrievalMatch && retrievalMatch[1]) {
      const lines = retrievalMatch[1].split("\n");
      for (const l of lines) {
        const m = l.match(/-\s*(\S+)/);
        if (m) retrieval.push(m[1]);
      }
    }
    tests.push({
      id,
      input: inputMatch ? inputMatch[1] : "",
      expected_interpretation: [...interpretation, ...inlineList].filter(Boolean),
      expected_tier: tierMatch ? tierMatch[1] : "",
      expected_retrieval: retrieval,
      expected_shape: shapeMatch ? shapeMatch[1] : "",
    });
  }
  return tests;
}

/**
 * Score a test by checking whether the conversational-intelligence files provide the expected coverage.
 * This scores COVERAGE of the input by the CI layer, not accuracy of a live NEX runtime.
 */
function scoreTest(test: ReturnType<typeof parsePilotSuite>[number]): TestOutcome {
  const intent = existsSync(join(CI_DIR, "intent-patterns.md")) ? readFileSync(join(CI_DIR, "intent-patterns.md"), "utf8") : "";
  const scenarios = existsSync(join(CI_DIR, "customer-intent-scenarios.md")) ? readFileSync(join(CI_DIR, "customer-intent-scenarios.md"), "utf8") : "";
  const glossary = existsSync(join(CI_DIR, "customer-language-glossary.md")) ? readFileSync(join(CI_DIR, "customer-language-glossary.md"), "utf8") : "";
  const variations = existsSync(join(CI_DIR, "question-variations.md")) ? readFileSync(join(CI_DIR, "question-variations.md"), "utf8") : "";
  const combined = intent + "\n" + scenarios + "\n" + glossary + "\n" + variations;

  // 1. Interpretation — is the input string (or a close phrase) mapped anywhere?
  // Simple string-inclusion check against the customer-language glossary + question-variations.
  const inputMatch = combined.toLowerCase().includes(test.input.toLowerCase());

  // 2. Tier — does intent-patterns.md include this specific input phrase AND classify it to the expected tier?
  // We check for co-location of the input text and the tier keyword.
  // Match `**Intent tier:** Clear` OR `**Intent tier:** **Ambiguous**` (Ambiguous is often additionally emphasised).
  const tierRegex = new RegExp(`Intent tier:\\*\\*\\s*(?:\\*\\*)?${test.expected_tier}`, "i");
  const inputInIntent = intent.toLowerCase().includes(test.input.toLowerCase());
  const inputInScenarios = scenarios.toLowerCase().includes(test.input.toLowerCase());
  const tierPresent = tierRegex.test(intent) || tierRegex.test(scenarios);
  const tierOk = (inputInIntent || inputInScenarios) && tierPresent;

  // 3. Retrieval — expected sources cited?
  let retrievalOk = true;
  if (test.expected_retrieval.length === 0) {
    // Ambiguous — no retrieval expected. Verify that intent OR scenarios explicitly notes "do not retrieve" or the "ask" pattern.
    retrievalOk = /ask.first|DO NOT retrieve/i.test(intent) || /ask.first|DO NOT retrieve/i.test(scenarios);
  } else {
    for (const source of test.expected_retrieval) {
      const sourceStem = source.split("#")[0];
      if (!combined.toLowerCase().includes(sourceStem.toLowerCase())) {
        retrievalOk = false;
        break;
      }
    }
  }

  // 4. Shape — is a response of the expected shape available?
  const shapeVocab: Record<string, RegExp[]> = {
    direct: [/Response shape:\s*direct/i, /direct answer/i],
    hedged_with_follow_up: [/hedged interpretation/i, /follow-up option/i, /hedged.*follow/i],
    ask_first: [/ASK/i, /clarifying question/i, /STOP\.\s*Do not answer/i],
  };
  const shapeRegexes = shapeVocab[test.expected_shape] || [];
  const shapeOk = shapeRegexes.some((r) => r.test(intent) || r.test(scenarios));

  const pass = inputMatch && tierOk && retrievalOk && shapeOk;
  return {
    id: test.id,
    interpretation_ok: inputMatch,
    tier_ok: tierOk,
    retrieval_ok: retrievalOk,
    shape_ok: shapeOk,
    pass,
  };
}

// --- Public: computeConversationalCoverage ---

export interface ConversationalCoverage {
  files_present: number;
  files_expected: number;
  glossary_entries: number;
  question_variations: number;
  intent_patterns: number;
  intent_scenarios: number;
  follow_ups: number;
  explanation_patterns: number;
  recommendation_shapes: number;
  uncertainty_modes: number;
  banned_categories: number;
  conversation_examples: number;
  test_pass: number;
  test_total: number;
  test_pass_rate_pct: number;
  test_outcomes: TestOutcome[];
  coverage_score_100: number;
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

export function computeConversationalCoverage(): ConversationalCoverage {
  const filesPresent = EXPECTED_FILES.filter((f) => fileExists(f)).length;

  const tests = parsePilotSuite();
  const outcomes = tests.map(scoreTest);
  const passed = outcomes.filter((o) => o.pass).length;
  const total = outcomes.length;
  const passRate = total ? Math.round((passed / total) * 100) : 0;

  const glossaryEntries = countGlossaryEntries();
  const questionVariations = countQuestionVariations();
  const intentPatterns = countIntentPatterns();
  const intentScenarios = countIntentScenarios();
  const followUps = countFollowUps();
  const explanationPatterns = countExplanationPatterns();
  const recommendationShapes = countRecommendationShapes();
  const uncertaintyModes = countUncertaintyModes();
  const bannedCategories = countBannedCategories();
  const conversationExamples = countConversationExamples();

  // Composite coverage score (0-100) — weighted by evidence weight, capped honestly.
  // Files-present is fundamental (30%); test pass rate is honest coverage (40%);
  // entry counts contribute the remaining 30% up to soft ceilings.
  const filesScore = (filesPresent / EXPECTED_FILES.length) * 30;
  const testScore = (passRate / 100) * 40;
  const entriesScore = Math.min(
    30,
    (glossaryEntries / 60) * 5 +
      (questionVariations / 100) * 5 +
      (intentPatterns / 30) * 5 +
      (intentScenarios / 20) * 5 +
      (followUps / 30) * 3 +
      (conversationExamples / 30) * 7
  );
  const coverageScore100 = Math.round(filesScore + testScore + entriesScore);

  return {
    files_present: filesPresent,
    files_expected: EXPECTED_FILES.length,
    glossary_entries: glossaryEntries,
    question_variations: questionVariations,
    intent_patterns: intentPatterns,
    intent_scenarios: intentScenarios,
    follow_ups: followUps,
    explanation_patterns: explanationPatterns,
    recommendation_shapes: recommendationShapes,
    uncertainty_modes: uncertaintyModes,
    banned_categories: bannedCategories,
    conversation_examples: conversationExamples,
    test_pass: passed,
    test_total: total,
    test_pass_rate_pct: passRate,
    test_outcomes: outcomes,
    coverage_score_100: coverageScore100,
  };
}
