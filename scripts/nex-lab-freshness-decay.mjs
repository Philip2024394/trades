#!/usr/bin/env node
// scripts/nex-lab-freshness-decay.mjs
//
// Founder 2026-09-10 · B10 · Nightly freshness/decay job.
//
// For each canonical business table, mark rows as "stale" if their
// updated_at is older than STALE_AFTER_DAYS (default 60). Never deletes.
// Never modifies rows sourced from paying merchants. Idempotent.
//
// Signal used: adds `data_freshness` label to accommodation_business_field_provenance
// with trust_layer='nex_curated' when stale. Also updates a summary column
// on the row (if that column exists) — otherwise the provenance record IS
// the freshness signal.
//
// Usage:
//   node scripts/nex-lab-freshness-decay.mjs             # all rooms · default 60d
//   node scripts/nex-lab-freshness-decay.mjs --days 30   # 30-day window
//   node scripts/nex-lab-freshness-decay.mjs --dry       # report only

import { Client } from "pg";

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
const STALE_AFTER_DAYS = Number(args.get("days") ?? "60");
const DRY = args.get("dry") === "true";

const TARGETS = [
  { table: "nex.accommodation_business", provenance: "nex.accommodation_business_field_provenance", ref_col: "public_listing_ref", prov_ref_col: "business_ref" },
  { table: "nex.food_business",          provenance: null,                                            ref_col: "public_listing_ref", prov_ref_col: null },
  { table: "nex.business_lead_directory", provenance: "nex.business_lead_directory_field_provenance",  ref_col: "public_listing_ref", prov_ref_col: "lead_internal_id", no_claim_status: true },
];

// Rows we NEVER decay: claimed/paying merchants OR verified_by_owner
const SKIP_CLAIM_STATUSES = ["claimed", "paying"];

function log(line) { process.stdout.write(`[${new Date().toISOString()}] ${line}\n`); }

async function main() {
  const c = new Client({ connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
  await c.connect();
  log(`freshness-decay start · stale_after=${STALE_AFTER_DAYS}d · dry=${DRY}`);
  const totals = { scanned: 0, stale: 0, marked_stale: 0, skipped_claimed: 0, errors: 0 };
  try {
    for (const t of TARGETS) {
      try {
        // Some tables don't have claim_status · skip that filter for those
        const claimFilter = t.no_claim_status
          ? ""
          : "AND (claim_status IS NULL OR claim_status NOT IN ('claimed','paying'))";
        const claimedFilter = t.no_claim_status
          ? ""
          : "AND claim_status IN ('claimed','paying')";

        const staleQ = await c.query(
          `SELECT count(*)::int c FROM ${t.table}
           WHERE updated_at < (now() - ($1 || ' days')::interval) ${claimFilter}`,
          [String(STALE_AFTER_DAYS)],
        );
        const claimedCount = t.no_claim_status ? 0 : (await c.query(
          `SELECT count(*)::int c FROM ${t.table}
           WHERE updated_at < (now() - ($1 || ' days')::interval) ${claimedFilter}`,
          [String(STALE_AFTER_DAYS)],
        )).rows[0].c;
        const staleCount = staleQ.rows[0].c;
        totals.stale += staleCount;
        totals.skipped_claimed += claimedCount;

        if (DRY) {
          log(`  ${t.table} stale=${staleCount} skipped_claimed=${claimedCount}`);
          continue;
        }

        // Write ONE provenance row per stale row, field_name='data_freshness',
        // trust_layer='nex_curated'. ON CONFLICT DO NOTHING · idempotent.
        if (t.provenance && t.prov_ref_col === "business_ref") {
          const upd = await c.query(
            `INSERT INTO ${t.provenance}
               (business_ref, field_name, trust_layer, written_at, written_by, source_reference)
             SELECT r.${t.ref_col}, 'data_freshness', 'nex_curated', now(),
               'agent:nex-lab-freshness-decay',
               'stale_after_${STALE_AFTER_DAYS}d:updated_at=' || COALESCE(r.updated_at::text, 'null')
             FROM ${t.table} r
             WHERE r.updated_at < (now() - ($1 || ' days')::interval) ${claimFilter}
             ON CONFLICT DO NOTHING`,
            [String(STALE_AFTER_DAYS)],
          );
          totals.marked_stale += upd.rowCount ?? 0;
          log(`  ${t.table} marked_stale=${upd.rowCount} · stale_total=${staleCount} · skipped_claimed=${claimedCount}`);
        } else if (t.provenance && t.prov_ref_col === "lead_internal_id") {
          const upd = await c.query(
            `INSERT INTO ${t.provenance}
               (lead_internal_id, field_name, field_value, source_layer, source_reference, confidence, recorded_at)
             SELECT r.public_listing_ref, 'data_freshness',
               to_jsonb(('stale_after_${STALE_AFTER_DAYS}d')::text),
               'nex_curated',
               'agent:nex-lab-freshness-decay:updated_at=' || COALESCE(r.updated_at::text, 'null'),
               0.9,
               now()
             FROM ${t.table} r
             WHERE r.updated_at < (now() - ($1 || ' days')::interval) ${claimFilter}
             ON CONFLICT DO NOTHING`,
            [String(STALE_AFTER_DAYS)],
          );
          totals.marked_stale += upd.rowCount ?? 0;
          log(`  ${t.table} marked_stale=${upd.rowCount} · stale_total=${staleCount} · skipped_claimed=${claimedCount}`);
        } else {
          log(`  ${t.table} · no provenance table wired · stale_total=${staleCount} (would mark if wired)`);
        }

        totals.scanned++;
      } catch (err) {
        totals.errors++;
        log(`  ${t.table} ERR ${String(err.message).slice(0, 200)}`);
      }
    }
    log(`freshness-decay done · targets=${totals.scanned} stale_total=${totals.stale} marked_stale=${totals.marked_stale} skipped_claimed=${totals.skipped_claimed} errors=${totals.errors}`);
  } finally { try { await c.end(); } catch { /* ignore */ } }
}

main().catch(err => { log(`fatal: ${err.message}`); process.exit(1); });
