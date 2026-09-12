#!/usr/bin/env node
// scripts/nex-lab-crawler-router.mjs
//
// Founder 2026-09-10 · Crawler → Lab router.
//
// For every unprocessed nex_crawler.extracted_record:
//   1. Decide which Lab room it belongs in (business/food/accommodation/
//      activities/transport) — or REJECT with a documented reason
//   2. Compute deterministic dedupe_hash for that room
//   3. Insert into nex_lab_{room}.harvest_raw (or update if duplicate)
//   4. Write nex_crawler.extracted_record.processed_at + routed_to
//   5. Emit founder_window_event (data_received / evidence_rejected)
//
// Zero silent drops. Every extracted record ends up either routed or in
// the rejection_log with a reason.

import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "crawler-router.log");

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

// ─── Routing rules ─────────────────────────────────────────────────
// Maps an extracted_record to a target Lab room. Returns null if the
// record cannot be routed (will be rejected with a reason).
function decideRoute(rec) {
  const { record_kind, payload } = rec;
  const p = payload ?? {};
  // Skip social_handle rows · they enrich existing rows, not new ones
  if (record_kind === "social_handle") return { room: null, reject: "wrong_kind", detail: "social_handle · use enricher instead" };
  if (record_kind === "link") return { room: null, reject: "wrong_kind", detail: "link only · no business content" };
  if (record_kind === "person") return { room: null, reject: "personal_data", detail: "person records dropped per UU PDP 27/2022" };
  if (record_kind === "review") return { room: null, reject: "wrong_kind", detail: "review pipeline is separate" };
  // Events (news, blog posts) go to a news bucket · currently we don't have one
  // in Lab rooms · reject with clear reason so operator can decide to build it
  if (record_kind === "event") return { room: null, reject: "wrong_kind", detail: "event/news record · no news lab room yet" };
  // Only business kind proceeds to routing
  if (record_kind !== "business") return { room: null, reject: "wrong_kind", detail: `unknown kind: ${record_kind}` };

  const name = String(p.name ?? "").trim();
  if (!name) return { room: null, reject: "missing_name", detail: "business record has no name" };

  // Route by type signal in payload.raw_type (from JSON-LD) or category hints
  const typeHint = String(p.raw_type ?? "").toLowerCase();
  const desc = String(p.description ?? "").toLowerCase();
  const nameL = name.toLowerCase();
  const combined = `${typeHint} ${desc} ${nameL}`;

  if (/\bhotel|resort|villa|homestay|guesthouse|penginapan|wisma|losmen|hostel|kos\b/.test(combined))
    return { room: "accommodation" };
  if (/\brestaurant|resto|cafe|coffee|kopi|warung|kuliner|dining|bakery|food|bar|pub\b/.test(combined))
    return { room: "food" };
  if (/\bmuseum|temple|beach|waterfall|mountain|park|attraction|wisata|pantai\b/.test(combined))
    return { room: "activities" };
  if (/\btrain|bus|airport|taxi|transport|terminal|stasiun\b/.test(combined))
    return { room: "transport" };
  // Default: general business
  return { room: "business" };
}

function computeDedupeHash(name, host, coords) {
  const key = `${name.toLowerCase().replace(/\s+/g, " ").trim()}|${host}|${coords?.lat ?? "?"}|${coords?.lon ?? "?"}`;
  return createHash("sha256").update(key).digest("hex");
}

async function emitFW(c, kind, status, message, ref = {}) {
  try {
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('lab_harvest', $1, $2, 'crawler-router.mjs', $3, $4::jsonb)`,
      [kind, status, message, JSON.stringify(ref)]
    );
  } catch { /* silent */ }
}

async function main() {
  const t0 = Date.now();
  const { Client } = await import("pg");
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 8000 });
  await c.connect();
  const totals = { considered: 0, routed: 0, rejected: 0, updated: 0 };
  const perRoom = {};
  try {
    const rows = (await c.query(
      `SELECT record_id, fetch_id, source_url, source_host, record_kind, payload, dedupe_hash AS src_dedupe
       FROM nex_crawler.extracted_record
       WHERE processed_at IS NULL
       ORDER BY discovered_at ASC
       LIMIT $1`, [LIMIT]
    )).rows;
    log(`start · ${rows.length} unprocessed records`);
    await emitFW(c, "scheduled_task_triggered", "info", `routing ${rows.length} crawler records`, { limit: LIMIT });

    for (const rec of rows) {
      totals.considered++;
      const decision = decideRoute(rec);

      if (decision.reject) {
        totals.rejected++;
        await c.query(
          `INSERT INTO nex_crawler.rejection_log (record_id, reason_code, reason_detail, reference)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [rec.record_id, decision.reject, decision.detail, JSON.stringify({ source_host: rec.source_host, kind: rec.record_kind })]
        );
        await c.query(
          `UPDATE nex_crawler.extracted_record SET processed_at = now(), routed_to = 'rejected'
           WHERE record_id = $1`, [rec.record_id]
        );
        await emitFW(c, "evidence_rejected", "warning",
          `${rec.record_kind} from ${rec.source_host}: ${decision.reject}`,
          { host: rec.source_host, reason: decision.reject, detail: decision.detail });
        continue;
      }

      // Route it in
      const room = decision.room;
      const schema = `nex_lab_${room}`;
      const p = rec.payload;
      const coords = p.coordinates ?? null;
      const dedupe = computeDedupeHash(p.name, rec.source_host, coords);

      // Enrich the payload with crawler provenance
      const labPayload = {
        name: p.name,
        description: p.description ?? null,
        coordinates: coords,
        website: p.website ?? p.link ?? rec.source_url,
        phone: p.phone ?? (Array.isArray(p.phones) ? p.phones[0] : null),
        email: p.email ?? (Array.isArray(p.emails) ? p.emails[0] : null),
        address: p.address ?? null,
        city: null, // extracted rows rarely carry city · leave for downstream enrichment
        source_ref: rec.source_url,
        source_host: rec.source_host,
        source_kind: "directory_crawl",
        crawler_extractor: "html_generic",
        crawler_record_id: rec.record_id,
        crawler_fetch_id: rec.fetch_id,
        raw_type: p.raw_type ?? null,
        tags: {},
      };

      await c.query(`BEGIN`);
      try {
        const existing = await c.query(
          `SELECT record_id FROM ${schema}.harvest_raw WHERE dedupe_hash = $1 LIMIT 1`,
          [dedupe]
        );
        if (existing.rowCount > 0) {
          // Merge new signals into existing row
          await c.query(
            `UPDATE ${schema}.harvest_raw
             SET payload = payload || $1::jsonb,
                 harvested_at = greatest(harvested_at, now())
             WHERE dedupe_hash = $2`,
            [JSON.stringify({
              source_crawler: labPayload.source_host,
              crawler_source_ref: labPayload.source_ref,
              crawler_updated_at: new Date().toISOString(),
              website: labPayload.website,
              email: labPayload.email,
              phone: labPayload.phone,
            }), dedupe]
          );
          totals.updated++;
        } else {
          await c.query(
            `INSERT INTO ${schema}.harvest_raw (source, source_ref, payload, dedupe_hash)
             VALUES ($1, $2, $3::jsonb, $4)`,
            [`crawler:${rec.source_host}`, rec.source_url, JSON.stringify(labPayload), dedupe]
          );
          totals.routed++;
        }
        await c.query(
          `UPDATE nex_crawler.extracted_record
           SET processed_at = now(), routed_to = $1, routed_ref = $2
           WHERE record_id = $3`,
          [`${schema}.harvest_raw`, dedupe, rec.record_id]
        );
        perRoom[room] = (perRoom[room] ?? 0) + 1;
        await c.query(`COMMIT`);
      } catch (err) {
        totals.rejected++;
        try { await c.query(`ROLLBACK`); } catch { /* ignore */ }
        await c.query(
          `INSERT INTO nex_crawler.rejection_log (record_id, reason_code, reason_detail, reference)
           VALUES ($1, 'insert_failed', $2, $3::jsonb)`,
          [rec.record_id, String(err).slice(0, 300), JSON.stringify({ target: schema })]
        );
        await c.query(
          `UPDATE nex_crawler.extracted_record SET processed_at = now(), routed_to = 'error'
           WHERE record_id = $1`, [rec.record_id]
        );
      }
    }

    log(`done · considered=${totals.considered} routed=${totals.routed} updated=${totals.updated} rejected=${totals.rejected}`);
    for (const [room, count] of Object.entries(perRoom)) log(`  → ${room}: ${count}`);
    await emitFW(c, "scheduled_task_completed", "ok",
      `router: ${totals.routed} new · ${totals.updated} updated · ${totals.rejected} rejected`,
      { ...totals, per_room: perRoom, duration_ms: Date.now() - t0 });
  } finally { try { await c.end(); } catch { /* ignore */ } }
}

main().catch((err) => { log("fatal: " + String(err).slice(0, 200)); process.exit(1); });
