#!/usr/bin/env node
// health.mjs — computes Brain Health metrics from knowledge/*.json.
// Writes knowledge_health.json for the admin dashboard to read, and
// prints a human-readable summary to stdout.
//
// Also runs automatically at the end of knowledge:build so metrics
// are always fresh after a rebuild. Standalone use:
//
//   node scripts/knowledge/health.mjs             # write + print
//   node scripts/knowledge/health.mjs --json      # JSON to stdout only
//   node scripts/knowledge/health.mjs --quiet     # write file, no stdout

import fs from "node:fs";
import path from "node:path";
import {
  loadAllCategories, MASTER_FILE,
  BANNED_PHRASES, VOICE_MARKERS, US_SPELLINGS, US_CONTEXT_SPELLINGS,
  REQUIRED_FIELDS, normaliseQuestion, checksum
} from "./_lib.mjs";

const HEALTH_FILE = path.resolve(process.cwd(), "knowledge_health.json");

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const quiet    = args.includes("--quiet");

const cats = loadAllCategories();
const perCategory = {};

const seenIds = new Set();
const seenQuestions = new Map();

let totalEntries       = 0;
let totalAnswerChars   = 0;
let duplicateIds       = 0;
let duplicateQuestions = 0;
let factCheckFlags     = 0;
let missingVoice       = 0;
let bannedPhraseHits   = 0;
let usSpellingHits     = 0;
let missingRequired    = 0;

const bannedPhraseBreakdown = new Map();

for (const { category, doc } of cats) {
  const entries = Array.isArray(doc.entries) ? doc.entries : [];
  const stats = {
    count:               entries.length,
    avg_answer_length:   0,
    missing_voice:       0,
    fact_check_flags:    0,
    banned_phrase_hits:  0,
    us_spelling_hits:    0,
    duplicate_questions: 0,
    voice_pass_rate:     0
  };
  let catAnswerChars = 0;
  const catSeenQuestions = new Set();

  for (const e of entries) {
    totalEntries += 1;
    const answer = String(e?.answer ?? "");
    catAnswerChars += answer.length;
    totalAnswerChars += answer.length;

    // Required fields
    for (const f of REQUIRED_FIELDS) {
      if (!e?.[f]) { missingRequired += 1; break; }
    }

    // Duplicate IDs (cross-category)
    if (e?.id) {
      if (seenIds.has(e.id)) duplicateIds += 1;
      seenIds.add(e.id);
    }

    // Duplicate questions (cross-category + intra-category)
    if (e?.question) {
      const k = normaliseQuestion(e.question);
      if (k && k.length > 5) {
        if (seenQuestions.has(k)) duplicateQuestions += 1;
        seenQuestions.set(k, `${category}:${e.id}`);
        if (catSeenQuestions.has(k)) stats.duplicate_questions += 1;
        catSeenQuestions.add(k);
      }
    }

    // Voice markers
    const hasVoice = VOICE_MARKERS.some((rx) => rx.test(answer));
    if (!hasVoice) {
      missingVoice += 1;
      stats.missing_voice += 1;
    }

    // Fact-check flags
    if (e?.fact_check_flag) {
      factCheckFlags += 1;
      stats.fact_check_flags += 1;
    }

    // Banned phrases
    for (const { pattern, rule } of BANNED_PHRASES) {
      if (pattern.test(answer)) {
        bannedPhraseHits += 1;
        stats.banned_phrase_hits += 1;
        bannedPhraseBreakdown.set(rule, (bannedPhraseBreakdown.get(rule) ?? 0) + 1);
        break;
      }
    }

    // US spellings — flat list first (always fires)
    let usHit = false;
    for (const us of US_SPELLINGS) {
      const rx = new RegExp(`\\b${us}\\b`, "i");
      if (rx.test(answer)) { usHit = true; break; }
    }
    // Context-sensitive — only fires if the answer contains the word AND the context regex
    if (!usHit) {
      for (const { us, context } of US_CONTEXT_SPELLINGS) {
        const wordRx = new RegExp(`\\b${us}\\b`, "i");
        if (wordRx.test(answer) && context.test(answer)) { usHit = true; break; }
      }
    }
    if (usHit) {
      usSpellingHits += 1;
      stats.us_spelling_hits += 1;
    }
  }

  stats.avg_answer_length = entries.length > 0
    ? Math.round(catAnswerChars / entries.length)
    : 0;
  stats.voice_pass_rate = entries.length > 0
    ? Math.round(((entries.length - stats.missing_voice) / entries.length) * 100)
    : 0;
  perCategory[category] = stats;
}

// Master file freshness
let lastBuildAt = null;
let masterChecksum = null;
if (fs.existsSync(MASTER_FILE)) {
  const master = JSON.parse(fs.readFileSync(MASTER_FILE, "utf8"));
  lastBuildAt = master.generated_at ?? null;
  masterChecksum = checksum(JSON.stringify(master.categories_manifest ?? {}));
}

// Health score — weighted composite (0-100)
// Errors are heavily penalised; warnings lightly.
const errors = duplicateIds + bannedPhraseHits + missingRequired;
const warnings = missingVoice + factCheckFlags + duplicateQuestions + usSpellingHits;

// Health score bands:
//   100 = zero issues
//   -5 per error
//   -0.1 per warning
// Floor at 0.
const rawScore = 100 - (errors * 5) - (warnings * 0.1);
const healthScore = Math.max(0, Math.min(100, Math.round(rawScore)));

let healthBand;
if (healthScore >= 90)      healthBand = "excellent";
else if (healthScore >= 75) healthBand = "good";
else if (healthScore >= 60) healthBand = "fair";
else if (healthScore >= 40) healthBand = "needs_work";
else                        healthBand = "critical";

const health = {
  version: "1.0",
  generated_at: new Date().toISOString(),
  last_build_at: lastBuildAt,
  master_checksum: masterChecksum,
  health_score: healthScore,
  health_band: healthBand,
  totals: {
    categories: cats.length,
    entries: totalEntries,
    avg_answer_length: totalEntries > 0 ? Math.round(totalAnswerChars / totalEntries) : 0
  },
  quality: {
    errors,
    warnings,
    duplicate_ids: duplicateIds,
    duplicate_questions: duplicateQuestions,
    banned_phrase_hits: bannedPhraseHits,
    us_spelling_hits: usSpellingHits,
    missing_voice: missingVoice,
    fact_check_flags: factCheckFlags,
    missing_required_fields: missingRequired
  },
  banned_phrase_breakdown: Object.fromEntries(bannedPhraseBreakdown),
  per_category: perCategory
};

// Persist
fs.writeFileSync(HEALTH_FILE, JSON.stringify(health, null, 2) + "\n", "utf8");

if (jsonOnly) {
  process.stdout.write(JSON.stringify(health, null, 2) + "\n");
} else if (!quiet) {
  const band = { excellent: "🟢", good: "🟢", fair: "🟡", needs_work: "🟠", critical: "🔴" }[healthBand];
  console.log(`\n═══ NEX Brain Health ═══`);
  console.log(`  Score:            ${band} ${healthScore}/100 (${healthBand})`);
  console.log(`  Categories:       ${health.totals.categories}`);
  console.log(`  Entries:          ${health.totals.entries.toLocaleString("en-GB")}`);
  console.log(`  Avg answer:       ${health.totals.avg_answer_length} chars`);
  console.log(`  Last build:       ${lastBuildAt ? new Date(lastBuildAt).toISOString().slice(0, 19).replace("T", " ") : "never"}`);
  console.log(`\n  Errors:           ${errors}${errors > 0 ? "  ← BLOCKS PUBLISH" : ""}`);
  console.log(`  Warnings:         ${warnings}`);
  console.log(`    · missing voice:      ${missingVoice}`);
  console.log(`    · fact-check flags:   ${factCheckFlags}`);
  console.log(`    · duplicate questions:${duplicateQuestions}`);
  console.log(`    · US spellings:       ${usSpellingHits}`);
  console.log(`    · banned phrases:     ${bannedPhraseHits}`);
  console.log(`    · missing required:   ${missingRequired}`);
  console.log(`\n  Per category:`);
  for (const [cat, s] of Object.entries(perCategory)) {
    console.log(`    ${cat.padEnd(15)} ${String(s.count).padStart(4)} entries · voice ${String(s.voice_pass_rate).padStart(3)}% · avg ${String(s.avg_answer_length).padStart(3)}ch · ${s.fact_check_flags} flags`);
  }
  console.log(`\n  Written to knowledge_health.json`);
}
