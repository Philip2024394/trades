#!/usr/bin/env node
// scripts/nex-lab-quality-agent.mjs
//
// Founder 2026-09-10 · Quality-scoring agent.
//
// For every harvest_raw row (across all 5 Lab rooms) that hasn't been
// quality-scored yet, apply a 7-signal deterministic rubric and:
//
//   · score ≥ 0.70 → promote to nex_lab_{room}.verified · emit
//                     evidence_discovered + claim_verified events
//   · score 0.40 - 0.69 → mark quality_score in payload · leave in
//                          harvest_raw for possible re-scoring after
//                          enrichment (email/IG) · emit gap_created
//   · score < 0.40 → mark quality_score in payload · flag as
//                    low_quality (visible in observatory) · emit
//                    claim_rejected event with reasons
//
// Every score is deterministic · reproducible · no LLM · zero fabrication.
//
// 7 signals (each 0..1):
//   S1 name_quality      — length, not all caps, has at least 2 words
//   S2 coord_present     — has valid coordinates
//   S3 address_present   — has street or district
//   S4 contact_present   — phone OR email OR website OR whatsapp
//   S5 category_certain  — categorised (derived_category present, not "unclassified")
//   S6 source_reputation — source_host in trusted list gets bonus
//   S7 cross_source      — dedupe_hash appears in ≥2 different sources

import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "quality-agent.log");

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
const LIMIT = Number(args.get("limit") ?? "500");
const ROOMS = ["accommodation", "food", "transport", "business", "activities"];
const CLI_ROOM = args.get("room");
const PROMOTE_THRESHOLD = 0.70;
const RETAIN_THRESHOLD = 0.40;

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try { if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true }); appendFileSync(LOG_PATH, msg); } catch { /* silent */ }
}

function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

const TRUSTED_HOSTS = new Set([
  "openstreetmap.org", "wikidata.org", "wikipedia.org",
  "data.pu.go.id", "data.sumbarprov.go.id", "opendata.sumselprov.go.id",
  "satudata.kemenparekraf.go.id", "halalmui.org", "phri.or.id",
  "kemenparekraf.go.id",
]);

// ─── 7-signal rubric ───────────────────────────────────────────────
function scoreRow(payload, host, crossSourceCount) {
  const reasons = [];
  const name = String(payload?.name ?? "").trim();
  const coords = payload?.coordinates;
  const addr = payload?.address;
  const phone = payload?.phone;
  const email = payload?.email;
  const website = payload?.website;
  const whatsapp = payload?.enriched_contacts?.whatsapp?.[0];
  const derivedCat = payload?.derived_category;

  // S1: name quality
  let s1 = 0;
  if (name.length >= 3 && name.length <= 200) s1 += 0.4;
  if (name.split(/\s+/).length >= 2) s1 += 0.3;
  if (name !== name.toUpperCase() || name.length <= 8) s1 += 0.3;
  if (s1 < 0.7) reasons.push(`name_weak(${name.length}ch)`);

  // S2: coords
  const s2 = (coords && typeof coords.lat === "number" && typeof coords.lon === "number"
              && Math.abs(coords.lat) <= 90 && Math.abs(coords.lon) <= 180) ? 1.0 : 0;
  if (s2 === 0) reasons.push("no_coords");

  // S3: address
  const s3 = addr ? (typeof addr === "string" ? (addr.length > 5 ? 1 : 0.3)
                                              : (addr.street || addr.district || addr.city ? 1 : 0.3))
                   : 0;
  if (s3 === 0) reasons.push("no_address");

  // S4: contact
  const contactBits = [phone, email, website, whatsapp].filter(Boolean).length;
  const s4 = Math.min(1, contactBits * 0.35);
  if (contactBits === 0) reasons.push("no_contact");

  // S5: category certainty
  const s5 = derivedCat && derivedCat !== "unclassified" ? 1 : 0;
  if (!s5) reasons.push("uncategorised");

  // S6: source reputation
  const trusted = host && [...TRUSTED_HOSTS].some((h) => host.endsWith(h));
  const s6 = trusted ? 1 : 0.5;
  if (!trusted) reasons.push("untrusted_source");

  // S7: cross-source (already computed by caller)
  const s7 = crossSourceCount >= 2 ? 1 : crossSourceCount === 1 ? 0.5 : 0.3;
  if (crossSourceCount < 2) reasons.push(`only_${crossSourceCount}_source`);

  // Weights: 0.20 name · 0.15 coords · 0.10 address · 0.15 contact · 0.10 category · 0.15 source · 0.15 cross-source
  const total = 0.20 * s1 + 0.15 * s2 + 0.10 * s3 + 0.15 * s4 + 0.10 * s5 + 0.15 * s6 + 0.15 * s7;
  return { score: Math.round(total * 100) / 100, reasons, signals: { s1, s2, s3, s4, s5, s6, s7 } };
}

async function emitFW(c, kind, status, message, ref = {}) {
  try {
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('lab_verify', $1, $2, 'quality-agent.mjs', $3, $4::jsonb)`,
      [kind, status, message, JSON.stringify(ref)]
    );
  } catch { /* silent */ }
}

async function ensureVerifiedTable(c, schema) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.verified (
      record_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subject_ref     TEXT NOT NULL, -- dedupe_hash from harvest_raw
      field_name      TEXT NOT NULL, -- 'identity' etc.
      field_value     JSONB NOT NULL,
      confidence      NUMERIC(3,2) NOT NULL,
      source_count    INTEGER NOT NULL DEFAULT 1,
      evidence_refs   TEXT[],
      last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (subject_ref, field_name)
    )
  `);
}

async function processRoom(c, room, limit) {
  const schema = `nex_lab_${room}`;
  await ensureVerifiedTable(c, schema);
  const rows = (await c.query(`
    SELECT record_id, source, source_ref, payload, dedupe_hash
    FROM ${schema}.harvest_raw
    WHERE (payload->>'quality_score') IS NULL
    ORDER BY harvested_at DESC
    LIMIT $1
  `, [limit])).rows;

  let promoted = 0, retained = 0, rejected = 0;
  for (const row of rows) {
    // How many distinct sources refer to this dedupe_hash?
    const csRes = await c.query(
      `SELECT count(DISTINCT source)::int AS c FROM ${schema}.harvest_raw WHERE dedupe_hash = $1`,
      [row.dedupe_hash]
    );
    const crossSource = csRes.rows[0]?.c ?? 1;
    let host = row.payload?.source_host ?? null;
    if (!host && row.source_ref) {
      try { host = new URL(String(row.source_ref)).hostname; } catch { host = null; }
    }
    if (!host && typeof row.source === "string") host = row.source; // e.g. "osm_overpass_api"
    host = host ?? "unknown";
    const { score, reasons, signals } = scoreRow(row.payload, host, crossSource);

    // Update payload with score
    const patched = {
      ...row.payload,
      quality_score: score,
      quality_reasons: reasons,
      quality_signals: signals,
      quality_scored_at: new Date().toISOString(),
      cross_source_count: crossSource,
    };
    await c.query(
      `UPDATE ${schema}.harvest_raw SET payload = $1::jsonb WHERE record_id = $2`,
      [JSON.stringify(patched), row.record_id]
    );

    if (score >= PROMOTE_THRESHOLD) {
      // Promote to verified
      await c.query(
        `INSERT INTO ${schema}.verified
           (subject_ref, field_name, field_value, confidence, source_count, evidence_refs, last_verified_at)
         VALUES ($1, 'identity', $2::jsonb, $3, $4, $5, now())
         ON CONFLICT (subject_ref, field_name) DO UPDATE SET
           field_value = EXCLUDED.field_value,
           confidence = EXCLUDED.confidence,
           source_count = EXCLUDED.source_count,
           evidence_refs = EXCLUDED.evidence_refs,
           last_verified_at = now()`,
        [row.dedupe_hash, JSON.stringify(patched), score, crossSource, [row.source_ref]]
      );
      promoted++;
      await emitFW(c, "claim_verified", "ok",
        `${room} · ${patched.name} · score ${score.toFixed(2)}`,
        { room, host, score, cross_source: crossSource });
    } else if (score >= RETAIN_THRESHOLD) {
      retained++;
      await emitFW(c, "gap_created", "info",
        `${room} · ${patched.name} · retain (score ${score.toFixed(2)}) · needs ${reasons.slice(0,3).join(",")}`,
        { room, score, reasons });
    } else {
      rejected++;
      await emitFW(c, "claim_rejected", "warning",
        `${room} · ${patched.name ?? "(unnamed)"} · rejected (score ${score.toFixed(2)}) · ${reasons.slice(0,3).join(",")}`,
        { room, score, reasons });
    }
  }
  return { room, considered: rows.length, promoted, retained, rejected };
}

async function main() {
  const t0 = Date.now();
  const { Client } = await import("pg");
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 8000 });
  await c.connect();
  const rooms = CLI_ROOM ? [CLI_ROOM] : ROOMS;
  log(`start · rooms=${rooms.join(",")} · limit/room=${LIMIT} · promote≥${PROMOTE_THRESHOLD} · retain≥${RETAIN_THRESHOLD}`);
  await emitFW(c, "scheduled_task_triggered", "info", `quality sweep · ${rooms.length} rooms`, { rooms });
  const totals = { considered: 0, promoted: 0, retained: 0, rejected: 0 };
  try {
    for (const room of rooms) {
      const r = await processRoom(c, room, LIMIT);
      log(`  ${room}: considered=${r.considered} promoted=${r.promoted} retained=${r.retained} rejected=${r.rejected}`);
      totals.considered += r.considered;
      totals.promoted += r.promoted;
      totals.retained += r.retained;
      totals.rejected += r.rejected;
    }
    log(`done · ${totals.considered} scored · ${totals.promoted} promoted · ${totals.retained} retained · ${totals.rejected} rejected · ${Date.now() - t0}ms`);
    await emitFW(c, "scheduled_task_completed", "ok",
      `quality sweep · ${totals.promoted} promoted / ${totals.considered} scored`,
      { ...totals, duration_ms: Date.now() - t0 });
  } finally { try { await c.end(); } catch { /* ignore */ } }
}

main().catch((err) => { log("fatal: " + String(err).slice(0, 200)); process.exit(1); });
