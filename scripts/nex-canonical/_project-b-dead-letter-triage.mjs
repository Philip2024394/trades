// scripts/nex-canonical/_project-b-dead-letter-triage.mjs
// Read-only · classify the 16 dead-lettered harvest jobs + the 147 stalled
// candidates on Project B. SET default_transaction_read_only = on.

import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL unset (use --env-file=.env.harvest.local)"); process.exit(1); }

const client = new pg.Client({
  connectionString: url,
  ssl: /supabase\.(co|com)/i.test(url) ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
await client.query("SET default_transaction_read_only = on");

const out = {};
const q = async (label, sql) => {
  try { out[label] = { ok: true, rows: (await client.query(sql)).rows }; }
  catch (e) { out[label] = { ok: false, error: String(e.message || e).slice(0, 300) }; }
};

// Shape probe · what columns exist on harvest_job?
await q("harvest_job_columns", `
  SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='nex' AND table_name='harvest_job' ORDER BY ordinal_position;
`);
await q("harvest_candidate_columns", `
  SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='nex' AND table_name='harvest_business_candidate' ORDER BY ordinal_position;
`);

// Dead-letter per-job detail · aggregate by error pattern + job_type to see root cause.
await q("dead_letter_per_job", `
  SELECT * FROM nex.harvest_job
   WHERE status = 'dead_letter'
   ORDER BY updated_at DESC
   LIMIT 20;
`);
await q("dead_letter_error_patterns", `
  SELECT
    LEFT(COALESCE(last_error, ''), 120) AS first120,
    COUNT(*)::bigint                     AS n
    FROM nex.harvest_job
   WHERE status = 'dead_letter'
   GROUP BY LEFT(COALESCE(last_error, ''), 120)
   ORDER BY n DESC;
`);

// Completed-job types to understand what IS working.
await q("completed_by_job_type", `
  SELECT job_type, COUNT(*)::bigint AS n
    FROM nex.harvest_job
   WHERE status = 'completed'
   GROUP BY job_type
   ORDER BY n DESC;
`);
await q("harvest_job_by_type_status", `
  SELECT job_type, status, COUNT(*)::bigint AS n
    FROM nex.harvest_job
   GROUP BY job_type, status
   ORDER BY job_type, status;
`);

// Timing · when did the pipeline last do anything?
await q("harvest_job_timing", `
  SELECT MIN(created_at) AS first_job, MAX(created_at) AS last_job,
         MIN(updated_at) AS first_update, MAX(updated_at) AS last_update
    FROM nex.harvest_job;
`);

// What are the 147 candidates? Sampling head/tail by created_at.
await q("candidate_recent", `
  SELECT * FROM nex.harvest_business_candidate
   ORDER BY internal_id DESC
   LIMIT 5;
`);
await q("candidate_by_source", `
  SELECT source, COUNT(*)::bigint AS n
    FROM nex.harvest_business_candidate
   GROUP BY source
   ORDER BY n DESC;
`);

await client.end();
console.log(JSON.stringify(out, null, 2));
