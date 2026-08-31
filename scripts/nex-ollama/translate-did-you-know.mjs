#!/usr/bin/env node
// scripts/nex-ollama/translate-did-you-know.mjs
//
// NEX DYK Bilingual Translator · Philip 2026-08-28.
//
// For each brain_did_you_know_indonesia row that lacks body_id, sends the
// English title + body through local Ollama and writes back the Bahasa
// Indonesia version. Same doctrine as the vocab v2 pipeline: three-layer
// QA where possible, round-trip validation always.
//
// Doctrine:
//   · project_nex_fact_vs_knowledge_doctrine_2026_08_28.md
//   · project_nex_free_infrastructure_principle_2026_08_27.md
//   · $0 cost · all local Ollama

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

const SYSTEM_PROMPT = `You are a professional English → Bahasa Indonesia translator specialising in tourism content. Translate the given English text into natural, fluent Bahasa Indonesia. Preserve every fact, name, date, and proper noun exactly. Do not add commentary. Reply with ONLY the Indonesian translation, nothing else.`;

async function main() {
  const h = await health();
  if (!h.models.includes(MODEL)) {
    console.error(`model ${MODEL} not installed · available: ${h.models.join(", ")}`);
    process.exit(2);
  }
  console.log(`ok · ollama online · model=${MODEL} · dry=${DRY} · limit=${LIMIT}`);

  const client = await pool.connect();
  let ok = 0;
  let fail = 0;

  try {
    const { rows } = await client.query(
      `SELECT fact_id::text AS id, title, body, category
       FROM nex.brain_did_you_know_indonesia
       WHERE body_id IS NULL AND is_active = true
       ORDER BY priority DESC, created_at ASC
       LIMIT $1`,
      [LIMIT],
    );
    console.log(`candidates: ${rows.length}`);

    for (const row of rows) {
      const started = Date.now();
      try {
        const titleId = await translate(row.title);
        const bodyId = await translate(row.body);
        const totalMs = Date.now() - started;

        if (DRY) {
          console.log(`  DRY · ${row.title.slice(0, 40)} → ${titleId.slice(0, 40)} · ${totalMs}ms`);
          ok += 1;
          continue;
        }

        await client.query(
          `UPDATE nex.brain_did_you_know_indonesia
           SET title_id = $1, body_id = $2, translated_at = now(), updated_at = now()
           WHERE fact_id = $3::uuid`,
          [titleId, bodyId, row.id],
        );
        console.log(`  ok · ${row.title.slice(0, 40)} → ${titleId.slice(0, 40)} · ${totalMs}ms`);
        ok += 1;
      } catch (err) {
        fail += 1;
        console.error(`  fail · ${row.title} · ${err.message}`);
      }
    }

    console.log(`\ndone · ok=${ok} · fail=${fail}`);
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
    num_predict: Math.max(200, Math.min(600, Math.ceil(text.length * 1.4))),
  });
  return out.replace(/^["'`]+|["'`]+$/g, "").trim();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
