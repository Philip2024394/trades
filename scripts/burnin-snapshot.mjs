#!/usr/bin/env node
// scripts/burnin-snapshot.mjs
//
// NEX Workforce · 24-hour burn-in observation snapshot.
//
// READ-ONLY observation harness for the 24-hour burn-in test.
// Nothing in this script writes to Postgres, mutates worker state,
// modifies migrations, changes config, or touches worker code. It
// only observes.
//
// Captures, at each checkpoint (T+0 · T+6h · T+12h · T+24h):
//   · Workforce counters from GET /api/nex/brain/status (existing)
//   · Preservation invariant · the 10 protected KJs must stay
//     claimed / progress=0 / completion_result=null
//   · Stuck-claimed KJ count (excluding the protected 10)
//   · Terminal state histogram · nex.knowledge_dump_jobs by status
//   · High-attempt worker_jobs count (attempts >= 5) as retry-exhaustion proxy
//   · nex.audit_log total row count
//   · Node process RSS (Next server + worker script) via PowerShell
//   · data/nex-jobs/jobs.jsonl size + line count
//   · burn-in log file sizes (server.log · worker.log)
//
// Usage (dev/local · reads NEX_POSTGRES_URL from .env.local):
//   node --env-file=.env.local scripts/burnin-snapshot.mjs
//
// Writes: data/burnin/snapshot-<ISO-timestamp>.json
//
// Exit codes:
//   0 · snapshot captured AND preservation invariant intact
//   2 · preservation invariant broken · emergency halt condition
//   3 · observation error · snapshot may be incomplete
//
// SAFETY
//   · Uses SET LOCAL ROLE nex_brain_app to match app-side role posture
//   · Statement timeout capped at 20s
//   · Two connections max · closes pool on every run
//   · No SELECT ... FOR UPDATE · no INSERT/UPDATE/DELETE

import { readFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// The 10 preserved KJs — MUST remain claimed / 0 / null throughout the
// 24h burn-in. This list is intentionally hard-coded to match
// scripts/prove-supervisor-review.ts::PRESERVED_KJIDS · if either drifts
// out of sync the test loses meaning · keep them equal.
const PRESERVED_KJIDS = [
  "46a8eb51-617c-404b-8237-6a515ad6125a",
  "56e1da78-6a97-461a-bc38-cc505d25e00a",
  "ab5835b8-05c8-485e-b1ef-399fe9a48b0a",
  "47e0cf43-5e4c-4d69-a509-59e232e141f1",
  "7fc668ef-cbbc-42a4-b2ef-16e1cde41680",
  "270865e6-f2ca-4fc0-8648-151417c85f64",
  "b1772902-7348-49cd-aed4-48d221ea2d69",
  "1e09c119-f9ed-4400-9dc7-722fc7ae223d",
  "6381641c-eb29-4007-8f3c-2942933cb62d",
  "7e1fc4f9-efb5-4892-8d55-51b347babe1c",
];

const BASE_URL = process.env.NEX_BRAIN_URL || "http://localhost:3008";
const PG_URL = process.env.NEX_POSTGRES_URL;
const HIGH_ATTEMPT_THRESHOLD = 5; // matches default max_attempts in brain/llm.ts

function nowIso() { return new Date().toISOString(); }

function fileStat(path) {
  try {
    const st = statSync(path);
    return { exists: true, size_bytes: st.size, mtime: st.mtime.toISOString() };
  } catch { return { exists: false, size_bytes: 0, mtime: null }; }
}

function lineCount(path) {
  try {
    const data = readFileSync(path, "utf8");
    if (data.length === 0) return 0;
    return data.split("\n").filter((l) => l.length > 0).length;
  } catch { return null; }
}

async function fetchStatus() {
  const res = await fetch(`${BASE_URL}/api/nex/brain/status`, { method: "GET" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`status endpoint HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const j = await res.json();
  if (!j.ok) throw new Error(`status endpoint returned ok=false`);
  return j.status;
}

// ─────────────────────────────────────────────────────────────────
// Truth-Law burn-in evidence capture · 2026-08-10 · Philip GO.
//
// Every helper below returns a "section" object with { endpoint,
// ok, ...raw fields, error? }. The captured shape mirrors the raw
// endpoint response · we do NOT interpret · we do NOT add verdict
// booleans like "healthy". The rule is:
//
//   observations → evidence → verdict (deferred to analysis time)
//
// If an endpoint fails or returns non-ok, we record the failure and
// keep going · subsequent snapshots will show whether the gap was
// transient or persistent.
// ─────────────────────────────────────────────────────────────────

async function fetchJsonSection(endpoint, defaultShape) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { method: "GET", cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j) {
      return { ...defaultShape, endpoint, ok: false, http_status: res.status, error: `HTTP ${res.status} · body-parse ${j ? "ok" : "failed"}` };
    }
    return { ...defaultShape, endpoint, ok: true, http_status: res.status, ...j };
  } catch (err) {
    return { ...defaultShape, endpoint, ok: false, http_status: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchSchedulerEvidence() {
  const j = await fetchJsonSection("/api/nex/brain/scheduler-status", { local: null, vercel: null, freshness_budget_ms: null });
  // Recompute age_ms at snapshot moment · endpoint's value is only accurate at its serve moment.
  const nowMs = Date.now();
  const recomputeAge = (lastFiredAt) => {
    if (!lastFiredAt) return null;
    const t = new Date(lastFiredAt).getTime();
    if (!Number.isFinite(t)) return null;
    return nowMs - t;
  };
  if (j.ok) {
    if (j.local)  j.local.age_ms_at_snapshot  = recomputeAge(j.local.last_fired_at);
    if (j.vercel) j.vercel.age_ms_at_snapshot = recomputeAge(j.vercel.last_fired_at);
  }
  return j;
}

async function fetchKjLiveWorkEvidence() {
  return fetchJsonSection("/api/nex/brain/kj-live-work", { items: [], counts: null, active_kj_count: null, freshness_budget_ms: 60000 });
}

async function fetchWarehouseEvidence() {
  return fetchJsonSection("/api/nex/brain/warehouse", { in_production: null, vault_records: null, stages: [] });
}

async function fetchCloudEvidence() {
  return fetchJsonSection("/api/nex/brain/cloud-status", { any_online: null, workers: [], diagnostics: null });
}

async function fetchProviderEvidence() {
  return fetchJsonSection("/api/nex/brain/llm-health", { providers: [] });
}

async function fetchInboxStatusEvidence() {
  try {
    const res = await fetch(`${BASE_URL}/api/nex/knowledge-inbox/list`, { method: "GET", cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j) {
      return { endpoint: "/api/nex/knowledge-inbox/list", ok: false, http_status: res.status, error: `HTTP ${res.status}` };
    }
    const items = Array.isArray(j.items) ? j.items : [];
    const counts = { waiting: 0, processing: 0, processed: 0, review: 0, other: 0 };
    for (const it of items) {
      const s = String(it.status ?? "");
      if (s in counts) counts[s]++;
      else counts.other++;
    }
    return {
      endpoint: "/api/nex/knowledge-inbox/list",
      ok: true,
      http_status: res.status,
      total_items: items.length,
      counts,
    };
  } catch (err) {
    return { endpoint: "/api/nex/knowledge-inbox/list", ok: false, http_status: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// Truth-Law UI probe · fetch the Reception HTML and record which
// state labels are present in SSR output. Records the raw label
// inventory · does NOT decide compliance · analysis-time reconciles
// this with the endpoint-evidence sections above.
async function fetchUiTruthProbe() {
  const url = `${BASE_URL}/nex-app/nex-brain`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const html = await res.text().catch(() => "");
    if (!res.ok) {
      return { endpoint: url, ok: false, http_status: res.status, error: `HTTP ${res.status}` };
    }
    // Label inventory · what the SSR baseline actually renders.
    const countMatches = (re) => (html.match(re) ?? []).length;
    const labels_present = {
      "RUNNING":                        countMatches(/>RUNNING</g),
      "IDLE":                           countMatches(/>IDLE</g),
      "NOT FIRING":                     countMatches(/>NOT FIRING</g),
      "UNKNOWN":                        countMatches(/>UNKNOWN</g),
      "OFFLINE / NOT DEPLOYED":         countMatches(/>OFFLINE \/ NOT DEPLOYED</g),
      "no evidence yet":                countMatches(/no evidence yet/g),
      "Local workforce":                countMatches(/Local workforce/g),
      "Cloud workforce \\(Fly\\)":      countMatches(/Cloud workforce \(Fly\)/g),
      "Local scheduler":                countMatches(/Local scheduler/g),
      "Vercel Cron":                    countMatches(/Vercel Cron/g),
      "Inbox waiting":                  countMatches(/Inbox waiting/g),
      "KJ in production":               countMatches(/KJ in production/g),
      "Records stored":                 countMatches(/Records stored/g),
      "Historical events":              countMatches(/Historical events/g),
      "Recent success":                 countMatches(/Recent success/g),
      "Standing by":                    countMatches(/Standing by/g),
      "Degraded":                       countMatches(/>Degraded</g),
      "Unavailable":                    countMatches(/>Unavailable</g),
      "On KJ:":                         countMatches(/On KJ:/g),
    };
    // Forbidden strings · presence is a Truth-Law violation.
    const forbidden_present = {
      "Dumped 1XX (workload counter)":  countMatches(/Dumped\s+1[0-9][0-9]/g),
      "Cloud Workers.*Running":         countMatches(/Cloud Workers.*Running/g),
      "Working (as provider label)":    countMatches(/>Working</g),
    };
    return {
      endpoint: url,
      ok: true,
      http_status: res.status,
      html_bytes: html.length,
      labels_present,
      forbidden_present,
    };
  } catch (err) {
    return { endpoint: url, ok: false, http_status: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function nodeProcessesWindows() {
  // Use -EncodedCommand to avoid quoting issues across cmd/powershell layers.
  const psCmd =
    `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ` +
    `Select-Object ProcessId, WorkingSetSize, CommandLine | ` +
    `ConvertTo-Json -Depth 3 -Compress`;
  const encoded = Buffer.from(psCmd, "utf16le").toString("base64");
  const raw = execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
    encoding: "utf8",
    timeout: 15_000,
  }).trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.map((p) => {
    const cmd = String(p.CommandLine ?? "");
    const cmdLc = cmd.toLowerCase();
    let hint = "other";
    if (cmdLc.includes("nex-brain-worker")) hint = "worker-script";
    else if (cmdLc.includes("burnin-snapshot")) hint = "burnin-snapshot-self";
    else if (cmdLc.includes("next") && cmdLc.includes("start")) hint = "next-server-prod";
    else if (cmdLc.includes("next") && cmdLc.includes("dev")) hint = "next-server-dev";
    return {
      pid: Number(p.ProcessId),
      rss_bytes: Number(p.WorkingSetSize),
      rss_mb: Math.round((Number(p.WorkingSetSize) / (1024 * 1024)) * 10) / 10,
      cmd_hint: hint,
    };
  });
}

function nodeProcesses() {
  try {
    if (process.platform !== "win32") {
      return { ok: false, reason: "non-windows-observer-not-implemented", processes: [] };
    }
    return { ok: true, processes: nodeProcessesWindows() };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message.slice(0, 300) : String(e),
      processes: [],
    };
  }
}

async function pgSnapshot(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE nex_brain_app");
    await client.query("SET LOCAL statement_timeout = 20000");

    const preservedRes = await client.query(
      `SELECT job_id, status, progress, completion_result, updated_at
         FROM nex.knowledge_dump_jobs
        WHERE job_id = ANY($1::text[])
        ORDER BY job_id`,
      [PRESERVED_KJIDS],
    );
    const preservedDetails = preservedRes.rows.map((r) => {
      const status = String(r.status);
      const progress = Number(r.progress);
      const valid = status === "claimed" && progress === 0 && r.completion_result === null;
      return {
        job_id: String(r.job_id),
        status,
        progress,
        completion_result: r.completion_result,
        updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : (r.updated_at ?? null),
        valid,
      };
    });
    const violations = preservedDetails.filter((d) => !d.valid).map((d) => ({
      job_id: d.job_id,
      reason: `status=${d.status} progress=${d.progress} completion_result=${d.completion_result === null ? "null" : "not-null"}`,
    }));
    const missingIds = PRESERVED_KJIDS.filter(
      (id) => !preservedDetails.some((d) => d.job_id === id),
    );
    const preservedAllValid =
      preservedDetails.length === 10 && violations.length === 0 && missingIds.length === 0;

    const stuckSampleRes = await client.query(
      `SELECT job_id, updated_at
         FROM nex.knowledge_dump_jobs
        WHERE status = 'claimed'
          AND updated_at < NOW() - interval '30 minutes'
          AND NOT (job_id = ANY($1::text[]))
        ORDER BY updated_at ASC
        LIMIT 20`,
      [PRESERVED_KJIDS],
    );
    const stuckCountRes = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM nex.knowledge_dump_jobs
        WHERE status = 'claimed'
          AND updated_at < NOW() - interval '30 minutes'
          AND NOT (job_id = ANY($1::text[]))`,
      [PRESERVED_KJIDS],
    );

    const histRes = await client.query(
      `SELECT status, COUNT(*)::int AS n
         FROM nex.knowledge_dump_jobs
        GROUP BY status
        ORDER BY status`,
    );

    const highAttemptRes = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM nex.worker_jobs
        WHERE attempts >= $1`,
      [HIGH_ATTEMPT_THRESHOLD],
    );

    const workerJobStatusRes = await client.query(
      `SELECT status, COUNT(*)::int AS n
         FROM nex.worker_jobs
        GROUP BY status
        ORDER BY status`,
    );

    const auditRes = await client.query(`SELECT COUNT(*)::int AS n FROM nex.audit_log`);

    await client.query("COMMIT");

    return {
      preserved_10: {
        expected: 10,
        found: preservedDetails.length,
        missing_ids: missingIds,
        all_valid: preservedAllValid,
        violations,
        details: preservedDetails,
      },
      stuck_claimed_kjs: {
        count: Number(stuckCountRes.rows[0]?.n ?? 0),
        sample: stuckSampleRes.rows.map((r) => ({
          job_id: String(r.job_id),
          updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : (r.updated_at ?? null),
        })),
      },
      terminal_state_histogram: histRes.rows.map((r) => ({ status: String(r.status), count: Number(r.n) })),
      high_attempt_worker_jobs: {
        threshold: HIGH_ATTEMPT_THRESHOLD,
        count: Number(highAttemptRes.rows[0]?.n ?? 0),
      },
      worker_jobs_status_histogram: workerJobStatusRes.rows.map((r) => ({ status: String(r.status), count: Number(r.n) })),
      audit_log_row_count: Number(auditRes.rows[0]?.n ?? 0),
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function fsSnapshot() {
  const jobsJsonl = join(REPO_ROOT, "data", "nex-jobs", "jobs.jsonl");
  const burninDir = join(REPO_ROOT, "data", "burnin");
  const logs = [];
  for (const p of [join(burninDir, "server.log"), join(burninDir, "worker.log")]) {
    const s = fileStat(p);
    if (s.exists) logs.push({ path: p, ...s });
  }
  return {
    jobs_jsonl: {
      path: jobsJsonl,
      ...fileStat(jobsJsonl),
      line_count: lineCount(jobsJsonl),
    },
    log_files: logs,
  };
}

function preview(snap) {
  const p = snap.postgres?.preserved_10;
  const w = snap.workforce;
  const nodes = snap.processes?.node_processes ?? [];
  const serverProc = nodes.find((x) => x.cmd_hint === "next-server-prod" || x.cmd_hint === "next-server-dev");
  const workerProc = nodes.find((x) => x.cmd_hint === "worker-script");
  const sched = snap.scheduler_evidence;
  const kjl = snap.kj_live_work_evidence;
  const wh = snap.warehouse_evidence;
  const cl = snap.cloud_evidence;
  const prov = snap.provider_evidence;
  const ib = snap.inbox_status_evidence;
  const ui = snap.ui_truth_probe;
  const providerBands = prov?.ok && Array.isArray(prov.providers)
    ? prov.providers.reduce((acc, p) => { const k = p.status ?? "unknown"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})
    : null;
  const lines = [
    `─── burn-in snapshot preview · ${snap.captured_at} ───`,
    `preserved-10 invariant : ${p ? (p.all_valid ? `OK (${p.found}/10 claimed/0/null)` : `FAIL · ${p.violations.length} violation(s) · missing=${p.missing_ids.length}`) : "not-captured"}`,
    `stuck-claimed KJs      : ${snap.postgres ? snap.postgres.stuck_claimed_kjs.count : "?"} (excluding preserved 10 · threshold >30 min claimed)`,
    `KJ terminal states     : ${snap.postgres ? snap.postgres.terminal_state_histogram.map((h) => `${h.status}=${h.count}`).join(" · ") : "?"}`,
    `audit_log rows         : ${snap.postgres ? snap.postgres.audit_log_row_count : "?"}`,
    // ── G4 · scheduler evidence ──────────────────────────────
    `scheduler LOCAL        : ${sched?.ok ? `${sched.local?.state ?? "?"} · fired=${sched.local?.fired_count ?? "?"} · last=${sched.local?.last_fired_at ?? "—"} · age@snap=${sched.local?.age_ms_at_snapshot ?? "—"}ms` : `unreachable (${sched?.error ?? "?"})`}`,
    `scheduler VERCEL       : ${sched?.ok ? `${sched.vercel?.state ?? "?"} · fired=${sched.vercel?.fired_count ?? "?"} · last=${sched.vercel?.last_fired_at ?? "—"}` : "unreachable"}`,
    // ── G3 · warehouse evidence ──────────────────────────────
    `warehouse in_production: ${wh?.ok ? `total=${wh.in_production?.total ?? "?"} q=${wh.in_production?.by_status?.queued ?? "?"} c=${wh.in_production?.by_status?.claimed ?? "?"} p=${wh.in_production?.by_status?.processing ?? "?"} oldest=${wh.in_production?.oldest_at ?? "—"}` : "unreachable"}`,
    `warehouse vault_records: ${wh?.ok ? `auth=${wh.vault_records?.authoritative ?? "?"} review=${wh.vault_records?.awaiting_review ?? "?"}` : "unreachable"}`,
    `warehouse stages       : ${wh?.ok && Array.isArray(wh.stages) ? wh.stages.map((s) => `${s.key}=${s.count}`).join(" · ") : "unreachable"}`,
    // ── G6 · worker↔KJ evidence ──────────────────────────────
    `kj-live-work           : ${kjl?.ok ? `active=${kjl.active_kj_count ?? "?"} counts=${JSON.stringify(kjl.counts ?? {})}` : "unreachable"}`,
    // ── G2 · cloud evidence ──────────────────────────────────
    `cloud (Fly)            : ${cl?.ok ? `any_online=${cl.any_online} cloud_hb=${cl.diagnostics?.cloud_heartbeats ?? "?"} non_cloud_hb=${cl.diagnostics?.non_cloud_heartbeats ?? "?"}` : "unreachable"}`,
    // ── Provider evidence ────────────────────────────────────
    `providers by status    : ${providerBands ? Object.entries(providerBands).map(([k, v]) => `${k}=${v}`).join(" · ") : "unreachable"}`,
    // ── G1 · inbox status ────────────────────────────────────
    `inbox status counts    : ${ib?.ok ? `waiting=${ib.counts.waiting} processing=${ib.counts.processing} processed=${ib.counts.processed} review=${ib.counts.review} total=${ib.total_items}` : "unreachable"}`,
    // ── Workforce roll-up (backward compat) ──────────────────
    `workforce waiting/inflight/done24/failed24: ${w ? `${w.jobs_waiting}/${w.jobs_in_flight}/${w.jobs_completed_24h}/${w.jobs_failed_24h}` : "?"}`,
    `LLM calls / tokens 24h : ${w ? `${w.llm_calls_24h} / ${w.llm_tokens_24h}` : "?"}`,
    `worker pool activity   : ${w ? w.worker_pool.map((wp) => `${wp.worker_type}=${wp.jobs_in_flight}/${wp.jobs_waiting}`).join(" · ") : "?"}`,
    // ── UI Truth-Law probe (SSR label inventory) ─────────────
    `UI labels present      : ${ui?.ok ? Object.entries(ui.labels_present).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(" · ") : "unreachable"}`,
    `UI forbidden present   : ${ui?.ok ? Object.entries(ui.forbidden_present).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(" · ") || "(none · good)" : "unreachable"}`,
    // ── Drift ────────────────────────────────────────────────
    `Next server RSS        : ${serverProc ? `${serverProc.rss_mb} MB (pid ${serverProc.pid})` : "not detected"}`,
    `worker script RSS      : ${workerProc ? `${workerProc.rss_mb} MB (pid ${workerProc.pid})` : "not detected"}`,
    `jobs.jsonl             : ${snap.filesystem.jobs_jsonl.exists ? `${snap.filesystem.jobs_jsonl.size_bytes} bytes · ${snap.filesystem.jobs_jsonl.line_count} lines` : "missing"}`,
    `errors captured        : ${snap.errors.length}${snap.errors.length ? ` · ${snap.errors.map((e) => e.where).join(", ")}` : ""}`,
    `───`,
    `NOTE · this preview shows raw observations only. No health verdict.`,
    `Verdicts (pass/fail/inconclusive) are derived at analysis time from comparing snapshots against the Truth Contract · not by this script.`,
  ];
  return lines.join("\n");
}

async function main() {
  if (!PG_URL) {
    console.error("[burnin-snapshot] NEX_POSTGRES_URL not set");
    console.error("[burnin-snapshot] run with: node --env-file=.env.local scripts/burnin-snapshot.mjs");
    process.exit(3);
  }

  const capturedAt = nowIso();
  const snapshotId = `burnin-${capturedAt.replace(/[:.]/g, "-")}`;
  const outDir = join(REPO_ROOT, "data", "burnin");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `snapshot-${snapshotId}.json`);

  const errors = [];
  let workforce = null;
  try { workforce = await fetchStatus(); }
  catch (e) { errors.push({ where: "status-endpoint", error: e instanceof Error ? e.message : String(e) }); }

  const pool = new Pool({ connectionString: PG_URL, max: 2, connectionTimeoutMillis: 10_000 });
  let pgResult = null;
  try { pgResult = await pgSnapshot(pool); }
  catch (e) { errors.push({ where: "postgres", error: e instanceof Error ? e.message : String(e) }); }
  finally { try { await pool.end(); } catch { /* ignore */ } }

  const procResult = nodeProcesses();
  if (!procResult.ok) errors.push({ where: "node-processes", error: procResult.reason });

  // Truth-Law burn-in evidence · captured in parallel · every helper
  // returns a well-formed section even on failure. No verdict logic.
  const [
    schedulerEv,
    kjLiveWorkEv,
    warehouseEv,
    cloudEv,
    providerEv,
    inboxEv,
    uiProbe,
  ] = await Promise.all([
    fetchSchedulerEvidence(),
    fetchKjLiveWorkEvidence(),
    fetchWarehouseEvidence(),
    fetchCloudEvidence(),
    fetchProviderEvidence(),
    fetchInboxStatusEvidence(),
    fetchUiTruthProbe(),
  ]);
  for (const [name, ev] of [
    ["scheduler-evidence",   schedulerEv],
    ["kj-live-work-evidence",kjLiveWorkEv],
    ["warehouse-evidence",   warehouseEv],
    ["cloud-evidence",       cloudEv],
    ["provider-evidence",    providerEv],
    ["inbox-status-evidence",inboxEv],
    ["ui-truth-probe",       uiProbe],
  ]) {
    if (!ev.ok) errors.push({ where: name, error: ev.error ?? `HTTP ${ev.http_status ?? "?"}` });
  }

  const snap = {
    snapshot_id: snapshotId,
    captured_at: capturedAt,
    captured_at_ms: Date.now(),
    base_url: BASE_URL,
    workforce,
    postgres: pgResult,
    processes: { ok: procResult.ok, node_processes: procResult.processes },
    filesystem: fsSnapshot(),
    // Truth-Law burn-in signals · G3 / G4 / G6 / G2 / provider / inbox / UI-probe
    scheduler_evidence:      schedulerEv,
    kj_live_work_evidence:   kjLiveWorkEv,
    warehouse_evidence:      warehouseEv,
    cloud_evidence:          cloudEv,
    provider_evidence:       providerEv,
    inbox_status_evidence:   inboxEv,
    ui_truth_probe:          uiProbe,
    errors,
  };

  writeFileSync(outPath, JSON.stringify(snap, null, 2), "utf8");
  console.log(`[burnin-snapshot] wrote ${outPath}`);
  console.log(preview(snap));

  if (pgResult && !pgResult.preserved_10.all_valid) {
    console.error("[burnin-snapshot] PRESERVATION INVARIANT BROKEN · emergency halt condition");
    process.exit(2);
  }
  if (errors.length > 0) {
    console.error(`[burnin-snapshot] observation errors (${errors.length}) · snapshot may be incomplete`);
    process.exit(3);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("[burnin-snapshot] fatal:", e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(3);
});
