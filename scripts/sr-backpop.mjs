#!/usr/bin/env node
// scripts/sr-backpop.mjs
//
// Founder BEGIN Phase 3.4B · Semantic index backpop.
//
// Reads nex.entity_index + top-N answered nex.question_variant rows,
// embeds them with the configured provider (default: deterministic
// token hashing), UPSERTs into nex.semantic_entity_index +
// nex.semantic_question_index.
//
// Idempotent · re-runnable · resumable.
//
// Usage:
//   node --env-file=.env.local scripts/sr-backpop.mjs
//     [SR_ENTITY_LIMIT=1500] [SR_QUESTION_LIMIT=2000]
//   NEX_EMBEDDING_PROVIDER=ollama (optional) NEX_OLLAMA_EMBED_MODEL=nomic-embed-text
//
// Prints per-batch counts + final index size.

import pg from "pg";
import { makeDefaultEmbeddingProvider } from "../src/lib/nex/live-chat-completion/semantic/embedding-provider.ts";

const url = process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("NEX_TAXONOMY_POSTGRES_URL missing"); process.exit(1); }
const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });

const provider = makeDefaultEmbeddingProvider();
console.log(`provider: ${provider.model_id} · dim(default)=${provider.dim}`);

const DOMAIN = "accommodation";
const ENTITY_LIMIT = Number(process.env.SR_ENTITY_LIMIT ?? 1500);
const QUESTION_LIMIT = Number(process.env.SR_QUESTION_LIMIT ?? 2000);
const BATCH = 200;

async function backpopEntities() {
  const t0 = Date.now();
  // Skip entities that already have a vector under this model.
  const rows = await pool.query(
    `SELECT ei.entity_ref, ei.canonical_name, ei.aliases, ei.city
       FROM nex.entity_index ei
       WHERE ei.domain = $1
         AND NOT EXISTS (
           SELECT 1 FROM nex.semantic_entity_index sei
           WHERE sei.domain = ei.domain
             AND sei.entity_ref = ei.entity_ref
             AND sei.embedding_model = $2
         )
       ORDER BY ei.entity_ref ASC
       LIMIT $3`,
    [DOMAIN, provider.model_id, ENTITY_LIMIT],
  );
  console.log(`entities to embed: ${rows.rowCount}`);
  if (rows.rowCount === 0) return { embedded: 0, ms: Date.now() - t0 };
  let embedded = 0;
  for (let i = 0; i < rows.rows.length; i += BATCH) {
    const chunk = rows.rows.slice(i, i + BATCH);
    const texts = chunk.map((r) => {
      const parts = [String(r.canonical_name ?? "")];
      if (Array.isArray(r.aliases) && r.aliases.length > 0) parts.push(...r.aliases.map(String));
      if (r.city) parts.push(String(r.city));
      return parts.join(" · ").trim();
    });
    const vecs = provider.embedBatch
      ? await provider.embedBatch(texts)
      : await Promise.all(texts.map((t) => provider.embed(t)));
    // UPSERT batch.
    const values = [];
    const params = [];
    let p = 1;
    for (let j = 0; j < chunk.length; j++) {
      const vec = vecs[j];
      values.push(`($${p++}, $${p++}, $${p++}, $${p++}::jsonb, $${p++}, $${p++})`);
      params.push(String(chunk[j].entity_ref), DOMAIN, provider.model_id, JSON.stringify(vec), vec.length, texts[j]);
    }
    await pool.query(
      `INSERT INTO nex.semantic_entity_index
         (entity_ref, domain, embedding_model, embedding, dim, source_text)
       VALUES ${values.join(",")}
       ON CONFLICT (domain, entity_ref, embedding_model) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         dim = EXCLUDED.dim,
         source_text = EXCLUDED.source_text,
         updated_at = now()`,
      params,
    );
    embedded += chunk.length;
    process.stdout.write(`  entities embedded: ${embedded}/${rows.rowCount}\r`);
  }
  process.stdout.write("\n");
  return { embedded, ms: Date.now() - t0 };
}

async function backpopQuestions() {
  const t0 = Date.now();
  const rows = await pool.query(
    `SELECT qv.fingerprint, qv.entity_ref, qv.intent_slug, qv.normalised_text
       FROM nex.question_variant qv
       WHERE qv.domain = $1
         AND qv.answer_status IN ('answered', 'partially_answered', 'unknown')
         AND NOT EXISTS (
           SELECT 1 FROM nex.semantic_question_index sqi
           WHERE sqi.fingerprint = qv.fingerprint
             AND sqi.embedding_model = $2
         )
       ORDER BY qv.updated_at DESC NULLS LAST
       LIMIT $3`,
    [DOMAIN, provider.model_id, QUESTION_LIMIT],
  );
  console.log(`questions to embed: ${rows.rowCount}`);
  if (rows.rowCount === 0) return { embedded: 0, ms: Date.now() - t0 };
  let embedded = 0;
  for (let i = 0; i < rows.rows.length; i += BATCH) {
    const chunk = rows.rows.slice(i, i + BATCH);
    const texts = chunk.map((r) => String(r.normalised_text));
    const vecs = provider.embedBatch
      ? await provider.embedBatch(texts)
      : await Promise.all(texts.map((t) => provider.embed(t)));
    const values = [];
    const params = [];
    let p = 1;
    for (let j = 0; j < chunk.length; j++) {
      const vec = vecs[j];
      values.push(`($${p++}, $${p++}, $${p++}, $${p++}::jsonb, $${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(
        String(chunk[j].fingerprint), DOMAIN, provider.model_id,
        JSON.stringify(vec), vec.length, texts[j],
        chunk[j].entity_ref ? String(chunk[j].entity_ref) : null,
        chunk[j].intent_slug ? String(chunk[j].intent_slug) : null,
      );
    }
    await pool.query(
      `INSERT INTO nex.semantic_question_index
         (fingerprint, domain, embedding_model, embedding, dim, source_text, entity_ref, intent_slug)
       VALUES ${values.join(",")}
       ON CONFLICT (fingerprint, embedding_model) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         dim = EXCLUDED.dim,
         source_text = EXCLUDED.source_text,
         entity_ref = EXCLUDED.entity_ref,
         intent_slug = EXCLUDED.intent_slug,
         updated_at = now()`,
      params,
    );
    embedded += chunk.length;
    process.stdout.write(`  questions embedded: ${embedded}/${rows.rowCount}\r`);
  }
  process.stdout.write("\n");
  return { embedded, ms: Date.now() - t0 };
}

const e = await backpopEntities();
console.log(`entities · embedded=${e.embedded} in ${e.ms}ms`);
const q = await backpopQuestions();
console.log(`questions · embedded=${q.embedded} in ${q.ms}ms`);

const idx = await pool.query(
  `SELECT
     (SELECT COUNT(*) FROM nex.semantic_entity_index WHERE domain='accommodation') AS entities,
     (SELECT COUNT(*) FROM nex.semantic_question_index WHERE domain='accommodation') AS questions`
);
console.log(`\nfinal index size · entities=${idx.rows[0].entities} · questions=${idx.rows[0].questions}`);

await pool.end();
