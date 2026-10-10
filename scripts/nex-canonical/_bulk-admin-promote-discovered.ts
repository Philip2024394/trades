// scripts/nex-canonical/_bulk-admin-promote-discovered.ts
//
// Bulk admin-promote every nex.business_canonical row currently in
// lifecycle_state='DISCOVERED' to 'VERIFIED', using the sealed
// admin-promote-lifecycle planAdminPromotion + executeAdminPromotion
// path · one call per canonical · each call opens its own transaction
// so one failure does not block the batch.
//
// Admin-attested basis: these canonicals were written through the
// sealed write-approved-candidates path (which only acts on candidates
// explicitly approved via bulk-approve-runner's DecisionRecord). The
// decision log is their provenance.
//
// Idempotent: the sealed planner refuses promotion if lifecycle_state
// is not DISCOVERED, so re-running is safe.

import pg from "pg";
import { planAdminPromotion, executeAdminPromotion } from "./admin-promote-lifecycle";

async function main(): Promise<number> {
  const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
  await client.connect();
  await client.query("SET default_transaction_read_only = on");

  const r = await client.query(`
    SELECT canonical_business_id, lifecycle_state, name_canonical, city
      FROM nex.business_canonical
     WHERE lifecycle_state = 'DISCOVERED'
       AND name_canonical <> 'SYNTHETIC NEX FIRST LIVE WRITE PROOF 2026-10-08'
     ORDER BY created_at DESC
  `);
  const discovered = r.rows;
  await client.end();

  console.log(`found ${discovered.length} canonicals in DISCOVERED state`);
  if (discovered.length === 0) return 0;

  let ok = 0;
  let failed = 0;
  const failures: Array<{ id: string; name: string; reason: string }> = [];
  const now = new Date();

  for (let i = 0; i < discovered.length; i++) {
    const row = discovered[i];
    if (i > 0 && i % 50 === 0) console.log(`   progress ${i}/${discovered.length}`);
    try {
      const plan = planAdminPromotion({
        canonical_business_id: row.canonical_business_id,
        current_lifecycle_state: "DISCOVERED",
        target_lifecycle_state: "VERIFIED",
        admin_id: "philip",
        transition_reason: "admin_verify",
        now,
      });
      if (!plan.ok) {
        failed++;
        failures.push({ id: row.canonical_business_id, name: row.name_canonical, reason: (plan as { ok: false; reason: string }).reason });
        continue;
      }
      const result = await executeAdminPromotion({
        plan: plan.plan,
        connectionString: process.env.NEX_POSTGRES_URL!,
      });
      if (!result.ok) {
        failed++;
        failures.push({ id: row.canonical_business_id, name: row.name_canonical, reason: (result as { ok: false; reason?: string }).reason ?? "unknown" });
        continue;
      }
      ok++;
    } catch (e) {
      failed++;
      failures.push({ id: row.canonical_business_id, name: row.name_canonical, reason: String((e as Error).message || e).slice(0, 200) });
    }
  }

  console.log(JSON.stringify({ promoted: ok, failed, sample_failures: failures.slice(0, 5) }, null, 2));
  return failed > 0 && ok === 0 ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error("unexpected error:", (e as Error).message);
  process.exit(99);
});
