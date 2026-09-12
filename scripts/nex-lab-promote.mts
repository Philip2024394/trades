// scripts/nex-lab-promote.mts
//
// Founder ADR-0304 · B6 · Auto-promoter for cross-source verified rows.
//
// Only promotes rows with source_count >= 2 (Tier-A cross-verified).
// Single-source provisional rows STAY in verified — they need a second
// source before crossing the promotion line.
//
// Executed via: npx tsx scripts/nex-lab-promote.mts [--room accommodation]
//
// Discipline:
//   · Reuses the four existing per-room executors from src/lib/nex/lab/executors/
//   · Writes an immutable promotion_events row per (room, batch)
//   · Signs each promotion with system-role HMAC (NEX_LAB_PROMOTION_SECRET)
//   · Pre-computes rollback SQL and stores it in promotion_events
//   · Never runs if source_count < 2 · always safe to re-run

import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { executeAccommodationPromotion } from "../src/lib/nex/lab/executors/accommodation-executor.js";
import { executeFoodPromotion } from "../src/lib/nex/lab/executors/food-executor.js";
import { executeActivitiesPromotion } from "../src/lib/nex/lab/executors/activities-executor.js";
import { executeBusinessLeadPromotion } from "../src/lib/nex/lab/executors/business-lead-executor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const SECRET_PATH = join(LAB_DIR, "promotion-secret.txt");

const args = new Map<string, string>();
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
const DRY = args.get("dry") === "true";

const ROOM_TARGET_TABLE: Record<string, string> = {
  accommodation: "nex.accommodation_business",
  food:          "nex.food_business",
  transport:     "nex.business_lead_directory",
  business:      "nex.business_lead_directory",
  activities:    "nex.brain_attractions",
};

function log(line: string) { process.stdout.write(`[${new Date().toISOString()}] ${line}\n`); }

function readPgUrl(): string {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

function ensureSecret(): string {
  if (process.env.NEX_LAB_PROMOTION_SECRET && process.env.NEX_LAB_PROMOTION_SECRET.length >= 32) {
    return process.env.NEX_LAB_PROMOTION_SECRET;
  }
  if (existsSync(SECRET_PATH)) {
    const s = readFileSync(SECRET_PATH, "utf8").trim();
    if (s.length >= 32) { process.env.NEX_LAB_PROMOTION_SECRET = s; return s; }
  }
  const s = randomBytes(48).toString("hex"); // 96 chars
  if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
  writeFileSync(SECRET_PATH, s, { mode: 0o600 });
  process.env.NEX_LAB_PROMOTION_SECRET = s;
  log(`generated new promotion secret at ${SECRET_PATH}`);
  return s;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function callExecutor(client: any, room: string, promotion_id: string) {
  switch (room) {
    case "accommodation": return await executeAccommodationPromotion(client, promotion_id);
    case "food":          return await executeFoodPromotion(client, promotion_id);
    case "activities":    return await executeActivitiesPromotion(client, promotion_id);
    case "business":
    case "transport":     return await executeBusinessLeadPromotion(client, promotion_id);
    default: throw new Error(`no_executor_for_room:${room}`);
  }
}

async function promoteRoom(url: string, room: string, secret: string): Promise<{
  room: string; eligible: number; promotion_id: string | null; inserted: number; updated: number; skipped: number; errors: number; status: string;
}> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await client.connect();
  const schema = `nex_lab_${room}`;
  const target_schema = ROOM_TARGET_TABLE[room];
  try {
    // Count eligible (cross-source) rows
    const eligible = (await client.query(
      `SELECT count(*)::int c FROM ${schema}.verified WHERE source_count >= 2 AND field_name = 'identity'`,
    )).rows[0].c;
    log(`  ${room} eligible_cross_source=${eligible}`);
    if (eligible === 0) return { room, eligible: 0, promotion_id: null, inserted: 0, updated: 0, skipped: 0, errors: 0, status: "no_eligible" };
    if (DRY) return { room, eligible, promotion_id: null, inserted: 0, updated: 0, skipped: 0, errors: 0, status: "dry_run" };

    // 1. Create pending promotion_events row
    const brief_id = `auto-cross-${room}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    const propose = await client.query(
      `INSERT INTO nex_lab.promotion_events
         (brief_id, room_slug, target_schema, proposed_at_iso, status, metrics_snapshot, ui_merge_manifest)
       VALUES ($1, $2, $3, now(), 'pending', $4::jsonb, '{}'::jsonb)
       RETURNING promotion_id`,
      [brief_id, room, target_schema, JSON.stringify({ auto_cross_source: true, eligible_count: eligible })],
    );
    const promotion_id: string = propose.rows[0].promotion_id;

    // 2. Sign · sanity check (mirrors approvePromotion behaviour · fails
    //    fast if secret is misconfigured)
    const approved_at_iso = new Date().toISOString();
    const user_id = "system:nex-lab-promote";
    const sig = sign(`${brief_id}|${room}|${approved_at_iso}|${user_id}`, secret);

    // 3. BEGIN transaction · stage promotion_rows filtered to cross-source · run executor
    let inserted = 0, updated = 0, skipped = 0, errors: string[] = [];
    let rollbackSql = "";
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS nex_lab.promotion_rows (
          promotion_id UUID NOT NULL REFERENCES nex_lab.promotion_events(promotion_id),
          subject_ref  TEXT NOT NULL,
          promoted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (promotion_id, subject_ref)
        )
      `);
      // Only insert subject_refs where source_count >= 2 (the "auto-promote" gate)
      await client.query(
        `INSERT INTO nex_lab.promotion_rows (promotion_id, subject_ref)
         SELECT $1, subject_ref FROM ${schema}.verified
         WHERE source_count >= 2 AND field_name = 'identity'
         ON CONFLICT (promotion_id, subject_ref) DO NOTHING`,
        [promotion_id],
      );

      const execRes = await callExecutor(client, room, promotion_id);
      inserted = execRes.inserted;
      updated  = execRes.updated;
      skipped  = execRes.skipped;
      errors   = execRes.errors ?? [];

      // Cross-source verified rows are stronger than a raw seed · move
      // them from 'discovered' → 'listed' so the chat adapter's WHERE
      // claim_status IN ('listed','invited','claimed','paying') sees them.
      // Doctrine (ADR-0023): 'listed' means public seed · unclaimed · unverified
      // by the merchant themselves. Cross-source lab verification legitimately
      // clears the 'listed' bar.
      if (room === "accommodation") {
        const upd = await client.query(
          `UPDATE nex.accommodation_business
           SET claim_status = 'listed'
           WHERE verification_source = $1 AND claim_status = 'discovered'`,
          [`lab_promotion:${promotion_id}`],
        );
        log(`    accommodation claim_status listed<-discovered: ${upd.rowCount}`);
      } else if (room === "food") {
        try {
          const upd = await client.query(
            `UPDATE nex.food_business
             SET claim_status = 'listed'
             WHERE verification_source = $1 AND claim_status = 'discovered'`,
            [`lab_promotion:${promotion_id}`],
          );
          log(`    food claim_status listed<-discovered: ${upd.rowCount}`);
        } catch (e) { /* column may not exist on food_business · silent */ }
      }

      // B6b · Provenance rows so chat's TrustBand computation can see per-field lineage.
      // Every field we wrote to canonical gets one row in *_field_provenance with
      // trust_layer='nex_curated' (2+ independent providers agreed).
      if (room === "accommodation") {
        const provRes = await client.query(`
          INSERT INTO nex.accommodation_business_field_provenance
            (business_ref, field_name, trust_layer, written_at, written_by, source_reference, cycle_run_id)
          SELECT
            ab.public_listing_ref,
            fld.field_name,
            'nex_curated',
            now(),
            'agent:nex-lab-promote:cross-source',
            'lab_promotion:' || $1,
            $1::uuid
          FROM nex.accommodation_business ab
          CROSS JOIN (VALUES ('business_name'), ('category'), ('coordinates'), ('city'), ('address'), ('phone'), ('website'), ('claim_status')) AS fld(field_name)
          WHERE ab.verification_source = $2
          ON CONFLICT DO NOTHING
        `, [promotion_id, `lab_promotion:${promotion_id}`]);
        log(`    accommodation provenance rows written: ${provRes.rowCount}`);
      } else if (room === "business" || room === "transport") {
        // business_lead_directory_field_provenance has a different shape:
        // (lead_internal_id, field_name, field_value, source_layer, source_reference, confidence, recorded_at)
        try {
          const provRes = await client.query(`
            INSERT INTO nex.business_lead_directory_field_provenance
              (lead_internal_id, field_name, field_value, source_layer, source_reference, confidence, recorded_at, cycle_run_id)
            SELECT
              bld.internal_id,
              fld.field_name,
              to_jsonb(fld.field_name || '@' || bld.public_listing_ref),
              'lab_cross_source',
              'lab_promotion:' || $1,
              0.95,
              now(),
              $1::uuid
            FROM nex.business_lead_directory bld
            CROSS JOIN (VALUES ('business_name'), ('category'), ('coordinates'), ('city')) AS fld(field_name)
            WHERE bld.verification_source = $2
            ON CONFLICT DO NOTHING
          `, [promotion_id, `lab_promotion:${promotion_id}`]);
          log(`    ${room} provenance rows written: ${provRes.rowCount}`);
        } catch (e) { log(`    ${room} provenance skipped: ${String((e as Error).message).slice(0, 120)}`); }
      }

      // Rollback SQL (per-room · matches promotions.ts patterns)
      if (room === "accommodation") {
        rollbackSql = `DELETE FROM nex.accommodation_business WHERE verification_source = 'lab_promotion:${promotion_id}';
DELETE FROM nex_lab.promotion_rows WHERE promotion_id = '${promotion_id}';`;
      } else if (room === "food") {
        rollbackSql = `DELETE FROM nex.food_business WHERE verification_source = 'lab_promotion:${promotion_id}';
DELETE FROM nex_lab.promotion_rows WHERE promotion_id = '${promotion_id}';`;
      } else if (room === "activities") {
        rollbackSql = `DELETE FROM nex.brain_attractions WHERE verification_source = 'lab_promotion:${promotion_id}';
DELETE FROM nex_lab.promotion_rows WHERE promotion_id = '${promotion_id}';`;
      } else {
        rollbackSql = `DELETE FROM nex.business_lead_directory WHERE verification_source = 'lab_promotion:${promotion_id}';
DELETE FROM nex.business_lead_directory_field_provenance WHERE source_reference = 'lab_promotion:${promotion_id}';
DELETE FROM nex_lab.promotion_rows WHERE promotion_id = '${promotion_id}';`;
      }

      await client.query(
        `UPDATE nex_lab.promotion_events
         SET status='succeeded', approved_at_iso=$1, approved_by_user_id=$2,
             signature_hmac_sha256=$3, rows_promoted=$4, rollback_sql=$5
         WHERE promotion_id=$6`,
        [approved_at_iso, user_id, sig, inserted + updated, rollbackSql, promotion_id],
      );
      await client.query("COMMIT");
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
      await client.query(
        `UPDATE nex_lab.promotion_events SET status='failed', error_reason=$1 WHERE promotion_id=$2`,
        [String((err as Error).message).slice(0, 500), promotion_id],
      );
      log(`  ${room} FAILED · ${String((err as Error).message).slice(0, 200)}`);
      return { room, eligible, promotion_id, inserted: 0, updated: 0, skipped: 0, errors: 1, status: "failed" };
    }
    log(`  ${room} promoted · promotion_id=${promotion_id} · inserted=${inserted} updated=${updated} skipped=${skipped} err_count=${errors.length}`);
    if (errors.length > 0) for (const e of errors.slice(0, 5)) log(`    exec_err: ${String(e).slice(0, 200)}`);
    return { room, eligible, promotion_id, inserted, updated, skipped, errors: errors.length, status: "succeeded" };
  } finally { try { await client.end(); } catch { /* ignore */ } }
}

async function main() {
  const t0 = Date.now();
  const secret = ensureSecret();
  const url = readPgUrl();
  const rooms = CLI_ROOM ? [CLI_ROOM] : Object.keys(ROOM_TARGET_TABLE);
  log(`promote start · rooms=${rooms.join(",")} · dry=${DRY}`);
  const results: Awaited<ReturnType<typeof promoteRoom>>[] = [];
  for (const room of rooms) {
    try { results.push(await promoteRoom(url, room, secret)); }
    catch (err) { log(`  ${room} EXC · ${String((err as Error).message).slice(0, 200)}`); }
  }
  const totals = results.reduce((a, r) => ({
    eligible: a.eligible + r.eligible,
    inserted: a.inserted + r.inserted,
    updated:  a.updated  + r.updated,
    skipped:  a.skipped  + r.skipped,
    errors:   a.errors   + r.errors,
  }), { eligible: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 });
  log(`promote done · ${Date.now() - t0}ms · eligible=${totals.eligible} inserted=${totals.inserted} updated=${totals.updated} skipped=${totals.skipped} errors=${totals.errors}`);
}

main().catch((err) => { log(`fatal: ${String((err as Error).message).slice(0, 400)}`); process.exit(1); });
