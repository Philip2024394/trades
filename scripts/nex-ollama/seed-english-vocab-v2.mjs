#!/usr/bin/env node
// scripts/nex-ollama/seed-english-vocab-v2.mjs
//
// NEX English-Teaching Brain · Vocab Seeder v2 · Philip 2026-08-28.
//
// Three-layer automated QA (NO admin review · impossible at scale per
// Philip 2026-08-28):
//   Layer 1 · Ground-truth corpus lookup     → NEX FACT if hit
//   Layer 2 · Ollama LLM translation         → candidate answer
//   Layer 3 · Round-trip back-translation    → NEX FACT if meaning preserved
//                                              NEX KNOWLEDGE if diverged
//
// Every row written to nex.brain_english_vocabulary carries:
//   · truth_class-equivalent tag (via source field + tags[])
//   · confidence 0-100 (higher for Layer 1 hits · lower for Layer 3 rescues)
//   · flagged_for_review = true ONLY if Layer 3 round-trip failed hard
//
// Doctrine anchors:
//   · project_nex_fact_vs_knowledge_doctrine_2026_08_28.md
//   · project_nex_translation_and_learning_vision_2026_08_28.md
//   · project_nex_free_infrastructure_principle_2026_08_27.md
//   · ADR-0028 (never fabricate · confidence bands)
//
// Usage:
//   node scripts/nex-ollama/seed-english-vocab-v2.mjs --limit=10 --dry
//   node scripts/nex-ollama/seed-english-vocab-v2.mjs --limit=50

import pg from "pg";
import { readFileSync } from "node:fs";
import { generate, health, MODELS } from "./_client.mjs";
import { lookup as corpusLookup, size as corpusSize } from "./_corpus.mjs";

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

async function main() {
  const h = await health();
  if (!h.models.includes(MODEL)) {
    console.error(`model ${MODEL} not installed · available: ${h.models.join(", ")}`);
    process.exit(2);
  }
  console.log(
    `ok · ollama online · model=${MODEL} · dry=${DRY} · limit=${LIMIT} · corpus=${corpusSize()} · seed=${SEED.words.length}`,
  );

  const client = await pool.connect();
  let l1_hits = 0;
  let l2_ok = 0;
  let l3_flagged = 0;
  let fail = 0;
  let skipped = 0;

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

      // ── Layer 1: corpus lookup ─────────────────────────────────────
      const l1 = corpusLookup(entry.word);
      if (l1) {
        const confidence = 95;
        const badge = "NEX FACT";
        const layerLabel = "L1_corpus";

        if (DRY) {
          console.log(
            `  [${badge}] · ${entry.word} → ${l1.id} · ${layerLabel} · ${Date.now()-started}ms · conf=${confidence}`,
          );
          l1_hits += 1;
          continue;
        }

        await insertVocab(client, entry, {
          definition_id: l1.id,
          pronunciation_ipa: null,
          pronunciation_id_hint: null,
          example_sentence_en: null,
          example_sentence_id: null,
          common_mistake_note_id: l1.note ?? null,
          source: "hand_curated_ground_truth_v1",
          licence: l1.licence_terms,
          created_by: "corpus_layer1",
          confidence,
          flag: false,
          tags: ["seed_v1", `cefr:${entry.cefr}`, "layer_1_corpus", "NEX_FACT",
            ...(l1.alternates?.length ? [`alt:${l1.alternates.join("|")}`] : [])],
        });
        console.log(`  [${badge}] · ${entry.word} → ${l1.id} · L1_corpus · conf=${confidence}`);
        l1_hits += 1;
        continue;
      }

      // ── Layer 2: Ollama translation ────────────────────────────────
      try {
        const l2Text = await ollamaTranslate(entry.word, "en", "id");

        // ── Layer 3: round-trip validation ───────────────────────────
        const l3Back = await ollamaTranslate(l2Text, "id", "en");
        const roundTripOk = looseMatch(l3Back, entry.word);

        const totalMs = Date.now() - started;

        if (roundTripOk) {
          const confidence = 85;
          const badge = "NEX FACT";
          if (DRY) {
            console.log(
              `  [${badge}] · ${entry.word} → ${l2Text} ⇄ ${l3Back} · L3_roundtrip_ok · ${totalMs}ms · conf=${confidence}`,
            );
            l2_ok += 1;
            continue;
          }
          await insertVocab(client, entry, {
            definition_id: l2Text,
            pronunciation_ipa: null,
            pronunciation_id_hint: null,
            example_sentence_en: null,
            example_sentence_id: null,
            common_mistake_note_id: `Round-trip verified: ${entry.word} → ${l2Text} → ${l3Back}`,
            source: "ollama_qwen2.5_english_lesson",
            licence: "Ollama Qwen2.5 output · derived from public model weights · CC BY-SA 4.0 attribution kept",
            created_by: "ollama_layer2_verified_layer3",
            confidence,
            flag: false,
            tags: ["seed_v1", `cefr:${entry.cefr}`, "layer_2_ollama", "layer_3_roundtrip_ok", "NEX_FACT"],
          });
          console.log(`  [${badge}] · ${entry.word} → ${l2Text} ⇄ ${l3Back} · roundtrip_ok · conf=${confidence}`);
          l2_ok += 1;
        } else {
          // Round-trip failed → still store as NEX KNOWLEDGE, flagged
          const confidence = 45;
          const badge = "NEX KNOWLEDGE";
          if (DRY) {
            console.log(
              `  [${badge}] · ${entry.word} → ${l2Text} ⇄ ${l3Back} ≠ orig · L3_flagged · ${totalMs}ms · conf=${confidence}`,
            );
            l3_flagged += 1;
            continue;
          }
          await insertVocab(client, entry, {
            definition_id: l2Text,
            pronunciation_ipa: null,
            pronunciation_id_hint: null,
            example_sentence_en: null,
            example_sentence_id: null,
            common_mistake_note_id: `AI-generated; round-trip diverged: ${entry.word} → ${l2Text} → ${l3Back}`,
            source: "ollama_qwen2.5_english_lesson",
            licence: "Ollama Qwen2.5 output · uncertified translation · flagged for future review",
            created_by: "ollama_layer2_flagged_layer3",
            confidence,
            flag: true,
            tags: ["seed_v1", `cefr:${entry.cefr}`, "layer_2_ollama", "layer_3_roundtrip_failed", "NEX_KNOWLEDGE", "auto_flagged"],
          });
          console.log(`  [${badge}] · ${entry.word} → ${l2Text} ⇄ ${l3Back} ≠ orig · flagged · conf=${confidence}`);
          l3_flagged += 1;
        }
      } catch (err) {
        fail += 1;
        console.error(`  fail · ${entry.word} · ${err.message}`);
      }
    }

    console.log(
      `\ndone · L1=${l1_hits} (NEX FACT) · L2+L3ok=${l2_ok} (NEX FACT) · L3_flagged=${l3_flagged} (NEX KNOWLEDGE) · fail=${fail} · skipped=${skipped}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

async function ollamaTranslate(text, fromLang, toLang) {
  const langs = { en: "English", id: "Bahasa Indonesia" };
  const system = `You are a professional ${langs[fromLang]}↔${langs[toLang]} translator. Reply with ONLY the direct translation, no quotation marks, no explanation, no alternative options, no romanisation, no comment. If the input is a single word, reply with the single most common ${langs[toLang]} word for it.`;
  const { text: out } = await generate({
    model: MODEL,
    system,
    prompt: text,
    temperature: 0.1,
    num_predict: 60,
  });
  return out
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\(.*?\)/g, "")
    .split(/[,;\n]/)[0]
    .trim();
}

function looseMatch(a, b) {
  const normA = a.toLowerCase().replace(/[^\p{L}]/gu, "");
  const normB = b.toLowerCase().replace(/[^\p{L}]/gu, "");
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;
  // Levenshtein-ish tolerance: allow single-word differences under 3 chars
  const dist = editDistance(normA, normB);
  return dist <= Math.max(1, Math.floor(normB.length / 4));
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let now = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(now + 1, prev[j] + 1, prev[j - 1] + cost);
      prev[j - 1] = now;
      now = next;
    }
    prev[b.length] = now;
  }
  return prev[b.length];
}

async function insertVocab(client, entry, data) {
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
      $12, $13, $14,
      $15, $16, $17, $18
    )
    ON CONFLICT (word_normalised, part_of_speech) DO NOTHING
    `,
    [
      entry.word,
      entry.word.toLowerCase().trim(),
      entry.part_of_speech,
      entry.cefr,
      entry.word,
      data.definition_id,
      data.pronunciation_ipa,
      data.pronunciation_id_hint,
      data.example_sentence_en,
      data.example_sentence_id,
      data.common_mistake_note_id,
      data.source,
      "data/nex-english-vocab-seed-v1.json",
      data.licence,
      data.created_by,
      data.confidence,
      data.flag,
      data.tags,
    ],
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
