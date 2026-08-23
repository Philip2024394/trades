#!/usr/bin/env node
// scripts/nex-factory/annotate-candidate.mjs
//
// Directory Factory · Calibration Harness · human annotation writer.
//
// Records "if I saw this candidate today, what tier would I assign?"
// verdicts to nex.category_candidate_calibration_annotation. Independent
// of admin_decision — this is calibration observation, not the real
// approval workflow.
//
// Usage:
//   node --env-file=.env.local scripts/nex-factory/annotate-candidate.mjs \
//     --candidate-id=<uuid> \
//     --verdict=HIGH|MEDIUM|LOW|SKIP \
//     --annotator=<name> \
//     [--reason="<free text>"]
//
// Batch mode (multiple --annotate flags):
//   node --env-file=.env.local scripts/nex-factory/annotate-candidate.mjs \
//     --annotator=philip@nex \
//     --annotate=<uuid1>:LOW:"parent-overlap" \
//     --annotate=<uuid2>:LOW:"parent-overlap"

import pg from "pg";

const ALLOWED_VERDICTS = new Set(["HIGH", "MEDIUM", "LOW", "SKIP"]);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { batch: [] };
  for (const a of args) {
    if (a.startsWith("--candidate-id=")) opts.candidateId = a.split("=")[1];
    else if (a.startsWith("--verdict="))    opts.verdict     = a.split("=")[1];
    else if (a.startsWith("--annotator="))  opts.annotator   = a.split("=")[1];
    else if (a.startsWith("--reason="))     opts.reason      = a.slice("--reason=".length);
    else if (a.startsWith("--annotate=")) {
      const raw = a.slice("--annotate=".length);
      const [id, verdict, ...rest] = raw.split(":");
      opts.batch.push({ id, verdict, reason: rest.join(":") });
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const rows = opts.batch.length > 0
    ? opts.batch.map((b) => ({ candidateId: b.id, verdict: b.verdict, reason: b.reason }))
    : [{ candidateId: opts.candidateId, verdict: opts.verdict, reason: opts.reason }];

  if (!opts.annotator) {
    console.error("--annotator=<name> required");
    process.exit(1);
  }

  for (const r of rows) {
    if (!r.candidateId) { console.error("missing candidate id"); process.exit(1); }
    if (!ALLOWED_VERDICTS.has(r.verdict)) {
      console.error(`invalid verdict "${r.verdict}" · allowed: ${[...ALLOWED_VERDICTS].join(", ")}`);
      process.exit(1);
    }
  }

  let inserted = 0;
  for (const r of rows) {
    const res = await pool.query(
      `INSERT INTO nex.category_candidate_calibration_annotation
         (candidate_id, annotator, verdict, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, candidate_id`,
      [r.candidateId, opts.annotator, r.verdict, r.reason ?? null],
    );
    console.log(`  annotated ${res.rows[0].candidate_id} · verdict=${r.verdict} · annotator=${opts.annotator}`);
    inserted += 1;
  }

  console.log(`\n${inserted} annotation${inserted === 1 ? "" : "s"} recorded.`);
  await pool.end();
}

main().catch((err) => {
  console.error(`FATAL: ${err?.stack ?? err}`);
  process.exit(1);
});
