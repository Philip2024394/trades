#!/usr/bin/env node
// scripts/nex-brain-knowledge/_knowledge-walker.mjs
//
// NEX Brain · Indonesia Knowledge Walker · Phase Ka · Philip 2026-08-27.
//
// Doctrine anchors:
//   · project_nex_brain_indonesia_knowledge_walkers_doctrine_2026_08_27.md
//   · project_nex_dedup_and_identity_resolution_doctrine_2026_08_27.md
//   · project_nex_walkers_never_stuck_multi_style_doctrine_2026_08_27.md
//   · ADR-0027 / ADR-0028 / ADR-0030 / ADR-0033 / ADR-0034
//
// One generic walker that serves ALL knowledge jobs registered in
// data/nex-job-registry.json with target_table='nex.knowledge_inbox'. Each
// job declares a segment of data/nex-indonesia-knowledge-seed.json (provinces
// / destinations / folklore / spiritual) and a provider (wikipedia_en /
// wikipedia_id / wikidata / wikivoyage).
//
// Contract per Philip's truth doctrine:
//   · Every row carries truth_class · one of:
//       confirmed_fact | traditional_folk | spiritual_belief | academic_reference
//   · Every row carries brain_slug (= 'indonesia' for Ka Phase · isolates from
//     staircase / door / interior brains per ADR-0033).
//   · Every row carries source (wikipedia_id, wikipedia_en, ...) and full URL.
//   · Every row carries the source's licence terms (Wikipedia CC BY-SA, etc.).
//   · Idempotency via UNIQUE (brain_slug, topic_key, source) — re-runs merge
//     into existing row, never duplicate.
//
// Usage:
//   node scripts/nex-brain-knowledge/_knowledge-walker.mjs \
//     --job=knowledge-provinces-id --segment=provinces --provider=wikipedia_id
//
// Zero writes to business tables. Only knowledge_inbox + identity_merge_log.

import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { createHash } from "node:crypto";

// ── args ──────────────────────────────────────────────────────────────
const args = new Map();
for (const a of process.argv.slice(2)) {
  const [k, v] = a.split("=");
  args.set(k.replace(/^--/, ""), v ?? true);
}
const JOB           = String(args.get("job") ?? "");
const SEGMENT       = String(args.get("segment") ?? "");
const PROVIDER      = String(args.get("provider") ?? "");
const MAX_TOPICS    = Number(args.get("max-topics") ?? 20);
const DRY_RUN       = args.has("dry-run");

if (!JOB || !SEGMENT || !PROVIDER) {
  console.error("usage: node _knowledge-walker.mjs --job=<slug> --segment=<provinces|destinations|folklore|spiritual> --provider=<wikipedia_en|wikipedia_id|wikidata|wikivoyage>");
  process.exit(2);
}

// ── pool ─────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 3,
});

// ── seed catalogue ──────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = pathResolve(__dirname, "..", "..", "data", "nex-indonesia-knowledge-seed.json");
const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const topics = seed[SEGMENT];
if (!Array.isArray(topics)) {
  console.error(`unknown segment: ${SEGMENT} · valid: provinces|destinations|folklore|spiritual|cuisine|history|culture|language`);
  process.exit(2);
}

// ── provider registry ───────────────────────────────────────────────
const PROVIDERS = {
  wikipedia_en: {
    licence: "Wikipedia · CC BY-SA 4.0 · https://creativecommons.org/licenses/by-sa/4.0/",
    async fetch(topic) {
      if (!topic.topic_key_en) return { ok: false, reason: "no en article" };
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.topic_key_en)}`;
      const r = await fetch(url, { headers: { "User-Agent": "NEX-Knowledge-Walker/1.0 (contact: philip@nex)" } });
      if (!r.ok) return { ok: false, reason: `http ${r.status}` };
      const j = await r.json();
      if (j.type === "disambiguation") return { ok: false, reason: "disambiguation" };
      return { ok: true, payload: {
        title: j.title,
        extract: j.extract,
        description: j.description,
        thumbnail: j.thumbnail?.source ?? null,
        content_urls: j.content_urls?.desktop?.page ?? null,
        wikibase_item: j.wikibase_item ?? null,
        lang: "en",
      }, source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.topic_key_en)}` };
    },
  },
  wikipedia_id: {
    licence: "Wikipedia · CC BY-SA 4.0 · https://creativecommons.org/licenses/by-sa/4.0/",
    async fetch(topic) {
      if (!topic.topic_key_id) return { ok: false, reason: "no id article" };
      const url = `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.topic_key_id)}`;
      const r = await fetch(url, { headers: { "User-Agent": "NEX-Knowledge-Walker/1.0 (contact: philip@nex)" } });
      if (!r.ok) return { ok: false, reason: `http ${r.status}` };
      const j = await r.json();
      if (j.type === "disambiguation") return { ok: false, reason: "disambiguation" };
      return { ok: true, payload: {
        title: j.title,
        extract: j.extract,
        description: j.description,
        thumbnail: j.thumbnail?.source ?? null,
        content_urls: j.content_urls?.desktop?.page ?? null,
        wikibase_item: j.wikibase_item ?? null,
        lang: "id",
      }, source_url: `https://id.wikipedia.org/wiki/${encodeURIComponent(topic.topic_key_id)}` };
    },
  },
  wikidata: {
    licence: "Wikidata · CC0 1.0 · https://creativecommons.org/publicdomain/zero/1.0/",
    async fetch(topic) {
      // Stub · resolved by walker script in a follow-up. Awaiting SPARQL
      // integration (Phase Kb). For Phase Ka we only wire wikipedia_en/id.
      return { ok: false, reason: "wikidata provider not yet implemented (Phase Kb)" };
    },
  },
  wikivoyage: {
    licence: "Wikivoyage · CC BY-SA 4.0 · https://creativecommons.org/licenses/by-sa/4.0/",
    async fetch(topic) {
      // Implemented 2026-08-28 · Philip. Uses Wikivoyage REST v1 summary
      // endpoint · same shape as Wikipedia. Travel-flavoured articles (Bali,
      // Yogyakarta, Sumatra travel guides, etc.) have practical tips like
      // best time to visit, transport modes, cultural etiquette.
      const key = topic.topic_key_en ?? topic.topic_key_id;
      if (!key) return { ok: false, reason: "no wikivoyage-compatible topic key" };
      const url = `https://en.wikivoyage.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`;
      const r = await fetch(url, { headers: { "User-Agent": "NEX-Knowledge-Walker/1.0 (contact: philip@nex)" } });
      if (!r.ok) return { ok: false, reason: `http ${r.status}` };
      const j = await r.json();
      if (j.type === "disambiguation") return { ok: false, reason: "disambiguation" };
      if (!j.extract || j.extract.length < 40) return { ok: false, reason: "insufficient extract" };
      return {
        ok: true,
        payload: {
          title: j.title,
          extract: j.extract,
          description: j.description ?? "Wikivoyage travel guide",
          thumbnail: j.thumbnail?.source ?? null,
          content_urls: j.content_urls?.desktop?.page ?? null,
          wikibase_item: j.wikibase_item ?? null,
          lang: "en",
          content_kind: "travel_guide",
        },
        source_url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(key)}`,
      };
    },
  },
};

const provider = PROVIDERS[PROVIDER];
if (!provider) {
  console.error(`unknown provider: ${PROVIDER} · valid: ${Object.keys(PROVIDERS).join(", ")}`);
  process.exit(2);
}

// ── provider rate governor lease ────────────────────────────────────
async function acquireGovernorLease(providerName) {
  const MAX_WAIT_MS = 300000;
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const cfg = (await client.query(
        `SELECT provider, min_interval_ms, max_concurrent FROM nex.provider_rate_config WHERE provider = $1 FOR UPDATE`,
        [providerName],
      )).rows[0];
      if (!cfg) { await client.query("ROLLBACK"); throw new Error(`Provider "${providerName}" not configured`); }
      const activeR = await client.query(
        `SELECT lease_id, expires_at FROM nex.provider_rate_lease WHERE provider = $1 AND released_at IS NULL`,
        [providerName],
      );
      const now = Date.now();
      const effectivelyActive = activeR.rows.filter((r) => new Date(r.expires_at).getTime() > now);
      if (effectivelyActive.length >= cfg.max_concurrent) {
        const oldest = effectivelyActive.reduce((a, b) => (new Date(a.expires_at) < new Date(b.expires_at) ? a : b));
        const wait = Math.max(50, new Date(oldest.expires_at).getTime() - now);
        await client.query("COMMIT");
        await new Promise((r) => setTimeout(r, Math.min(wait, deadline - Date.now())));
        continue;
      }
      const lastR = await client.query(
        `SELECT MAX(released_at) AS latest FROM nex.provider_rate_lease WHERE provider = $1 AND released_at IS NOT NULL`,
        [providerName],
      );
      const gap = lastR.rows[0]?.latest ? now - new Date(lastR.rows[0].latest).getTime() : Infinity;
      if (gap < cfg.min_interval_ms) {
        const wait = cfg.min_interval_ms - gap;
        await client.query("COMMIT");
        await new Promise((r) => setTimeout(r, Math.min(wait, deadline - Date.now())));
        continue;
      }
      const expires = new Date(now + Math.max(cfg.min_interval_ms, 15000));
      const leaseR = await client.query(
        `INSERT INTO nex.provider_rate_lease (provider, walker_id, acquired_at, expires_at)
         VALUES ($1, $2, to_timestamp($3/1000.0), $4) RETURNING lease_id`,
        [providerName, WORKER_ID, now, expires],
      );
      await client.query("COMMIT");
      return leaseR.rows[0].lease_id;
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      if (e.code === "40001" || e.code === "40P01") { await new Promise((r) => setTimeout(r, 200 + Math.random() * 500)); continue; }
      throw e;
    } finally {
      client.release();
    }
  }
  throw new Error(`could not acquire lease for ${providerName} within ${MAX_WAIT_MS}ms`);
}

async function releaseGovernorLease(leaseId) {
  await pool.query(`UPDATE nex.provider_rate_lease SET released_at = now() WHERE lease_id = $1`, [leaseId]);
}

// ── cycle attribution ───────────────────────────────────────────────
const WORKER_ID = `knowledge:${JOB}`;
async function openCycle() {
  const r = await pool.query(
    `INSERT INTO nex.worker_cycle_run (worker_type, worker_id, worker_config, status, summary)
     VALUES ($1, $2, $3, 'running', jsonb_build_object('segment', $4::text, 'provider', $5::text))
     RETURNING id`,
    [`knowledge:${SEGMENT}`, WORKER_ID, `${JOB}:${PROVIDER}`, SEGMENT, PROVIDER],
  );
  return r.rows[0].id;
}
async function closeCycle(cycleId, status, summary) {
  await pool.query(
    `UPDATE nex.worker_cycle_run SET status = $2, finished_at = now(),
        summary = COALESCE(summary, '{}'::jsonb) || $3::jsonb
      WHERE id = $1`,
    [cycleId, status, JSON.stringify(summary)],
  );
}

// ── inbox writer ────────────────────────────────────────────────────
async function upsertKnowledge(topic, payload, source, sourceUrl, licenceTerms, truthClass, cycleId) {
  const brainSlug = "indonesia";
  const topicKey = topic.topic_key;
  const inboxId = `${brainSlug}/${topicKey}/${source}`;
  const meta = {
    provider: source,
    walker_job: JOB,
    lang: payload.lang ?? null,
    description: payload.description ?? null,
    wikibase_item: payload.wikibase_item ?? null,
    thumbnail: payload.thumbnail ?? null,
    categories: topic.categories ?? [],
    region: topic.region ?? null,
    licence: licenceTerms,
    source_url: sourceUrl,
  };
  const previewText = (payload.extract ?? "").slice(0, 400);
  const hash = createHash("sha256")
    .update(String(payload.extract ?? "") + "|" + sourceUrl).digest("hex").slice(0, 32);

  const r = await pool.query(
    `INSERT INTO nex.knowledge_inbox (
       id, title, kind, status, source, hash,
       created_at_ms, created_at_iso, meta, preview_text, url,
       brain_slug, topic_key, truth_class
     ) VALUES (
       $1, $2, 'url', 'waiting', $3, $4,
       $5, now(), $6, $7, $8,
       $9, $10, $11
     )
     ON CONFLICT (id) DO UPDATE SET
       meta = EXCLUDED.meta,
       preview_text = COALESCE(nex.knowledge_inbox.preview_text, EXCLUDED.preview_text),
       shadow_updated_at = now()
     RETURNING id, (xmax = 0) AS is_new`,
    [
      inboxId, payload.title, source, hash,
      Date.now(), JSON.stringify(meta), previewText, sourceUrl,
      brainSlug, topicKey, truthClass,
    ],
  );
  return r.rows[0];
}

// ── main cycle ──────────────────────────────────────────────────────
async function main() {
  const cycleId = await openCycle();
  console.log(`▶ knowledge walker · job=${JOB} · segment=${SEGMENT} · provider=${PROVIDER} · cycle=${cycleId}`);

  const candidates = topics.slice(0, MAX_TOPICS);
  let fetched = 0, persisted = 0, merged = 0, failed = 0, skipped = 0;
  const errors = [];

  for (const topic of candidates) {
    let leaseId = null;
    try {
      leaseId = await acquireGovernorLease(PROVIDER);
      const res = await provider.fetch(topic);
      await releaseGovernorLease(leaseId); leaseId = null;
      if (!res.ok) { skipped++; console.log(`  ⧗ ${topic.topic_key}: ${res.reason}`); continue; }
      fetched++;
      if (DRY_RUN) { console.log(`  ✓ [dry] ${topic.topic_key} · ${res.payload.title}`); continue; }
      const up = await upsertKnowledge(
        topic, res.payload, PROVIDER, res.source_url, provider.licence,
        topic.truth_class, cycleId,
      );
      if (up.is_new) { persisted++; console.log(`  ✚ NEW ${topic.topic_key} · ${res.payload.title.slice(0,40)}`); }
      else { merged++; console.log(`  ↻ MERGE ${topic.topic_key} · ${res.payload.title.slice(0,40)}`); }
    } catch (e) {
      failed++;
      errors.push({ topic: topic.topic_key, error: e.message });
      console.error(`  ✗ ${topic.topic_key}: ${e.message}`);
    } finally {
      if (leaseId) { try { await releaseGovernorLease(leaseId); } catch {} }
    }
  }

  const outcome = failed === candidates.length ? "PROVIDER_ERROR"
    : (persisted > 0 ? "PARTIAL" : (fetched > 0 ? "ALL_MERGED" : "PROVIDER_EMPTY"));
  await closeCycle(cycleId, "completed", {
    cycle_outcome: outcome,
    records_new: persisted,
    fetched, persisted, merged, failed, skipped,
    errors: errors.slice(0, 5),
  });

  console.log(`── cycle ${cycleId} · outcome=${outcome} · fetched=${fetched} · new=${persisted} · merged=${merged} · failed=${failed} · skipped=${skipped}`);
  await pool.end();
  process.exit(failed > 0 && persisted === 0 && merged === 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("knowledge walker crashed:", e);
  try { await pool.end(); } catch {}
  process.exit(2);
});
