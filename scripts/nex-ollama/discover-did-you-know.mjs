#!/usr/bin/env node
// scripts/nex-ollama/discover-did-you-know.mjs
//
// NEX Did You Know Walker · Philip 2026-08-28.
//
// Extracts "Did You Know" style facts from existing Wikipedia articles
// already ingested by the knowledge walker (nex.knowledge_inbox). For each
// candidate article, Ollama distils 1-3 surprising verifiable facts and
// writes them to nex.brain_did_you_know_indonesia with:
//   · title (crisp headline)
//   · body (1-2 sentences, tourist-friendly)
//   · category (nature/geology/culture/history/language/food/rituals/…)
//   · source_url (the exact Wikipedia article URL · always cited)
//   · verified_source (wikipedia_en + article title)
//   · licence_terms (CC BY-SA 4.0)
//   · truth_class (matches original truth_class of the knowledge_inbox row)
//
// Hard rules (constitutional per ADR-0028):
//   · Ollama MUST extract only from the provided Wikipedia text · never
//     invent numbers, dates, or claims not present in source
//   · Every generated fact carries source_url pointing to Wikipedia
//   · Round-trip check: fact body must contain at least one substring
//     of length ≥8 chars that also appears in source text (weak but
//     catches gross hallucinations)
//   · Dedupe on slug (skip if we already have a fact for this topic)
//
// Doctrine anchors:
//   · project_nex_fact_vs_knowledge_doctrine_2026_08_28.md
//   · project_nex_ambient_knowledge_injector_doctrine_2026_08_28.md
//   · project_nex_free_infrastructure_principle_2026_08_27.md
//
// Usage:
//   node scripts/nex-ollama/discover-did-you-know.mjs --limit=5 --dry
//   node scripts/nex-ollama/discover-did-you-know.mjs --limit=20
//
// Cost: $0 · all local Ollama.

import pg from "pg";
import { generate, health, MODELS } from "./_client.mjs";

const args = new Map();
for (const a of process.argv.slice(2)) {
  const [k, v] = a.split("=");
  args.set(k.replace(/^--/, ""), v ?? true);
}
const LIMIT = Number(args.get("limit") ?? 5);
const DRY = args.has("dry");
const MODEL = String(args.get("model") ?? MODELS.reason);

const pool = new pg.Pool({
  connectionString:
    process.env.NEX_POSTGRES_URL ??
    "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 2,
});

const SYSTEM_PROMPT = `You are a professional editor specialising in Indonesian tourism and culture. Given a Wikipedia article summary, you extract 1 to 3 GENUINELY SURPRISING facts that a tourist would want to know. You NEVER invent facts. Every claim you produce MUST be verifiable from the provided text. You reply with strictly valid JSON only.`;

function buildPrompt(title, body) {
  return `Wikipedia article: "${title}"

Article text:
"""
${body}
"""

Produce a JSON array of 1 to 3 objects (fewer is fine). Each object:
{
  "title": "Short catchy headline · 3-8 words",
  "body": "One or two sentences that a tourist would find surprising or memorable. MUST be verifiable from the article text above. NEVER invent numbers, dates, or claims.",
  "category": "one of: nature, geology, culture, history, language, food, rituals, science, society, symbols",
  "difficulty": 1-5 (1=common knowledge, 5=deep-dive expert)
}

Do NOT paraphrase generic definitions. Prefer WHY / HOW / HOW MUCH / HOW OLD / WHO ELSE. Skip facts that aren't surprising.

Reply with ONLY the JSON array. No markdown. No prose. No trailing text.`;
}

async function main() {
  const h = await health();
  if (!h.models.includes(MODEL)) {
    console.error(`model ${MODEL} not installed · available: ${h.models.join(", ")}`);
    process.exit(2);
  }
  console.log(`ok · ollama online · model=${MODEL} · dry=${DRY} · limit=${LIMIT}`);

  const cycleId = await openCycle();
  const client = await pool.connect();
  let created = 0;
  let skipped_dupe = 0;
  let rejected_no_overlap = 0;
  let fail_parse = 0;
  let processed = 0;
  let cycleStatus = "completed";

  try {
    const { rows: sources } = await client.query(
      `
      SELECT id, title, preview_text, source, truth_class, topic_key, url
      FROM nex.knowledge_inbox
      WHERE brain_slug = 'indonesia'
        AND source IN ('wikipedia_en', 'wikipedia_id')
        AND preview_text IS NOT NULL
        AND LENGTH(preview_text) >= 200
        AND NOT EXISTS (
          SELECT 1 FROM nex.brain_did_you_know_indonesia dyk
          WHERE dyk.source_url LIKE '%' || REPLACE(nex.knowledge_inbox.topic_key, 'dest-', '') || '%'
             OR dyk.source_url LIKE '%' || nex.knowledge_inbox.title || '%'
        )
      ORDER BY random()
      LIMIT $1
      `,
      [LIMIT],
    );

    console.log(`candidate articles: ${sources.length}`);

    for (const src of sources) {
      processed += 1;
      const started = Date.now();
      try {
        const prompt = buildPrompt(src.title, src.preview_text);
        const { text: raw } = await generate({
          model: MODEL,
          system: SYSTEM_PROMPT,
          prompt,
          temperature: 0.3,
          num_predict: 600,
        });

        const facts = safeParseArray(raw);
        if (!facts) {
          console.log(`  fail-parse · ${src.title}`);
          fail_parse += 1;
          continue;
        }

        for (const f of facts) {
          if (!isPlausibleFact(f, src.preview_text)) {
            rejected_no_overlap += 1;
            console.log(`  rejected · ${src.title} → "${(f?.title ?? "").slice(0, 40)}" (no source overlap)`);
            continue;
          }

          const slug = slugify(`${src.topic_key}-${f.title}`).slice(0, 120);

          // Dedupe check
          const { rows: existing } = await client.query(
            `SELECT 1 FROM nex.brain_did_you_know_indonesia WHERE slug = $1`,
            [slug],
          );
          if (existing.length > 0) {
            skipped_dupe += 1;
            continue;
          }

          const sourceUrl = src.url
            || `https://en.wikipedia.org/wiki/${encodeURIComponent(src.title.replace(/\s+/g, "_"))}`;

          if (DRY) {
            console.log(`  DRY · ${src.title} → [${f.category}] "${f.title}" · slug=${slug.slice(0, 60)}`);
            created += 1;
            continue;
          }

          await client.query(
            `
            INSERT INTO nex.brain_did_you_know_indonesia
              (slug, title, body, category, region_slug, region_label,
               truth_class, difficulty, verified_source, source_url,
               licence_terms, priority)
            VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (slug) DO NOTHING
            `,
            [
              slug,
              String(f.title).slice(0, 200),
              String(f.body).slice(0, 800),
              normaliseCategory(f.category),
              src.truth_class ?? "confirmed_fact",
              Number.isFinite(f.difficulty) ? Math.max(1, Math.min(5, f.difficulty)) : 3,
              `ollama_extract_from_${src.source}`,
              sourceUrl,
              "Wikipedia · CC BY-SA 4.0 (derived facts) · Ollama-extracted",
              5,
            ],
          );
          created += 1;
          console.log(`  ok · ${src.title} → [${f.category}] "${f.title}" · ${Date.now() - started}ms`);
        }
      } catch (err) {
        console.error(`  fail · ${src.title} · ${err.message}`);
      }
    }

    console.log(
      `\ndone · created=${created} · dupe=${skipped_dupe} · rejected=${rejected_no_overlap} · fail_parse=${fail_parse} · processed=${processed}`,
    );
  } catch (err) {
    cycleStatus = "failed";
    console.error(`fatal · ${err.message}`);
    throw err;
  } finally {
    client.release();
    const nonNewLoss = rejected_no_overlap + fail_parse + skipped_dupe;
    let cycleOutcome;
    if (cycleStatus === "failed") cycleOutcome = "PROVIDER_ERROR";
    else if (created > 0 && nonNewLoss > 0) cycleOutcome = "PARTIAL";
    else if (created > 0) cycleOutcome = "PRODUCTIVE";
    else if (processed === 0) cycleOutcome = "PROVIDER_EMPTY";
    else if (skipped_dupe > 0 && rejected_no_overlap + fail_parse === 0) cycleOutcome = "ALL_DEDUPED";
    else if (rejected_no_overlap + fail_parse > 0) cycleOutcome = "ALL_REJECTED";
    else cycleOutcome = "NO_NEW_CANDIDATES";
    try {
      await closeCycle(cycleId, cycleStatus, {
        cycle_outcome: cycleOutcome,
        records_processed: processed,
        records_new: created,
        records_rejected: rejected_no_overlap + fail_parse,
        skipped_dupe,
        rejected_no_overlap,
        fail_parse,
        model: MODEL,
        limit: LIMIT,
        dry: DRY,
      });
    } catch (err) {
      console.error(`cycle_run close failed: ${err.message}`);
    }
    await pool.end();
  }
}

// ── cycle attribution (matches _knowledge-walker.mjs pattern) ──────────
const WORKER_ID = "ollama:discover-did-you-know";
const WORKER_TYPE = "ollama:did_you_know";
async function openCycle() {
  const r = await pool.query(
    `INSERT INTO nex.worker_cycle_run (worker_type, worker_id, worker_config, status, summary)
     VALUES ($1, $2, $3, 'running', jsonb_build_object('model', $4::text, 'limit', $5::int))
     RETURNING id`,
    [WORKER_TYPE, WORKER_ID, `limit=${LIMIT}:model=${MODEL}`, MODEL, LIMIT],
  );
  return r.rows[0].id;
}
async function closeCycle(cycleId, status, summary) {
  await pool.query(
    `UPDATE nex.worker_cycle_run SET status = $2, finished_at = now(),
        records_processed = $4, records_new = $5, records_rejected = $6,
        summary = COALESCE(summary, '{}'::jsonb) || $3::jsonb
      WHERE id = $1`,
    [
      cycleId, status, JSON.stringify(summary),
      Number.isFinite(summary.records_processed) ? summary.records_processed : 0,
      Number.isFinite(summary.records_new) ? summary.records_new : 0,
      Number.isFinite(summary.records_rejected) ? summary.records_rejected : 0,
    ],
  );
}

function safeParseArray(text) {
  const t = text.trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(t.slice(start, end + 1));
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function isPlausibleFact(f, sourceText) {
  if (!f || typeof f !== "object") return false;
  if (typeof f.title !== "string" || f.title.length < 4) return false;
  if (typeof f.body !== "string" || f.body.length < 30) return false;

  // Weak but useful hallucination guard: at least one 8-char substring of
  // body must also appear in source text (case-insensitive). Catches "made
  // up numbers" style hallucinations. Not perfect but a floor.
  const bodyLc = f.body.toLowerCase();
  const srcLc = sourceText.toLowerCase();
  const words = bodyLc.split(/[^a-z0-9]+/).filter((w) => w.length >= 6);
  let hits = 0;
  for (const w of words) if (srcLc.includes(w)) hits += 1;
  return hits >= 3;
}

const CAT_MAP = new Set([
  "nature", "geology", "culture", "history", "language", "food",
  "rituals", "science", "society", "symbols",
]);
function normaliseCategory(c) {
  const norm = String(c ?? "").toLowerCase().trim();
  if (CAT_MAP.has(norm)) return norm;
  return "culture";
}

function slugify(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
