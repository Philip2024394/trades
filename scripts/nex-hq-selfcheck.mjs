#!/usr/bin/env node
// scripts/nex-hq-selfcheck.mjs
//
// Founder 2026-09-10 · HQ Self-Monitor.
//
// Pings /api/nex/hq/live from the machine itself every 5 minutes.
// If the endpoint returns a bad status or takes > 10s, writes an
// alert row to data/nex-lab/hq-alerts.jsonl. If the check succeeds,
// writes a heartbeat.
//
// This is a WATCHDOG for the dashboard itself · founder can see
// "was HQ up all night?" from the log.
//
// If the HQ endpoint is down · this script attempts a Postgres
// query directly as a fallback health check.

import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const HB_PATH = join(LAB_DIR, "hq-heartbeat.jsonl");
const ALERT_PATH = join(LAB_DIR, "hq-alerts.jsonl");

const HQ_URL = process.env.NEX_HQ_HEALTH_URL ?? "http://localhost:3008/api/nex/hq/live";
const HQ_TOKEN = process.env.NEX_HQ_DASHBOARD_TOKEN ?? "";

function write(path, obj) {
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(path, JSON.stringify(obj) + "\n");
  } catch { /* silent */ }
}

async function checkHq() {
  const t0 = Date.now();
  try {
    const headers = { "Accept": "application/json" };
    if (HQ_TOKEN.length >= 16) headers["x-hq-token"] = HQ_TOKEN;
    const res = await fetch(HQ_URL, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    const ms = Date.now() - t0;
    if (!res.ok) return { ok: false, status: res.status, latency_ms: ms, reason: `http_${res.status}` };
    const j = await res.json();
    return {
      ok: true,
      status: res.status,
      latency_ms: ms,
      agents_running: j.agents_summary?.running ?? null,
      agents_total: j.agents_summary?.total ?? null,
      accommodation_rows: j.growth?.accommodation_rows_now ?? null,
    };
  } catch (err) {
    return { ok: false, status: 0, latency_ms: Date.now() - t0, reason: String(err).slice(0, 200) };
  }
}

async function checkPostgres() {
  try {
    const { Client } = await import("pg");
    const c = new Client({
      connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL
        ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
      connectionTimeoutMillis: 5000,
    });
    await c.connect();
    try {
      const r = await c.query("SELECT count(*)::int c FROM nex.accommodation_business");
      return { ok: true, accommodation_rows: r.rows[0].c };
    } finally { await c.end(); }
  } catch (err) { return { ok: false, reason: String(err).slice(0, 200) }; }
}

async function main() {
  const now_iso = new Date().toISOString();
  const hq = await checkHq();
  const record = { ts_iso: now_iso, hq };
  if (!hq.ok) {
    const pg = await checkPostgres();
    record.pg_fallback = pg;
    write(ALERT_PATH, { ...record, kind: "hq_down" });
  }
  write(HB_PATH, record);
  process.stdout.write(JSON.stringify(record) + "\n");
  process.exit(hq.ok ? 0 : 1);
}

main().catch((err) => {
  write(ALERT_PATH, { ts_iso: new Date().toISOString(), kind: "selfcheck_fatal", err: String(err).slice(0, 300) });
  process.exit(2);
});
