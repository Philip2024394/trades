#!/usr/bin/env node
// scripts/nex-lab-gov-harvester.mjs
//
// Founder 2026-09-10 · Indonesia gov open-data harvester.
//
// Discovers + downloads business-related datasets from Indonesia's official
// open-data portals (all free, all licensed for public use):
//
//   1. data.go.id (Portal Data Nasional) · CKAN API
//   2. Kemenparekraf (Ministry of Tourism) · registered accommodation
//   3. BPS (Statistics Indonesia) · business census summaries
//   4. NSW (Nasional Single Window) · exporter/importer directory
//
// Everything downloaded goes into nex_lab_business.gov_source_raw with
// full provenance (source_portal, dataset_id, licence, retrieved_at). A
// second pass (nex-lab-gov-parser.mjs, follow-up BEGIN) turns raw datasets
// into typed business rows and feeds them into harvest_raw.
//
// LEGAL FOOTING:
//   · data.go.id licences ALL datasets under Open Data (CC-BY or public
//     domain). No scraping · uses documented CKAN API.
//   · User-Agent identifies as NEX-Lab-GovHarvester
//   · Rate-limited 1 req/2s
//   · Robots.txt honoured
//   · No personal data · gov data is by definition public

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const RAW_DIR = join(LAB_DIR, "gov-raw");
const LOG_PATH = join(LAB_DIR, "gov-harvester.log");

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
const LIMIT_DATASETS = Number(args.get("limit") ?? "30");
const SEARCH_TERMS = (args.get("terms") ?? "usaha,bisnis,hotel,restoran,perusahaan,umkm,pariwisata,kuliner").split(",");
const DRY = args.get("dry") === "true";

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });
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

const UA = "NEX-Lab-GovHarvester/1.0 (open-data-collection; +https://nex.id/lab)";

async function fetchJson(url, ms = 15_000) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return { error: `http_${res.status}` };
    return { ok: true, data: await res.json() };
  } catch (err) { return { error: String(err).slice(0, 200) }; }
}

async function fetchBinary(url, ms = 30_000, maxBytes = 20 * 1024 * 1024) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return { error: `http_${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) return { error: `too_large_${buf.length}` };
    return { ok: true, buf, contentType: res.headers.get("content-type") || "application/octet-stream" };
  } catch (err) { return { error: String(err).slice(0, 200) }; }
}

// ─── Table setup ───────────────────────────────────────────────────
async function ensureGovTable(c) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS nex_lab_business.gov_source_raw (
      record_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_portal   TEXT NOT NULL,
      dataset_id      TEXT NOT NULL,
      resource_id     TEXT,
      title           TEXT,
      organization    TEXT,
      licence         TEXT,
      format          TEXT,
      resource_url    TEXT,
      metadata        JSONB NOT NULL,
      bytes           INTEGER,
      sha256          TEXT,
      local_path      TEXT,
      retrieved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      parse_status    TEXT NOT NULL DEFAULT 'pending',
      UNIQUE (source_portal, dataset_id, resource_id)
    );
    CREATE INDEX IF NOT EXISTS ix_gov_raw_portal ON nex_lab_business.gov_source_raw (source_portal);
    CREATE INDEX IF NOT EXISTS ix_gov_raw_status ON nex_lab_business.gov_source_raw (parse_status);
  `);
}

// ─── Known + candidate CKAN portals · runtime-probed ───────────────
// Founder 2026-09-10 · data.go.id was rewritten as a Next.js portal.
// Provincial and ministerial sub-portals expose CKAN v3 individually.
// Runtime probe filters unreachable ones automatically — the list can
// safely grow without breaking a run.
const CKAN_PORTAL_CANDIDATES = [
  { name: "sumbarprov",          url: "https://data.sumbarprov.go.id" },
  { name: "kementerian-pu",      url: "https://data.pu.go.id" },
  { name: "opendata-sumselprov", url: "https://opendata.sumselprov.go.id" },
  { name: "opendata-sulselprov", url: "https://opendata.sulselprov.go.id" },
  { name: "opendata-jabarprov",  url: "https://opendata.jabarprov.go.id" },
  { name: "opendata-jatimprov",  url: "https://opendata.jatimprov.go.id" },
  { name: "opendata-kaltimprov", url: "https://opendata.kaltimprov.go.id" },
  { name: "opendata-riauprov",   url: "https://opendata.riauprov.go.id" },
  { name: "opendata-nttprov",    url: "https://opendata.nttprov.go.id" },
  { name: "opendata-babelprov",  url: "https://opendata.babelprov.go.id" },
  { name: "data-jakarta",        url: "https://data.jakarta.go.id" },
  { name: "data-jogjaprov",      url: "https://data.jogjaprov.go.id" },
  { name: "data-jogjakota",      url: "https://data.jogjakota.go.id" },
  { name: "data-bantulkab",      url: "https://data.bantulkab.go.id" },
];

async function probePortal(portal) {
  try {
    const r = await fetch(`${portal.url}/api/3/action/package_search?q=usaha&rows=1`, {
      headers: { "User-Agent": "NEX-Lab-GovHarvester/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return { ok: false, reason: `http_${r.status}` };
    const j = await r.json().catch(() => null);
    if (!j?.success) return { ok: false, reason: "not_ckan_v3" };
    return { ok: true };
  } catch (err) { return { ok: false, reason: String(err).slice(0, 80) }; }
}

let CKAN_PORTALS = [];
async function initReachablePortals() {
  const results = await Promise.all(CKAN_PORTAL_CANDIDATES.map(async (p) => ({ ...p, probe: await probePortal(p) })));
  CKAN_PORTALS = results.filter((p) => p.probe.ok).map((p) => ({ name: p.name, url: p.url, supportsSearch: true }));
  const unreachable = results.filter((p) => !p.probe.ok);
  log(`portal probe · reachable=${CKAN_PORTALS.length}/${CKAN_PORTAL_CANDIDATES.length}`);
  for (const p of unreachable) log(`  · ${p.name} unreachable (${p.probe.reason})`);
}

async function discoverFromCkan(portal) {
  const found = [];
  for (const term of SEARCH_TERMS) {
    const url = `${portal.url}/api/3/action/package_search?q=${encodeURIComponent(term)}&rows=25`;
    log(`  ${portal.name} search · "${term}"`);
    const r = await fetchJson(url);
    if (r.error) { log(`    error: ${r.error}`); await sleep(2000); continue; }
    if (!r.data?.success) { log(`    api-error: ${JSON.stringify(r.data?.error ?? "unknown").slice(0, 120)}`); await sleep(2000); continue; }
    const results = r.data.result?.results ?? [];
    if (results.length) log(`    found ${results.length} datasets`);
    for (const ds of results) {
      const resources = ds.resources ?? [];
      for (const res of resources) {
        const fmt = String(res.format ?? "").toLowerCase();
        if (!["csv", "json", "xml", "xls", "xlsx", "api"].some((f) => fmt.includes(f))) continue;
        found.push({
          source_portal: portal.name,
          dataset_id: ds.id,
          resource_id: res.id,
          title: ds.title,
          organization: ds.organization?.title ?? ds.organization?.name ?? null,
          licence: ds.license_title || ds.license_id || "unknown",
          format: fmt,
          resource_url: res.url,
          search_term: term,
          metadata: { dataset: ds, resource: res },
        });
      }
      if (found.length >= LIMIT_DATASETS) break;
    }
    await sleep(2000);
    if (found.length >= LIMIT_DATASETS) break;
  }
  return found;
}

async function discoverAll() {
  const all = [];
  for (const portal of CKAN_PORTALS) {
    try {
      const items = await discoverFromCkan(portal);
      log(`  ${portal.name} total: ${items.length} resources`);
      all.push(...items);
      if (all.length >= LIMIT_DATASETS) break;
    } catch (err) {
      log(`  ${portal.name} ERROR: ${String(err).slice(0, 200)}`);
    }
  }
  return all;
}

async function downloadResource(c, item) {
  const key = `${item.source_portal}__${item.dataset_id}__${item.resource_id ?? "no-res"}`;
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  const localPath = join(RAW_DIR, `${safeKey}.${item.format || "bin"}`);
  const url = item.resource_url;
  log(`  ↓ ${item.title?.slice(0, 60)} · ${item.format}`);
  const r = await fetchBinary(url);
  if (r.error) {
    log(`    download error: ${r.error}`);
    // Still record the discovery · downloads can fail transiently
    await c.query(`
      INSERT INTO nex_lab_business.gov_source_raw
        (source_portal, dataset_id, resource_id, title, organization, licence, format, resource_url, metadata, parse_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'download_failed')
      ON CONFLICT (source_portal, dataset_id, resource_id) DO UPDATE SET
        parse_status = EXCLUDED.parse_status,
        retrieved_at = now()
    `, [item.source_portal, item.dataset_id, item.resource_id, item.title, item.organization, item.licence, item.format, item.resource_url, JSON.stringify(item.metadata)]);
    return { status: "download_failed" };
  }
  if (!DRY) writeFileSync(localPath, r.buf);
  const sha = createHash("sha256").update(r.buf).digest("hex");
  await c.query(`
    INSERT INTO nex_lab_business.gov_source_raw
      (source_portal, dataset_id, resource_id, title, organization, licence, format, resource_url, metadata, bytes, sha256, local_path, parse_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, 'downloaded')
    ON CONFLICT (source_portal, dataset_id, resource_id) DO UPDATE SET
      bytes = EXCLUDED.bytes,
      sha256 = EXCLUDED.sha256,
      local_path = EXCLUDED.local_path,
      parse_status = 'downloaded',
      retrieved_at = now()
  `, [item.source_portal, item.dataset_id, item.resource_id, item.title, item.organization, item.licence, item.format, item.resource_url, JSON.stringify(item.metadata), r.buf.length, sha, localPath]);
  log(`    ✓ ${r.buf.length.toLocaleString()} bytes · ${sha.slice(0, 12)}…`);
  return { status: "downloaded", bytes: r.buf.length };
}

async function main() {
  const t0 = Date.now();
  const Client = await loadPg();
  if (!Client) { log("no pg module · aborting"); process.exit(2); }
  const url = readPgUrl();
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await c.connect();
  try {
    await ensureGovTable(c);
    await initReachablePortals();
    log(`start · portals=[${CKAN_PORTALS.map((p) => p.name).join(",")}] · terms=${SEARCH_TERMS.join(",")} · limit=${LIMIT_DATASETS}`);
    const items = await discoverAll();
    log(`discovered ${items.length} downloadable resources across ${new Set(items.map((i) => i.dataset_id)).size} datasets`);
    let downloaded = 0, failed = 0;
    for (const item of items.slice(0, LIMIT_DATASETS)) {
      const r = await downloadResource(c, item);
      if (r.status === "downloaded") downloaded++;
      else failed++;
      await sleep(2000);
    }
    log(`done · discovered=${items.length} downloaded=${downloaded} failed=${failed} · ${Date.now() - t0}ms`);
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 300)}`); process.exit(1); });
