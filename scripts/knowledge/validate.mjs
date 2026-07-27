#!/usr/bin/env node
// validate.mjs — checks every per-category JSON in knowledge/
// against the schema, uniqueness and voice rules.
//
// Runs completely offline (no LLM, no network). Exits 0 on pass,
// 1 on failures. Prints a report either way.
//
// Usage:
//   node scripts/knowledge/validate.mjs
//   node scripts/knowledge/validate.mjs --file knowledge/cement.json
//   node scripts/knowledge/validate.mjs --strict          # fail on warnings too

import { loadAllCategories, REQUIRED_FIELDS, normaliseQuestion, US_SPELLINGS, US_CONTEXT_SPELLINGS, BANNED_PHRASES, VOICE_MARKERS } from "./_lib.mjs";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const fileIdx = args.indexOf("--file");
const fileFilter = fileIdx >= 0 ? args[fileIdx + 1] : null;

const errors = [];       // block publish
const warnings = [];     // don't block, but report

function push(list, category, entryId, message) {
  list.push(`${category}${entryId ? ` · ${entryId}` : ""}: ${message}`);
}

const cats = loadAllCategories();
if (cats.length === 0) {
  console.log("⚠️  No knowledge files found in knowledge/");
  process.exit(0);
}

const seenIds = new Map();               // id -> file
const seenQuestions = new Map();         // normalisedQ -> "file:id"

let totalEntries = 0;

for (const { file, category, doc } of cats) {
  if (fileFilter && !file.includes(path.basename(fileFilter))) continue;

  if (typeof doc !== "object" || !doc) {
    push(errors, file, null, "root JSON is not an object");
    continue;
  }
  if (doc.kind !== "brain_faqs") {
    push(warnings, file, null, `root kind should be 'brain_faqs' (got '${doc.kind}')`);
  }
  if (!Array.isArray(doc.entries)) {
    push(errors, file, null, "'entries' must be an array");
    continue;
  }

  if (typeof doc.count === "number" && doc.count !== doc.entries.length) {
    push(warnings, file, null, `count field (${doc.count}) differs from actual entries (${doc.entries.length})`);
  }

  for (const entry of doc.entries) {
    totalEntries += 1;

    // Required fields
    for (const f of REQUIRED_FIELDS) {
      if (!entry?.[f]) {
        push(errors, category, entry?.id ?? "?", `missing required field '${f}'`);
      }
    }

    // ID uniqueness across all files
    if (entry?.id) {
      const prior = seenIds.get(entry.id);
      if (prior && prior !== file) {
        push(errors, category, entry.id, `duplicate id also in ${prior}`);
      } else if (prior === file) {
        push(errors, category, entry.id, "duplicate id within same file");
      } else {
        seenIds.set(entry.id, file);
      }
    }

    // Question uniqueness (semantic-ish via normalised form)
    if (entry?.question) {
      const key = normaliseQuestion(entry.question);
      if (key && key.length > 5) {
        const prior = seenQuestions.get(key);
        if (prior) {
          push(warnings, category, entry.id, `near-duplicate question — also in ${prior}`);
        } else {
          seenQuestions.set(key, `${file}:${entry.id}`);
        }
      }
    }

    const answer = String(entry?.answer ?? "");

    // Answer sanity
    if (answer.length < 20) {
      push(warnings, category, entry?.id, `answer very short (${answer.length} chars) — spec-voice? too terse?`);
    }
    if (answer.length > 800) {
      push(warnings, category, entry?.id, `answer very long (${answer.length} chars) — split into multiple Q&As?`);
    }

    // Voice markers
    if (!VOICE_MARKERS.some((rx) => rx.test(answer))) {
      push(warnings, category, entry?.id, "no Nex voice markers found (contractions, em dash or direct 'you')");
    }

    // Banned phrases
    for (const { pattern, rule } of BANNED_PHRASES) {
      if (pattern.test(answer)) {
        push(errors, category, entry?.id, rule);
      }
    }

    // US spellings — case-insensitive word-boundary match
    for (const us of US_SPELLINGS) {
      const rx = new RegExp(`\\b${us}\\b`, "i");
      if (rx.test(answer)) {
        push(warnings, category, entry?.id, `possible US spelling '${us}' — check UK equivalent`);
      }
    }
    // Context-sensitive US spellings — only warn if the answer contains the
    // word AND the accompanying context regex also matches (e.g. "story"
    // near a floor-numeral, "check" near a banking word).
    for (const { us, uk, context } of US_CONTEXT_SPELLINGS) {
      const wordRx = new RegExp(`\\b${us}\\b`, "i");
      if (wordRx.test(answer) && context.test(answer)) {
        push(warnings, category, entry?.id, `possible US spelling '${us}' in floor/banking sense — UK equivalent '${uk}'`);
      }
    }

    // Fact-check flag still present?
    if (entry?.fact_check_flag) {
      push(warnings, category, entry?.id, `fact_check_flag set — needs Author review: "${String(entry.fact_check_flag).slice(0, 80)}…"`);
    }
  }
}

// Report
console.log(`\n═══ knowledge validation ═══`);
console.log(`  categories:   ${cats.length}`);
console.log(`  entries:      ${totalEntries}`);
console.log(`  errors:       ${errors.length}`);
console.log(`  warnings:     ${warnings.length}`);

if (errors.length > 0) {
  console.log("\n❌ Errors:");
  for (const e of errors) console.log("   • " + e);
}
if (warnings.length > 0 && (strict || errors.length === 0)) {
  console.log("\n⚠️  Warnings:");
  for (const w of warnings.slice(0, 50)) console.log("   • " + w);
  if (warnings.length > 50) console.log(`   … +${warnings.length - 50} more (silenced — run with --strict for full list)`);
}

if (errors.length > 0 || (strict && warnings.length > 0)) {
  console.log("\nFailed. Fix errors above and re-run.");
  process.exit(1);
}
console.log("\n✅ Pass. Ready to build master.");

// Path helper for --file argument
import path from "node:path";
