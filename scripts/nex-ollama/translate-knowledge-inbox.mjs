#!/usr/bin/env node
// scripts/nex-ollama/translate-knowledge-inbox.mjs
//
// NEX Ollama Translation Pipeline · Philip 2026-08-28.
//
// Reads nex.knowledge_inbox rows written by the English Wikipedia walker
// (source='wikipedia_en'). For each row that has NO Indonesian counterpart
// (neither a wikipedia_id row nor a prior ollama translation), sends the title
// and preview_text through the local Ollama server and writes the Bahasa
// Indonesia translation back as a new knowledge_inbox row with:
//
//   source = 'ollama_qwen2.5_id_translation'
//   id     = 'indonesia/<topic_key>/ollama_qwen2.5_id_translation'
//
// Provenance is preserved in extraction_result:
//   { translated_from_source, translated_from_id, model, latency_ms, confidence_band }
//
// Doctrine anchors:
//   · project_nex_translation_and_learning_vision_2026_08_28.md
//   · project_nex_free_infrastructure_principle_2026_08_27.md
//   · project_nex_brain_indonesia_knowledge_walkers_doctrine_2026_08_27.md
//     (never guess · cite source · confidence bands · truth_class preserved)
//
// Usage:
//   node scripts/nex-ollama/translate-knowledge-inbox.mjs --limit=5
//   node scripts/nex-ollama/translate-knowledge-inbox.mjs --limit=20 --dry
//
// Cost: $0 · runs entirely on local Ollama.

import pg from "pg";
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

const SYSTEM_PROMPT = `You are a professional Indonesian translator. Translate the given English text into natural, fluent Bahasa Indonesia. Preserve every fact, name, date, and proper noun exactly. Do not add commentary, do not summarise, do not omit sentences. Reply with ONLY the Indonesian translation, nothing else.`;

async function main() {
  const h = await health();
  if (!h.models.includes(MODEL)) {
    console.error(`model ${MODEL} not installed · available: ${h.models.join(", ")}`);
    process.exit(2);
  }
  console.log(`ok · ollama online · model=${MODEL} · dry=${DRY} · limit=${LIMIT}`);

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `
      SELECT k.id, k.topic_key, k.title, k.preview_text, k.truth_class, k.brain_slug
      FROM nex.knowledge_inbox k
      WHERE k.brain_slug = 'indonesia'
        AND k.source = 'wikipedia_en'
        AND k.preview_text IS NOT NULL
        AND LENGTH(k.preview_text) >= 40
        AND NOT EXISTS (
          SELECT 1 FROM nex.knowledge_inbox k2
          WHERE k2.brain_slug = 'indonesia'
            AND k2.topic_key = k.topic_key
            AND k2.source IN ('wikipedia_id', 'ollama_qwen2.5_id_translation')
        )
      ORDER BY k.created_at_iso ASC
      LIMIT $1
      `,
      [LIMIT],
    );

    console.log(`candidates: ${rows.length}`);

    let ok = 0;
    let fail = 0;

    for (const row of rows) {
      const started = Date.now();
      try {
        const titleOut = await translate(row.title);
        const bodyOut = await translate(row.preview_text);
        const totalMs = Date.now() - started;

        const confidence_band = classifyConfidence(bodyOut, row.preview_text);

        if (DRY) {
          console.log(
            `  DRY · ${row.topic_key} · ${totalMs}ms · title="${titleOut.slice(0, 60)}..." · band=${confidence_band}`,
          );
          ok += 1;
          continue;
        }

        const newId = `indonesia/${row.topic_key}/ollama_qwen2.5_id_translation`;
        const nowMs = Date.now();
        const nowIso = new Date().toISOString();
        const meta = {
          translated_from_source: "wikipedia_en",
          translated_from_id: row.id,
          model: MODEL,
          model_provider: "ollama_local",
          latency_ms: totalMs,
          confidence_band,
          translation_pipeline: "translate-knowledge-inbox.mjs",
          translated_at_iso: nowIso,
          licence_terms:
            "Translation derived from Wikipedia (CC BY-SA 4.0) · translation itself CC BY-SA 4.0 · source attribution preserved",
        };

        await client.query(
          `
          INSERT INTO nex.knowledge_inbox (
            id, title, kind, status, source, hash,
            created_at_ms, created_at_iso, preview_text,
            truth_class, brain_slug, topic_key,
            extraction_result, description
          ) VALUES (
            $1, $2, 'url', 'shadow', 'ollama_qwen2.5_id_translation', $3,
            $4, $5, $6,
            $7, 'indonesia', $8,
            $9::jsonb, $10
          )
          ON CONFLICT (id) DO UPDATE SET
            preview_text = EXCLUDED.preview_text,
            title = EXCLUDED.title,
            extraction_result = EXCLUDED.extraction_result,
            shadow_updated_at = now()
          `,
          [
            newId,
            titleOut,
            hashOf(newId + bodyOut),
            nowMs,
            nowIso,
            bodyOut,
            row.truth_class,
            row.topic_key,
            JSON.stringify(meta),
            `ID translation of ${row.title} (via ${MODEL})`,
          ],
        );

        console.log(
          `  ok · ${row.topic_key} · ${totalMs}ms · band=${confidence_band} · ${bodyOut.length}ch`,
        );
        ok += 1;
      } catch (err) {
        console.error(`  fail · ${row.topic_key} · ${err.message}`);
        fail += 1;
      }
    }

    console.log(`\ndone · ok=${ok} · fail=${fail} · total=${rows.length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function translate(text) {
  const { text: out } = await generate({
    model: MODEL,
    system: SYSTEM_PROMPT,
    prompt: text,
    temperature: 0.15,
    num_predict: Math.max(256, Math.min(1024, Math.ceil(text.length * 1.4))),
  });
  return out.replace(/^["'`]+|["'`]+$/g, "").trim();
}

function classifyConfidence(translated, original) {
  const lenRatio = translated.length / Math.max(1, original.length);
  if (lenRatio < 0.5 || lenRatio > 2.2) return "flag_for_review";
  if (translated.length < 30) return "flag_for_review";
  if (/^(sorry|i cannot|as an ai|note:)/i.test(translated)) return "flag_for_review";
  return lenRatio > 0.7 && lenRatio < 1.6 ? "high" : "good";
}

function hashOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `oll_${(h >>> 0).toString(16)}_${s.length}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
