// scripts/nex-canonical/_source-audit.mjs
// Read-only audit of source attribution + evidence citations on local nex_dev.

import pg from "pg";
const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
await client.connect();
await client.query("SET default_transaction_read_only = on");
const out = {};
async function q(label, sql) {
  try { out[label] = { ok: true, rows: (await client.query(sql)).rows }; }
  catch (e) { out[label] = { ok: false, error: String(e.message || e).slice(0, 300) }; }
}

// Which source_id does each of the 8 evidence rows cite?
await q("evidence_sources", `
  SELECT source_id, COUNT(*)::bigint AS n
    FROM nex.business_evidence
   GROUP BY source_id
   ORDER BY n DESC, source_id;
`);

// Full source_registry row shape so we can see every column, not just the 4 I probed earlier.
await q("source_registry_full_columns", `
  SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='nex' AND table_name='source_registry' ORDER BY ordinal_position;
`);
await q("source_registry_full", `
  SELECT *
    FROM nex.source_registry
   ORDER BY source_id;
`);

// Which migration most-recently touched any source_registry row (via updated_at if present).
// If migration columns record a provenance, show it.

await client.end();
console.log(JSON.stringify(out, null, 2));
