// C9 · READ-ONLY Project B verification · confirms Section 21 invariants unchanged.
// Uses Supabase Mgmt API. Zero mutations.

import { readFileSync } from "node:fs";
const envTools = readFileSync(".env.tools.local", "utf8");
const TOKEN = envTools.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF   = envTools.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (r.status >= 400) throw new Error(`mgmt ${r.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

const rows = await q(`
  SELECT
    (SELECT count(*)::int FROM nex.food_business)                                       AS food_rows,
    (SELECT count(*)::int FROM (SELECT source_reference FROM nex.food_business WHERE source='osm_overpass' GROUP BY source_reference HAVING count(*)>1) x) AS dup,
    (SELECT count(*)::int FROM nex_workforce.city_catalogue)                            AS cc,
    (SELECT count(*)::int FROM nex_workforce.job_registry)                              AS jr,
    (SELECT count(*)::int FROM nex_workforce.work_item)                                 AS wi,
    (SELECT count(*)::int FROM nex_workforce.work_item WHERE state IN ('pending','leased')) AS wi_active,
    (SELECT count(*)::int FROM nex_workforce.evidence_record)                           AS ev,
    (SELECT count(*)::int FROM nex_workforce.candidate_staging)                         AS stg,
    (SELECT count(*)::int FROM nex_workforce.persist_audit)                             AS aud,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'nex_workforce')          AS wf_pol,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'food_business') AS food_pol,
    (SELECT count(*)::int FROM pg_roles WHERE rolname LIKE 'nex_workforce_%')           AS roles,
    (SELECT count(*)::int FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business'
        AND pg_get_functiondef(p.oid) LIKE '%v_wi_row.city_slug%')                      AS r5_intact
`);
console.log(JSON.stringify(rows[0], null, 2));
