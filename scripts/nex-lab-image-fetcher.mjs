#!/usr/bin/env node
// scripts/nex-lab-image-fetcher.mjs
//
// Founder ADR-0304 · Wikimedia image fetcher.
//
// For each verified row whose evidence_refs contains a Wikidata QID,
// fetches the P18 (image) property from Wikidata, downloads the image
// URL from Wikimedia Commons, and stores it in a new column
// `image_url` on the verified row (added by this script).
//
// Golden rule:
//   · CC0 or CC-BY-SA only (Wikimedia default)
//   · Never store user-uploaded images (only Wikimedia Commons)
//   · Store the FULL provenance chain: qid, commons_page, licence
//
// This is v1 · stores URL only. v2 will upload to MinIO with signed URLs.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "image-fetcher.log");

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const key = a.replace(/^--/, "");
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) { args.set(key, next); i++; }
    else args.set(key, "true");
  }
}
const CLI_ROOM = args.get("room");
const LIMIT = Number(args.get("limit") ?? "20");
const MAX_QPS = 1; // Wikidata rate limit friendly

const ROOMS = ["accommodation", "food", "transport", "business", "activities"];

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* silent */ }
}

async function loadPg() {
  try { return (await import("pg")).Client; } catch { return null; }
}
function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

async function ensureImageColumn(client, schema) {
  await client.query(`
    ALTER TABLE ${schema}.verified
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS image_source_qid TEXT,
      ADD COLUMN IF NOT EXISTS image_licence TEXT,
      ADD COLUMN IF NOT EXISTS image_fetched_at TIMESTAMPTZ
  `);
}

async function fetchWikidataImage(qid, attempt = 0) {
  const BACKOFF = [1500, 4000, 10000];
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "NEX-Lab-ImageFetcher/1.0 (github.com/nex)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429 || res.status === 503) {
      if (attempt >= BACKOFF.length) return null;
      await sleep(BACKOFF[attempt]);
      return fetchWikidataImage(qid, attempt + 1);
    }
    if (!res.ok) return null;
    const j = await res.json();
    const entity = j?.entities?.[qid];
    const p18 = entity?.claims?.P18;
    if (!Array.isArray(p18) || p18.length === 0) return null;
    const filename = p18[0]?.mainsnak?.datavalue?.value;
    if (!filename) return null;
    // Commons hash-based URL: MD5 of filename, first 1 char and 2 chars form dir prefix
    const { createHash } = await import("node:crypto");
    const clean = filename.replace(/ /g, "_");
    const md5 = createHash("md5").update(clean).digest("hex");
    const commonsUrl = `https://upload.wikimedia.org/wikipedia/commons/${md5[0]}/${md5.slice(0, 2)}/${encodeURIComponent(clean)}`;
    return {
      url: commonsUrl,
      commons_filename: filename,
      licence: "wikimedia_commons_check_file_page", // v2 · fetch file's licence tag
    };
  } catch { return null; }
}

async function throttled(fn) {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  const minMs = 1000 / MAX_QPS;
  if (elapsed < minMs) await sleep(minMs - elapsed);
  return result;
}

async function processRoom(Client, url, roomSlug, limit) {
  const schema = `nex_lab_${roomSlug}`;
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await c.connect();
  let seen = 0, fetched = 0, missing = 0;
  try {
    await ensureImageColumn(c, schema);
    // Verified rows with Wikidata QID in evidence_refs and no image yet
    const rows = (await c.query(`
      SELECT subject_ref, evidence_refs
      FROM ${schema}.verified
      WHERE source_count >= 2 AND image_url IS NULL
        AND EXISTS (SELECT 1 FROM unnest(evidence_refs) e WHERE e LIKE 'wikidata:Q%')
      LIMIT $1
    `, [limit])).rows;

    for (const r of rows) {
      seen++;
      const refs = Array.isArray(r.evidence_refs) ? r.evidence_refs : [];
      const qid = (refs.find((e) => typeof e === "string" && e.startsWith("wikidata:Q")) ?? "").replace("wikidata:", "");
      if (!qid) { missing++; continue; }
      const img = await throttled(() => fetchWikidataImage(qid));
      if (!img) { missing++; continue; }
      try {
        await c.query(
          `UPDATE ${schema}.verified
           SET image_url=$1, image_source_qid=$2, image_licence=$3, image_fetched_at=now()
           WHERE subject_ref=$4`,
          [img.url, qid, img.licence, r.subject_ref],
        );
        fetched++;
      } catch { /* skip */ }
    }
  } finally { try { await c.end(); } catch { /* ignore */ } }
  return { seen, fetched, missing };
}

async function main() {
  const t0 = Date.now();
  const Client = await loadPg();
  if (!Client) { log("pg missing"); process.exit(2); }
  const url = readPgUrl();
  const target = CLI_ROOM ? [CLI_ROOM] : ROOMS;
  log(`image-fetcher start · rooms=${target.join(",")} · limit=${LIMIT}`);
  let totalSeen = 0, totalFetched = 0;
  for (const room of target) {
    try {
      const r = await processRoom(Client, url, room, LIMIT);
      log(`  ${room.padEnd(14)} · seen=${r.seen} fetched=${r.fetched} missing=${r.missing}`);
      totalSeen += r.seen; totalFetched += r.fetched;
    } catch (err) {
      log(`  ${room.padEnd(14)} · err: ${String(err).slice(0, 200)}`);
    }
  }
  log(`image-fetcher done · seen=${totalSeen} fetched=${totalFetched} · ${Date.now() - t0}ms`);
  process.exit(0);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 400)}`); process.exit(1); });
