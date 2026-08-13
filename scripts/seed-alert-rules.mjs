// scripts/seed-alert-rules.mjs
//
// Seeds the 10 starter alert rules documented in
// docs/operations/ALERT-RULES.md. Idempotent per rule: existing rules
// with the same (counter_name, comparison) are updated in place rather
// than duplicated.
//
// USAGE
//   NEX_APP_URL=https://your-domain \
//   CRON_SECRET=... \
//   node scripts/seed-alert-rules.mjs
//
//   Add DRY_RUN=1 to see what would be written without POST/PATCH-ing.
//
// EXIT CODES
//   0 · all rules present (created or updated)
//   1 · one or more operations failed

const NEX_APP_URL = process.env.NEX_APP_URL ?? "http://localhost:3008";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const DRY_RUN     = process.env.DRY_RUN === "1";

if (!CRON_SECRET && !DRY_RUN) {
  console.warn("[seed-alert-rules] CRON_SECRET not set — API calls will 401 in production");
}

const HEADERS = { "Authorization": `Bearer ${CRON_SECRET}`, "Content-Type": "application/json" };
const BASE    = `${NEX_APP_URL}/api/nex/observability/alert-rules`;

const STARTER_RULES = [
  { counter_name: "cron_tick.fired",             comparison: "lt", threshold: 1,   window_seconds: 180,  severity: "p0", description: "Cron stopped firing for 3 min" },
  { counter_name: "cron_tick.failed",            comparison: "gt", threshold: 3,   window_seconds: 300,  severity: "p1", description: "3+ cron failures in 5 min" },
  { counter_name: "shadow.mirror_failed",        comparison: "gt", threshold: 10,  window_seconds: 300,  severity: "p1", description: "Reverse-shadow drift risk" },
  { counter_name: "audit.emit_dropped",          comparison: "gt", threshold: 0,   window_seconds: 300,  severity: "p1", description: "Audit trail losing rows" },
  { counter_name: "manager.inbox_read_degraded", comparison: "gt", threshold: 1,   window_seconds: 300,  severity: "p1", description: "Inbox degraded > once" },
  { counter_name: "router.route_failed",         comparison: "gt", threshold: 5,   window_seconds: 300,  severity: "p2", description: "Routing errors accumulating" },
  { counter_name: "inbox.enqueue_failed",        comparison: "gt", threshold: 3,   window_seconds: 300,  severity: "p1", description: "Cannot enqueue new work" },
  { counter_name: "jobs.create_failed",          comparison: "gt", threshold: 3,   window_seconds: 300,  severity: "p1", description: "Cannot create worker jobs" },
  { counter_name: "analytics.rollup_failed",     comparison: "gt", threshold: 5,   window_seconds: 600,  severity: "p2", description: "D6 worker degraded (async mode)" },
  { counter_name: "validate.row_dropped",        comparison: "gt", threshold: 100, window_seconds: 3600, severity: "p2", description: "High rate of malformed input" },
];

async function loadExisting() {
  const res = await fetch(BASE, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`GET ${BASE} · ${res.status} · ${await res.text().catch(() => "")}`);
  }
  const body = await res.json();
  return Array.isArray(body?.rules) ? body.rules : [];
}

function matchExisting(existing, wanted) {
  return existing.find((r) => r.counter_name === wanted.counter_name && r.comparison === wanted.comparison) ?? null;
}

async function createOne(rule) {
  if (DRY_RUN) return { ok: true, rule: { ...rule, rule_id: "(dry-run)" } };
  const res = await fetch(BASE, { method: "POST", headers: HEADERS, body: JSON.stringify({ ...rule, enabled: true, channels: [], created_by: "seed-alert-rules.mjs" }) });
  if (!res.ok) throw new Error(`POST · ${res.status} · ${await res.text().catch(() => "")}`);
  return await res.json();
}

async function updateOne(id, rule) {
  if (DRY_RUN) return { ok: true, rule: { ...rule, rule_id: id } };
  const res = await fetch(`${BASE}/${id}`, { method: "PATCH", headers: HEADERS, body: JSON.stringify(rule) });
  if (!res.ok) throw new Error(`PATCH ${id} · ${res.status} · ${await res.text().catch(() => "")}`);
  return await res.json();
}

async function main() {
  console.log(`seed-alert-rules · target=${BASE} · dry_run=${DRY_RUN}`);
  let existing = [];
  try { existing = await loadExisting(); }
  catch (e) { console.error("failed to load existing rules:", e.message); process.exit(1); }

  const summary = { created: 0, updated: 0, unchanged: 0, failed: 0 };

  for (const wanted of STARTER_RULES) {
    const found = matchExisting(existing, wanted);
    try {
      if (!found) {
        await createOne(wanted);
        console.log(`  CREATE · ${wanted.counter_name} ${wanted.comparison} ${wanted.threshold}`);
        summary.created += 1;
      } else {
        const same = ["threshold", "window_seconds", "severity", "description"].every((k) => String(found[k]) === String(wanted[k]));
        if (same) {
          console.log(`  KEEP   · ${wanted.counter_name} · already matches`);
          summary.unchanged += 1;
        } else {
          await updateOne(found.rule_id, wanted);
          console.log(`  UPDATE · ${wanted.counter_name} · ${found.rule_id}`);
          summary.updated += 1;
        }
      }
    } catch (e) {
      console.error(`  FAIL   · ${wanted.counter_name} · ${e.message}`);
      summary.failed += 1;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("runner exception:", e); process.exit(1); });
