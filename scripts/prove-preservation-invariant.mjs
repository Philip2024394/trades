// scripts/prove-preservation-invariant.mjs
// Read-only · confirms the 10 preserved fixture kjids remain claimed/0/null.
// Zero writes · zero side effects.
import pg from "pg";
const PRESERVED = [
  "46a8eb51-617c-404b-8237-6a515ad6125a","56e1da78-6a97-461a-bc38-cc505d25e00a","ab5835b8-05c8-485e-b1ef-399fe9a48b0a",
  "47e0cf43-5e4c-4d69-a509-59e232e141f1","7fc668ef-cbbc-42a4-b2ef-16e1cde41680","270865e6-f2ca-4fc0-8648-151417c85f64",
  "b1772902-7348-49cd-aed4-48d221ea2d69","1e09c119-f9ed-4400-9dc7-722fc7ae223d","6381641c-eb29-4007-8f3c-2942933cb62d",
  "7e1fc4f9-efb5-4892-8d55-51b347babe1c",
];
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 1 });
const q = await pool.query(
  `SELECT job_id, status, progress, completion_result FROM nex.knowledge_dump_jobs WHERE job_id = ANY($1::text[]) ORDER BY job_id`,
  [PRESERVED],
);
let bad = 0;
for (const r of q.rows) {
  const ok = r.status === "claimed" && Number(r.progress) === 0 && r.completion_result === null;
  console.log(`${ok ? "✓" : "✗"} ${r.job_id.slice(0,8)} · status=${r.status} · progress=${r.progress} · completion_result=${JSON.stringify(r.completion_result)}`);
  if (!ok) bad++;
}
console.log(`\ntotal=${q.rows.length}/10 · violations=${bad}`);
await pool.end();
process.exit(bad === 0 && q.rows.length === 10 ? 0 : 2);
