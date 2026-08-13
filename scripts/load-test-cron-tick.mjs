// scripts/load-test-cron-tick.mjs
//
// D11 · Load test for /api/nex/brain/cron-tick.
//
// Fires N concurrent GET requests over T seconds and reports latency
// percentiles + error rate. Not a replacement for real production
// monitoring — this is a smoke-under-load sanity check.
//
// USAGE
//   node scripts/load-test-cron-tick.mjs
//     defaults: 100 requests over 60 seconds against http://localhost:3008
//
//   NEX_APP_URL=https://your-domain \
//   CRON_SECRET=... \
//   REQ_COUNT=200 REQ_WINDOW_SEC=60 \
//   node scripts/load-test-cron-tick.mjs
//
// EXIT CODES
//   0 · P99 within budget (default: 5000 ms) AND zero errors
//   1 · P99 exceeds budget OR any error
//
// GUARDRAILS
//   · Read-only from the caller's perspective. cron-tick itself dispatches
//     jobs and runs a manager cycle — running this against production
//     during peak hours could cause noticeable queue churn. Prefer to run
//     against a preview/staging URL or during quiet hours.

const NEX_APP_URL      = process.env.NEX_APP_URL      ?? "http://localhost:3008";
const CRON_SECRET      = process.env.CRON_SECRET      ?? "";
const REQ_COUNT        = Number(process.env.REQ_COUNT ?? 100);
const REQ_WINDOW_SEC   = Number(process.env.REQ_WINDOW_SEC ?? 60);
const P99_BUDGET_MS    = Number(process.env.P99_BUDGET_MS ?? 5000);

const url = `${NEX_APP_URL}/api/nex/brain/cron-tick`;
const headers = CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {};

function pctl(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.floor((sortedAsc.length - 1) * p);
  return sortedAsc[idx];
}

async function fireOne(idx) {
  const started = Date.now();
  try {
    const res = await fetch(url, { method: "GET", headers });
    const elapsed = Date.now() - started;
    return { idx, ok: res.ok, status: res.status, ms: elapsed };
  } catch (err) {
    const elapsed = Date.now() - started;
    return { idx, ok: false, status: 0, ms: elapsed, err: String(err instanceof Error ? err.message : err) };
  }
}

async function main() {
  const spacing = (REQ_WINDOW_SEC * 1000) / REQ_COUNT;
  console.log(`load-test-cron-tick · ${REQ_COUNT} requests over ${REQ_WINDOW_SEC}s (~${spacing.toFixed(0)}ms apart) to ${url}`);

  const results = [];
  const runStart = Date.now();

  for (let i = 0; i < REQ_COUNT; i++) {
    const target = runStart + i * spacing;
    const now = Date.now();
    if (target > now) await new Promise((r) => setTimeout(r, target - now));
    results.push(fireOne(i));
  }

  const done = await Promise.all(results);
  const durations = done.map((r) => r.ms).sort((a, b) => a - b);
  const errors = done.filter((r) => !r.ok);

  const summary = {
    count: done.length,
    ok: done.length - errors.length,
    errors: errors.length,
    latency_ms: {
      min: durations[0],
      p50: pctl(durations, 0.50),
      p90: pctl(durations, 0.90),
      p99: pctl(durations, 0.99),
      max: durations[durations.length - 1],
    },
    total_wall_seconds: Number(((Date.now() - runStart) / 1000).toFixed(1)),
    p99_budget_ms: P99_BUDGET_MS,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (errors.length > 0) {
    console.error(`FAIL · ${errors.length} error(s)`);
    console.error(errors.slice(0, 5));
    process.exit(1);
  }
  if (summary.latency_ms.p99 > P99_BUDGET_MS) {
    console.error(`FAIL · P99 ${summary.latency_ms.p99}ms exceeds budget ${P99_BUDGET_MS}ms`);
    process.exit(1);
  }
  console.log(`PASS · P99 ${summary.latency_ms.p99}ms within budget ${P99_BUDGET_MS}ms · zero errors`);
  process.exit(0);
}

main().catch((e) => {
  console.error("runner exception:", e);
  process.exit(2);
});
