// scripts/nex-transport-acquisition/_classify-existing-records.mjs
//
// Honest inspection: what ARE the current records in transport_acquisition_record?
// Reports by provider_kind, source_kind, phone-present, and heuristic
// "looks like an individual driver post" (name contains "driver"/"ojek"/"supir"
// AND phone present AND provider_kind != transport_business/fleet_operator).
//
// This is DIAGNOSTIC ONLY — writes nothing, changes nothing.

import pg from "pg";

const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new pg.Pool({ connectionString: url });

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  HONEST CLASSIFICATION · what are our current transport records?          ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  const total = await pool.query(`SELECT count(*)::int AS n FROM nex.transport_acquisition_record`);
  console.log(`Total records: ${total.rows[0].n}\n`);

  const byKind = await pool.query(`
    SELECT provider_kind, count(*)::int AS n
      FROM nex.transport_acquisition_record
     GROUP BY provider_kind
     ORDER BY n DESC
  `);
  console.log("── by provider_kind ─────────────────────────────");
  for (const r of byKind.rows) console.log(`  ${String(r.provider_kind).padEnd(24)} ${r.n}`);
  console.log();

  const bySource = await pool.query(`
    SELECT ss.source_kind, count(DISTINCT ss.provider_id)::int AS providers
      FROM nex.transport_acquisition_source_snapshot ss
     GROUP BY ss.source_kind
     ORDER BY providers DESC
  `);
  console.log("── by source_kind (distinct providers) ─────────");
  for (const r of bySource.rows) console.log(`  ${String(r.source_kind).padEnd(38)} ${r.providers}`);
  console.log();

  const phones = await pool.query(`
    SELECT
      count(*) FILTER (WHERE canonical_phone_e164 IS NOT NULL)::int AS with_phone,
      count(*) FILTER (WHERE canonical_phone_e164 IS NULL)::int     AS no_phone,
      count(*) FILTER (WHERE public_whatsapp_link IS NOT NULL)::int AS with_wa_link
    FROM nex.transport_acquisition_record
  `);
  console.log("── contact evidence ────────────────────────────");
  console.log(`  with canonical E.164 phone : ${phones.rows[0].with_phone}`);
  console.log(`  with public wa.me link     : ${phones.rows[0].with_wa_link}`);
  console.log(`  no phone / no WA           : ${phones.rows[0].no_phone}\n`);

  const looksIndividual = await pool.query(`
    SELECT count(*)::int AS n
      FROM nex.transport_acquisition_record
     WHERE canonical_phone_e164 IS NOT NULL
       AND (
         business_name ILIKE '%driver%' OR
         business_name ILIKE '%ojek%'   OR
         business_name ILIKE '%supir%'  OR
         contact_person_name IS NOT NULL
       )
       AND provider_kind NOT IN ('transport_business','fleet_operator','courier_operator','logistics_operator')
  `);
  console.log("── heuristic: LOOKS like individual driver post ─");
  console.log(`  (phone present + name signals individual + kind not business)`);
  console.log(`  count: ${looksIndividual.rows[0].n}\n`);

  const sample = await pool.query(`
    SELECT provider_id, provider_kind, business_name, canonical_phone_e164,
           home_jurisdiction, vehicle_types, first_discovered_at
      FROM nex.transport_acquisition_record
     ORDER BY first_discovered_at DESC
     LIMIT 10
  `);
  console.log("── most recent 10 records (sample) ─────────────");
  for (const r of sample.rows) {
    console.log(`  [${String(r.provider_kind).padEnd(22)}] ${(r.business_name ?? "(no name)").slice(0, 46).padEnd(46)}  phone=${r.canonical_phone_e164 ?? "-"}  vehicles=${JSON.stringify(r.vehicle_types)}`);
  }
  console.log();

  const honestConclusion = looksIndividual.rows[0].n;
  const totalN = total.rows[0].n;
  console.log("═══════════════════════════════════════════════════");
  console.log("HONEST CONCLUSION");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Total transport records         : ${totalN}`);
  console.log(`Likely individual-driver posts  : ${honestConclusion}`);
  console.log(`Likely businesses/operators     : ${totalN - honestConclusion}`);
  console.log(``);
  console.log(`These ${totalN} records should NOT be described as "${totalN} drivers".`);
  console.log(`They are discovered transport-related entities. The individual-driver`);
  console.log(`population (personal WA-only posts like "Saya driver Jogja · WA 08xxx")`);
  console.log(`is still largely undiscovered because OSM/Nominatim do not surface them.`);

  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
