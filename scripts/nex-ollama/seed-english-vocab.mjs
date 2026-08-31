#!/usr/bin/env node
// scripts/nex-ollama/seed-english-vocab.mjs
//
// NEX English-Teaching Brain · Vocab Seeder · Philip 2026-08-28.
//
// Reads data/nex-english-vocab-seed-v1.json (200 foundational A1-A2 words) and
// for each entry not yet present in nex.brain_english_vocabulary, sends the
// word to local Ollama with a strict JSON prompt asking for:
//
//   { definition_id, pronunciation_ipa, pronunciation_id_hint,
//     example_sentence_en, example_sentence_id, common_mistake_note_id }
//
// The response is parsed as JSON. Rows that fail JSON parse or fail plausibility
// checks are inserted with flagged_for_review=true so admin can rescue them.
// Rows that parse cleanly get confidence 80-95 based on completeness of fields.
//
// Doctrine anchors:
//   · project_nex_translation_and_learning_vision_2026_08_28.md
//     (seventh subsystem · world-class English teacher for Indonesian learners)
//   · project_nex_free_infrastructure_principle_2026_08_27.md ($0 · local only)
//   · ADR-0028 (never fabricate · flag when uncertain · confidence bands)
//   · ADR-0033 (brain isolation · this writes ONLY to English brain)
//
// Usage:
//   node scripts/nex-ollama/seed-english-vocab.mjs --limit=5 --dry
//   node scripts/nex-ollama/seed-english-vocab.mjs --limit=20
//
// Cost: $0. Runs on your laptop's Ollama.

import pg from "pg";
import { readFileSync } from "node:fs";
import { generate, health, MODELS } from "./_client.mjs";

const args = new Map();
for (const a of process.argv.slice(2)) {
  const [k, v] = a.split("=");
  args.set(k.replace(/^--/, ""), v ?? true);
}
const LIMIT = Number(args.get("limit") ?? 5);
const DRY = args.has("dry");
const MODEL = String(args.get("model") ?? MODELS.translate);

const pool = new pg.Pool({
  connectionString:
    process.env.NEX_POSTGRES_URL ??
    "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 2,
});

const SEED = JSON.parse(readFileSync("data/nex-english-vocab-seed-v1.json", "utf8"));
const LICENCE = SEED.provenance.licence_terms;

const SYSTEM_PROMPT = `You are a professional English teacher fluent in Bahasa Indonesia. Your task is to produce world-class teaching material for Indonesian learners of English. You reply with STRICTLY valid JSON only, no prose before or after, no code fences.`;

function buildPrompt(word, pos, cefr) {
  return `English word: "${word}"
Part of speech: ${pos}
CEFR level: ${cefr}

Produce a JSON object with these EXACT keys and value types:
{
  "definition_id": "1-3 word Indonesian gloss for this specific meaning",
  "pronunciation_ipa": "IPA transcription in slashes, e.g. /wɜːd/",
  "pronunciation_id_hint": "phonetic hint using Indonesian sound patterns, e.g. 'wərd'",
  "example_sentence_en": "one natural sentence using the word",
  "example_sentence_id": "faithful Indonesian translation of the example",
  "common_mistake_note_id": "one sentence in Indonesian describing a mistake Indonesian speakers commonly make with this word"
}

Reply with ONLY the JSON object. No markdown. No explanation. No trailing text.`;
}

async function main() {
  const h = await health();
  if (!h.models.includes(MODEL)) {
    console.error(`model ${MODEL} not installed · available: ${h.models.join(", ")}`);
    process.exit(2);
  }
  console.log(
    `ok · ollama online · model=${MODEL} · dry=${DRY} · limit=${LIMIT} · seed_size=${SEED.words.length}`,
  );

  const client = await pool.connect();
  let ok = 0;
  let flagged = 0;
  let skipped = 0;
  let fail = 0;

  try {
    let processed = 0;
    for (const entry of SEED.words) {
      if (processed >= LIMIT) break;
      const wordNorm = entry.word.toLowerCase().trim();

      const { rows: existing } = await client.query(
        `SELECT 1 FROM nex.brain_english_vocabulary
         WHERE word_normalised = $1 AND part_of_speech = $2`,
        [wordNorm, entry.part_of_speech],
      );
      if (existing.length > 0) {
        skipped += 1;
        continue;
      }

      processed += 1;
      const started = Date.now();
      try {
        const prompt = buildPrompt(entry.word, entry.part_of_speech, entry.cefr);
        const { text: raw } = await generate({
          model: MODEL,
          system: SYSTEM_PROMPT,
          prompt,
          temperature: 0.2,
          num_predict: 400,
        });

        const parsed = safeParseJson(raw);
        if (!parsed) {
          console.log(`  fail-parse · ${entry.word} · raw=${raw.slice(0, 100)}...`);
          fail += 1;
          continue;
        }

        const { confidence, flag, reasons } = scoreEntry(parsed, entry);
        const totalMs = Date.now() - started;

        if (DRY) {
          console.log(
            `  DRY · ${entry.word} · ${totalMs}ms · conf=${confidence} · flag=${flag} · gloss="${parsed.definition_id}"`,
          );
          if (flag) flagged += 1;
          else ok += 1;
          continue;
        }

        await client.query(
          `
          INSERT INTO nex.brain_english_vocabulary (
            word, word_normalised, part_of_speech, cefr_level,
            definition_en, definition_id,
            pronunciation_ipa, pronunciation_id_hint,
            example_sentence_en, example_sentence_id,
            common_mistake_note_id,
            source, source_reference, source_licence_terms,
            created_by, confidence, flagged_for_review, tags
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6,
            $7, $8,
            $9, $10,
            $11,
            'ollama_qwen2.5_english_lesson',
            'data/nex-english-vocab-seed-v1.json',
            $12,
            'ollama_qwen2.5', $13, $14, $15
          )
          ON CONFLICT (word_normalised, part_of_speech) DO NOTHING
          `,
          [
            entry.word,
            wordNorm,
            entry.part_of_speech,
            entry.cefr,
            entry.word,
            parsed.definition_id,
            parsed.pronunciation_ipa,
            parsed.pronunciation_id_hint,
            parsed.example_sentence_en,
            parsed.example_sentence_id,
            parsed.common_mistake_note_id,
            LICENCE,
            confidence,
            flag,
            ["seed_v1", `cefr:${entry.cefr}`, ...(reasons.length ? ["auto_flagged"] : [])],
          ],
        );

        if (flag) {
          flagged += 1;
          console.log(
            `  flagged · ${entry.word} · ${totalMs}ms · conf=${confidence} · reasons=${reasons.join(",")}`,
          );
        } else {
          ok += 1;
          console.log(`  ok · ${entry.word} · ${totalMs}ms · conf=${confidence} · gloss="${parsed.definition_id}"`);
        }
      } catch (err) {
        fail += 1;
        console.error(`  fail · ${entry.word} · ${err.message}`);
      }
    }

    console.log(
      `\ndone · ok=${ok} · flagged=${flagged} · fail=${fail} · skipped=${skipped}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

function safeParseJson(text) {
  const t = text.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = t.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function scoreEntry(parsed, entry) {
  const reasons = [];
  let confidence = 95;
  const required = [
    "definition_id",
    "pronunciation_ipa",
    "pronunciation_id_hint",
    "example_sentence_en",
    "example_sentence_id",
    "common_mistake_note_id",
  ];
  for (const key of required) {
    if (!parsed[key] || typeof parsed[key] !== "string" || parsed[key].trim().length < 2) {
      confidence -= 15;
      reasons.push(`missing:${key}`);
    }
  }
  if (parsed.pronunciation_ipa && !/^\/.*\/$/.test(parsed.pronunciation_ipa.trim())) {
    confidence -= 5;
    reasons.push("ipa_not_slashed");
  }
  if (
    parsed.example_sentence_en &&
    !parsed.example_sentence_en.toLowerCase().includes(entry.word.toLowerCase())
  ) {
    confidence -= 10;
    reasons.push("example_missing_word");
  }
  return {
    confidence: Math.max(20, confidence),
    flag: confidence < 85,
    reasons,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
