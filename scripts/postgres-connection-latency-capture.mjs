#!/usr/bin/env node
// scripts/postgres-connection-latency-capture.mjs
//
// Founder BEGIN 2026-09-09 · POSTGRES-CONNECTION-LATENCY-CAPTURE
// Founder's Step 1 of the ordered diagnostic (before proximity check · before
// spike reproduction · before hot-tier evaluation).
//
// Diagnostic only. Zero optimization. Zero hiding tricks.
//
// Attributes the observed ~237 ms Postgres baseline to specific layers:
//   Layer A · DNS resolution
//   Layer B · TCP handshake (net.createConnection)
//   Layer C · TLS handshake (tls.connect over the raw socket)
//   Layer D · pg driver connect (its own TCP + TLS + startup + auth)
//   Layer E · steady-state SELECT 1 on a WARM pool client (real production case)
//
// N=30 samples per layer. Report P50/P95/max and named dominant layer.
//
// Zero writes. Zero application changes. Read-only probe.

import net from "node:net";
import tls from "node:tls";
import dns from "node:dns/promises";
import { performance } from "node:perf_hooks";
import pg from "pg";
const { Pool, Client } = pg;

const conn = process.env.NEX_POSTGRES_URL;
if (!conn) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const N = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 30);

const url = new URL(conn);
const host = url.hostname;
const port = Number(url.port || 5432);

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}
function stats(arr) {
  if (!arr.length) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    n: arr.length,
    min: Math.round(s[0] * 100) / 100,
    p50: Math.round(pct(s, 50) * 100) / 100,
    p95: Math.round(pct(s, 95) * 100) / 100,
    p99: Math.round(pct(s, 99) * 100) / 100,
    max: Math.round(s[s.length - 1] * 100) / 100,
    mean: Math.round((sum / arr.length) * 100) / 100,
  };
}

// Layer A · DNS lookup
async function dnsSample() {
  const t0 = performance.now();
  await dns.lookup(host);
  return performance.now() - t0;
}

// Layer B · raw TCP handshake
function tcpSample() {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const s = net.createConnection({ host, port });
    s.once("connect", () => { const dt = performance.now() - t0; s.destroy(); resolve(dt); });
    s.once("error", (err) => reject(err));
    s.setTimeout(20000, () => { s.destroy(); reject(new Error("tcp timeout")); });
  });
}

// Layer C · TLS handshake · Postgres SSL is via STARTTLS on port 5432 · but
// Supabase Supavisor pooler on 6543 accepts SSL request. We approximate the
// "TLS cost" by measuring tls.connect() directly to the host (which is what
// pg uses under the hood after SSLRequest). This is the pure TLS 1.2/1.3
// handshake latency to that endpoint.
function tlsSample() {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const s = tls.connect({ host, port, servername: host, rejectUnauthorized: false });
    s.once("secureConnect", () => { const dt = performance.now() - t0; s.destroy(); resolve(dt); });
    s.once("error", (err) => reject(err));
    s.setTimeout(30000, () => { s.destroy(); reject(new Error("tls timeout")); });
  });
}

// Layer D · pg driver connect (TCP + TLS + SSLRequest + Startup + Auth)
async function pgConnectSample() {
  const client = new Client({ connectionString: conn });
  const t0 = performance.now();
  await client.connect();
  const dt = performance.now() - t0;
  await client.end();
  return dt;
}

// Layer E · steady-state SELECT 1 on a WARM pool client
async function pgQuerySample(pool) {
  const t0 = performance.now();
  await pool.query("SELECT 1");
  return performance.now() - t0;
}

async function sweep(label, fn, warm = 0) {
  const samples = [];
  for (let i = 0; i < warm; i++) { try { await fn(); } catch {} }
  for (let i = 0; i < N; i++) {
    try {
      const dt = await fn();
      samples.push(dt);
    } catch (e) {
      console.error(`  ${label} sample ${i + 1} FAILED: ${e.message}`);
    }
    if (i % Math.max(1, Math.floor(N / 5)) === 0) process.stdout.write(`  ${label} ${i + 1}/${N} last=${samples[samples.length - 1]?.toFixed(1) ?? "?"}ms\n`);
  }
  const s = stats(samples);
  return { label, samples, stats: s };
}

async function main() {
  console.log("━".repeat(78));
  console.log("POSTGRES-CONNECTION-LATENCY-CAPTURE · Founder Step 1 · diagnostic only");
  console.log(`host       : ${host}`);
  console.log(`port       : ${port}`);
  console.log(`N          : ${N} per layer`);
  console.log(`started    : ${new Date().toISOString()}`);
  console.log("━".repeat(78));

  const results = {};

  console.log(`\n▸ Layer A · DNS lookup`);
  results.dns = await sweep("dns", dnsSample);

  console.log(`\n▸ Layer B · TCP handshake (fresh socket each time)`);
  results.tcp = await sweep("tcp", tcpSample);

  console.log(`\n▸ Layer C · TLS handshake (fresh socket each time)`);
  results.tls = await sweep("tls", tlsSample);

  console.log(`\n▸ Layer D · pg driver connect (TCP + TLS + SSLRequest + Startup + Auth, fresh Client each time)`);
  results.pgConnect = await sweep("pg_connect", pgConnectSample);

  console.log(`\n▸ Layer E · steady-state SELECT 1 on a WARM pool client (this is what production sees)`);
  const pool = new Pool({ connectionString: conn, max: 4 });
  // warm the pool with 3 selects
  for (let i = 0; i < 3; i++) { try { await pool.query("SELECT 1"); } catch {} }
  results.pgQuery = await sweep("pg_query_warm", () => pgQuerySample(pool));
  await pool.end();

  console.log(``);
  console.log(`${"━".repeat(78)}`);
  console.log(`SUMMARY · layer attribution (all in ms)`);
  console.log(``);
  console.log(`  Layer                                    n     min    P50    P95    P99    max    mean`);
  for (const [key, r] of Object.entries(results)) {
    const s = r.stats;
    console.log(`  ${key.padEnd(38)} ${String(s.n).padStart(3)}  ${String(s.min).padStart(6)} ${String(s.p50).padStart(6)} ${String(s.p95).padStart(6)} ${String(s.p99).padStart(6)} ${String(s.max).padStart(6)} ${String(s.mean).padStart(6)}`);
  }
  console.log(``);
  const dns = results.dns.stats.p50;
  const tcp = results.tcp.stats.p50;
  const tlsL = results.tls.stats.p50;
  const pgC = results.pgConnect.stats.p50;
  const pgQ = results.pgQuery.stats.p50;
  console.log(`FOUNDER-FORMAT LAYER BREAKDOWN (P50):`);
  console.log(`  DNS lookup              : ${dns} ms`);
  console.log(`  TCP handshake           : ${tcp} ms`);
  console.log(`  TLS handshake           : ${tlsL} ms  · adds ${(tlsL - tcp).toFixed(2)} ms over TCP`);
  console.log(`  pg driver cold connect  : ${pgC} ms  · TLS + SSLRequest + Startup + Auth combined`);
  console.log(`  Steady-state SELECT 1   : ${pgQ} ms  ← THIS is what production requests pay per query`);
  console.log(``);
  if (pgQ) {
    const rttEstimate = Math.round((pgQ - 5) * 100) / 100;  // subtract ~5ms Postgres processing
    console.log(`  Implied one-way network RTT (crude): ~${(rttEstimate / 2).toFixed(1)} ms`);
    console.log(`  For reference: Ireland ↔ Indonesia is ~10,000+ km · light-speed floor ~ 66 ms one-way ·`);
    console.log(`                 real internet 4-5x that = ~200-300 ms round-trip is normal`);
  }
  console.log(``);
  console.log(`${"━".repeat(78)}`);
  console.log(`HARD STOP · diagnostic only · no optimization proposed`);
  console.log(`Steps 2/3/4 (proximity check · long-tail spike reproduction · hot-tier evaluation) each need their own Founder BEGIN.`);
}

main().catch((e) => { console.error(`FAILED:`, e?.stack ?? e); process.exit(1); });
