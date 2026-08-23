#!/usr/bin/env node
// NEX Worker Reliability · 24-hour report generator.
//
// Produces two outputs:
//   1. Structured JSON (for HQ tile · API endpoint · programmatic consumers)
//   2. Prose text (for voice reading via existing NEX voice pipeline)
//
// Reads from:
//   · nex.worker_health_status (view)
//   · nex.worker_24h_activity  (view)
//   · nex.worker_cycle_run     (recent · for the "what happened" narrative)
//
// Zero LLM calls · deterministic. Voice layer wraps the prose separately.
//
// USAGE
//   node --env-file=.env.local scripts/nex-worker/report-24h.mjs [--voice]

import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const wantVoice = process.argv.includes("--voice");
const wantJson = process.argv.includes("--json");
const pool = new pg.Pool({ connectionString: url });

// ── Build the report structure ────────────────────────────────────────────

export async function build24hReport(pool) {
  const health = (await pool.query(
    `SELECT * FROM nex.worker_health_status ORDER BY worker_type, worker_id`
  )).rows;
  const activity = (await pool.query(
    `SELECT * FROM nex.worker_24h_activity`
  )).rows;
  const recentCycles = (await pool.query(
    `SELECT id, worker_id, worker_type, worker_config, started_at, finished_at,
            duration_ms, status, records_processed, records_new, records_rejected,
            errors_count, summary, doctrine_checks
     FROM nex.worker_cycle_run
     WHERE started_at > now() - interval '24 hours'
     ORDER BY started_at DESC
     LIMIT 50`
  )).rows;

  const doctrineHeld = { held: [], violated: [], not_checked: [] };
  for (const c of recentCycles) {
    const dc = c.doctrine_checks ?? {};
    for (const [k, v] of Object.entries(dc)) {
      const upper = String(v).toUpperCase();
      if (upper === "HELD" || upper === "HELD ✓" || upper.startsWith("HELD")) {
        if (!doctrineHeld.held.includes(k)) doctrineHeld.held.push(k);
      } else if (upper === "VIOLATED" || upper.startsWith("VIOLATED")) {
        doctrineHeld.violated.push({ cycleId: c.id, worker: c.worker_id, invariant: k });
      } else {
        if (!doctrineHeld.not_checked.includes(k)) doctrineHeld.not_checked.push(k);
      }
    }
  }

  const workerCount = health.length;
  const healthySummary = health.reduce((acc, r) => {
    acc[r.health] = (acc[r.health] ?? 0) + 1;
    return acc;
  }, {});

  const total24h = {
    cycles_run: activity.reduce((s, r) => s + Number(r.cycles_run || 0), 0),
    cycles_completed: activity.reduce((s, r) => s + Number(r.cycles_completed || 0), 0),
    cycles_failed: activity.reduce((s, r) => s + Number(r.cycles_failed || 0), 0),
    total_records_new: activity.reduce((s, r) => s + Number(r.total_records_new || 0), 0),
    total_records_processed: activity.reduce((s, r) => s + Number(r.total_records_processed || 0), 0),
    total_errors: activity.reduce((s, r) => s + Number(r.total_errors || 0), 0),
  };

  return {
    generatedAt: new Date().toISOString(),
    workerCount,
    healthSummary: healthySummary,
    perWorkerHealth: health,
    perWorker24h: activity,
    recentCycles,
    doctrine: doctrineHeld,
    total24h,
  };
}

// ── Prose form (for voice · Bahasa Indonesia and English supported) ───────

export function buildProseReport(report, lang = "en") {
  const date = new Date(report.generatedAt);
  const dateStr = date.toLocaleString(lang === "id" ? "id-ID" : "en-GB", {
    dateStyle: "long", timeStyle: "short",
  });
  const total = report.total24h;
  const healthy = report.healthSummary.HEALTHY ?? 0;
  const warning = report.healthSummary.WARNING ?? 0;
  const critical = report.healthSummary.CRITICAL ?? 0;
  const unknown = report.healthSummary.UNKNOWN ?? 0;

  const parts = [];

  if (lang === "id") {
    parts.push(`Laporan mesin NEX, ${dateStr}.`);
    if (report.workerCount === 0) {
      parts.push(`Tidak ada worker yang tercatat. Sistem belum mulai memproduksi data.`);
    } else {
      parts.push(`${report.workerCount} worker terpantau. ${healthy} sehat, ${warning} peringatan, ${critical} kritis, ${unknown} belum diketahui.`);
    }
    if (total.cycles_run === 0) {
      parts.push(`Tidak ada siklus dijalankan dalam 24 jam terakhir. Worker menunggu instruksi.`);
    } else {
      parts.push(`${total.cycles_run} siklus dijalankan. ${total.cycles_completed} selesai, ${total.cycles_failed} gagal.`);
      parts.push(`${total.total_records_new} rekaman baru ditambahkan. ${total.total_errors} kesalahan tercatat.`);
    }
    if (report.doctrine.violated.length > 0) {
      parts.push(`Perhatian: ${report.doctrine.violated.length} pelanggaran doktrin terdeteksi. Tinjau HQ.`);
    } else if (report.doctrine.held.length > 0) {
      parts.push(`Semua invarian doktrin tetap dipertahankan.`);
    }
  } else {
    parts.push(`NEX machine report, ${dateStr}.`);
    if (report.workerCount === 0) {
      parts.push(`No workers registered. The system has not yet started producing data.`);
    } else {
      parts.push(`${report.workerCount} workers monitored. ${healthy} healthy, ${warning} warning, ${critical} critical, ${unknown} unknown.`);
    }
    if (total.cycles_run === 0) {
      parts.push(`No cycles ran in the last 24 hours. Workers are awaiting instruction.`);
    } else {
      parts.push(`${total.cycles_run} cycles executed. ${total.cycles_completed} completed, ${total.cycles_failed} failed.`);
      parts.push(`${total.total_records_new} new records added. ${total.total_errors} errors logged.`);
    }
    for (const w of report.perWorker24h) {
      if (Number(w.cycles_run) === 0) continue;
      const wt = w.worker_type;
      const wc = w.worker_config ? `, ${w.worker_config}` : "";
      const ok = Number(w.cycles_completed);
      const bad = Number(w.cycles_failed);
      const news = Number(w.total_records_new);
      if (bad > 0) {
        parts.push(`${wt}${wc}: ${ok} completed, ${bad} failed, ${news} new records.`);
      } else {
        parts.push(`${wt}${wc}: ${ok} cycles clean, ${news} new records.`);
      }
    }
    if (report.doctrine.violated.length > 0) {
      parts.push(`ATTENTION: ${report.doctrine.violated.length} doctrine invariant violations detected. Review HQ.`);
    } else if (report.doctrine.held.length > 0) {
      parts.push(`All doctrine invariants held.`);
    }
  }

  return parts.join(" ");
}

// ── CLI entry ────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` ||
    import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const report = await build24hReport(pool);
  if (wantJson) {
    console.log(JSON.stringify(report, null, 2));
  } else if (wantVoice) {
    console.log("── VOICE (EN) ──");
    console.log(buildProseReport(report, "en"));
    console.log("");
    console.log("── VOICE (ID) ──");
    console.log(buildProseReport(report, "id"));
  } else {
    console.log("═".repeat(72));
    console.log(`NEX WORKER 24-HOUR REPORT · ${report.generatedAt}`);
    console.log("═".repeat(72));
    console.log("");
    console.log(`Workers monitored:              ${report.workerCount}`);
    const h = report.healthSummary;
    console.log(`Health:  HEALTHY=${h.HEALTHY ?? 0}  WARNING=${h.WARNING ?? 0}  CRITICAL=${h.CRITICAL ?? 0}  UNKNOWN=${h.UNKNOWN ?? 0}`);
    console.log("");
    console.log("── 24h totals ──");
    console.log(`  cycles run:            ${report.total24h.cycles_run}`);
    console.log(`  cycles completed:      ${report.total24h.cycles_completed}`);
    console.log(`  cycles failed:         ${report.total24h.cycles_failed}`);
    console.log(`  records new:           ${report.total24h.total_records_new}`);
    console.log(`  records processed:     ${report.total24h.total_records_processed}`);
    console.log(`  errors:                ${report.total24h.total_errors}`);
    console.log("");
    if (report.perWorker24h.length > 0) {
      console.log("── per-worker 24h ──");
      for (const w of report.perWorker24h) {
        console.log(`  ${(w.worker_id||"").padEnd(40)}  cycles=${w.cycles_run}/${w.cycles_completed}  new=${w.total_records_new}  errors=${w.total_errors}`);
      }
      console.log("");
    }
    console.log("── per-worker health ──");
    for (const w of report.perWorkerHealth) {
      console.log(`  ${(w.worker_id||"").padEnd(40)}  ${w.health}  (heartbeat ${w.seconds_since_heartbeat != null ? w.seconds_since_heartbeat + "s ago" : "never"})`);
    }
    console.log("");
    console.log("── doctrine invariants observed in last 24h ──");
    for (const k of report.doctrine.held) console.log(`  HELD ✓ ${k}`);
    for (const v of report.doctrine.violated) console.log(`  VIOLATED ✗ ${v.invariant} on ${v.worker}`);
    console.log("");
    console.log("── VOICE (EN) ──");
    console.log(buildProseReport(report, "en"));
  }
  await pool.end();
}
