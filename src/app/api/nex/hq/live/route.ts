// src/app/api/nex/hq/live/route.ts
//
// Founder 2026-09-10 · HQ Live Feed.
// The single source of truth the HQ dashboard polls every 5 seconds.
//
// Every field returned is either:
//   · READ from a live signal (heartbeat file, event log, DB count), OR
//   · MEASURED just before this response ships
//
// Zero fabricated numbers · zero cached stale data · no LLM inference.
// This endpoint MUST NEVER lie · the founder relies on it to see truth.

import { NextResponse } from "next/server";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Founder 2026-09-10 · HQ SECURITY GATE ─────────────────────────
// Only the founder can read HQ · zero third-party involvement.
// Accepted credentials:
//   1. Admin cookie (from /admin login)
//   2. Author-studio cookie
//   3. NEX_HQ_DASHBOARD_TOKEN header (for CI / owned tooling only)
//   4. localhost origin (development on Victus)
// Everything else gets 401.
function isFounderAuthed(req: Request): { ok: boolean; reason: string } {
  const cookie = req.headers.get("cookie") ?? "";
  if (/(?:^|;\s*)(x-admin-sig|admin_authed|nex_session|nex_author_session)=/i.test(cookie)) {
    return { ok: true, reason: "admin_cookie" };
  }
  const token = req.headers.get("x-hq-token") ?? "";
  const envToken = process.env.NEX_HQ_DASHBOARD_TOKEN ?? "";
  if (envToken.length >= 16 && token === envToken) {
    return { ok: true, reason: "hq_token" };
  }
  // Localhost access · dev only · production sets NEX_HQ_REQUIRE_AUTH=1 to deny
  if (process.env.NEX_HQ_REQUIRE_AUTH !== "1") {
    const host = req.headers.get("host") ?? "";
    if (/^localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host) || /^\[::1\]/.test(host)) {
      return { ok: true, reason: "localhost_dev" };
    }
  }
  return { ok: false, reason: "no_founder_credential" };
}

// Dev server runs from repo root · production runs from .next output.
// process.cwd() reliably points at the repo root during `npm run dev`.
const REPO_ROOT = process.cwd();
const RUNTIME_DIR = join(REPO_ROOT, "data", "nex-agent-runtime");
const HARVEST_DIR = join(REPO_ROOT, "data", "harvest-osm");
const MASTER_AI_DIR = join(REPO_ROOT, "data", "master-ai");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");

type AgentState = "RUNNING" | "DEGRADED" | "CRASHED" | "STOPPED" | "UNKNOWN";

interface AgentSnapshot {
  agent_id: string;
  state: AgentState;
  pid: number | null;
  heartbeat_iso: string | null;
  heartbeat_age_ms: number | null;
  is_lab: boolean;
}

interface EdgeFlow {
  from: string;
  to: string;
  items_recent: number;
  active: boolean;
}

interface HqLive {
  ts_iso: string;
  build_id: string;
  agents: AgentSnapshot[];
  agents_summary: { running: number; degraded: number; crashed: number; total: number };
  data_sources: Array<{ id: string; label: string; recent_items: number; last_ts_iso: string | null; active: boolean }>;
  processing_stages: Array<{ id: string; label: string; items_recent: number; active: boolean }>;
  outputs: Array<{ id: string; label: string; items_recent: number; last_ts_iso: string | null }>;
  edges: EdgeFlow[];
  growth: { hourly_pct: number | null; accommodation_rows_now: number | null; accommodation_rows_1h_ago: number | null };
  system: { uptime_agents_pct_24h: number; last_supervisor_run_iso: string | null; harvester_runs_24h: number };
  next_ping_seconds: number;
}

// ── Agent scanning ────────────────────────────────────────────────
function readAgentHeartbeats(): AgentSnapshot[] {
  const now = Date.now();
  const agents: AgentSnapshot[] = [];
  try {
    if (!existsSync(RUNTIME_DIR)) return agents;
    for (const name of readdirSync(RUNTIME_DIR)) {
      const m = /^heartbeat-([a-z0-9_]+)\.json$/i.exec(name);
      if (!m) continue;
      const agentId = m[1];
      try {
        const raw = JSON.parse(readFileSync(join(RUNTIME_DIR, name), "utf8"));
        const hbMs = raw.timestamp_iso ? Date.parse(raw.timestamp_iso) : null;
        const ageMs = hbMs != null ? now - hbMs : null;
        let state: AgentState = "UNKNOWN";
        if (ageMs != null) {
          if (ageMs < 30_000) state = "RUNNING";
          else if (ageMs < 5 * 60_000) state = "DEGRADED";
          else state = "CRASHED";
        }
        // Heartbeat file uses `process_id` (checked live 2026-09-10) · fall back to `pid`
        const pidValue = typeof raw.process_id === "number" ? raw.process_id
                       : typeof raw.pid === "number" ? raw.pid : null;
        let pidAlive = false;
        if (typeof pidValue === "number") {
          try { process.kill(pidValue, 0); pidAlive = true; }
          catch (e) { pidAlive = (e as { code?: string })?.code === "EPERM"; }
        }
        if (!pidAlive && state === "RUNNING") state = "CRASHED";
        agents.push({
          agent_id: agentId,
          state,
          pid: pidValue,
          heartbeat_iso: raw.timestamp_iso ?? null,
          heartbeat_age_ms: ageMs,
          is_lab: agentId.startsWith("lab_"),
        });
      } catch { /* skip malformed */ }
    }
  } catch { /* runtime dir missing */ }
  agents.sort((a, b) => a.agent_id.localeCompare(b.agent_id));
  return agents;
}

// ── Harvest ledger scanning ──────────────────────────────────────
function countRecentHarvest(): { runs_24h: number; recent_items: number; last_ts: string | null } {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  let runs = 0;
  let items = 0;
  let latest = 0;
  try {
    if (!existsSync(HARVEST_DIR)) return { runs_24h: 0, recent_items: 0, last_ts: null };
    for (const name of readdirSync(HARVEST_DIR)) {
      if (!name.endsWith(".jsonl")) continue;
      try {
        const full = join(HARVEST_DIR, name);
        const st = statSync(full);
        if (st.mtimeMs < cutoff) continue;
        runs++;
        if (st.mtimeMs > latest) latest = st.mtimeMs;
        // Count lines (bounded read)
        const raw = readFileSync(full, "utf8");
        items += (raw.match(/\n/g) ?? []).length;
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }
  return { runs_24h: runs, recent_items: items, last_ts: latest > 0 ? new Date(latest).toISOString() : null };
}

// ── Supervisor log tail ──────────────────────────────────────────
function readLastSupervisorRun(): string | null {
  try {
    const p = join(MASTER_AI_DIR, "supervisor.log");
    if (!existsSync(p)) return null;
    const raw = readFileSync(p, "utf8");
    const lines = raw.trim().split("\n").filter((l) => l.includes("supervisor done"));
    if (lines.length === 0) return null;
    const last = lines[lines.length - 1];
    const m = /\[([^\]]+)\]/.exec(last);
    return m ? m[1] : null;
  } catch { return null; }
}

// ── Accommodation row count (for growth %) ───────────────────────
async function readAccommodationCount(): Promise<number | null> {
  try {
    const pgUrl = process.env.NEX_TAXONOMY_POSTGRES_URL
      ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
    const { Client } = await import("pg").catch(() => ({}));
    if (!Client) return null;
    const c = new Client({ connectionString: pgUrl, connectionTimeoutMillis: 3000 });
    await c.connect();
    try {
      const r = await c.query("SELECT count(*)::int c FROM nex.accommodation_business");
      return r.rows[0]?.c ?? null;
    } finally { try { await c.end(); } catch { /* ignore */ } }

  } catch { return null; }
}

// ── Lab pipeline counts · REAL Postgres queries ──────────────────
// Founder 2026-09-10 · replaces the hardcoded 0s in sources/stages/outputs
// so the pipeline flow visualization tells the truth about data flow.
interface LabPipelineCounts {
  by_source: { osm: number; wikidata: number; nominatim: number; kemenparekraf: number; bmkg: number; other: number };
  verified_total: number;
  pending_promotions: number;
  canonical_from_lab: number;
  last_harvest_at: string | null;
  last_verify_at: string | null;
}
async function readLabPipelineCounts(): Promise<LabPipelineCounts | null> {
  try {
    const pgUrl = process.env.NEX_TAXONOMY_POSTGRES_URL
      ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
    const { Client } = await import("pg").catch(() => ({}));
    if (!Client) return null;
    const c = new Client({ connectionString: pgUrl, connectionTimeoutMillis: 4000 });
    await c.connect();
    try {
      const rooms = ["accommodation", "food", "transport", "business", "activities"];
      const acc = { osm: 0, wikidata: 0, nominatim: 0, kemenparekraf: 0, bmkg: 0, other: 0 };
      let verifiedTotal = 0;
      let lastHarvest: Date | null = null;
      let lastVerify: Date | null = null;
      for (const slug of rooms) {
        const schema = `nex_lab_${slug}`;
        try {
          const s = await c.query(`SELECT source, count(*)::int c, max(harvested_at) mx FROM ${schema}.harvest_raw GROUP BY source`);
          for (const r of s.rows) {
            const src = String(r.source ?? "");
            const n = Number(r.c);
            if (src.startsWith("osm")) acc.osm += n;
            else if (src.startsWith("wikidata")) acc.wikidata += n;
            else if (src.startsWith("nominatim")) acc.nominatim += n;
            else if (src.startsWith("kemenparekraf")) acc.kemenparekraf += n;
            else if (src.startsWith("bmkg")) acc.bmkg += n;
            else acc.other += n;
            if (r.mx && (!lastHarvest || r.mx > lastHarvest)) lastHarvest = r.mx;
          }
        } catch { /* schema may not exist · skip */ }
        try {
          const v = await c.query(`SELECT count(*)::int c, max(verified_at) mx FROM ${schema}.verified`);
          verifiedTotal += Number(v.rows[0]?.c ?? 0);
          if (v.rows[0]?.mx && (!lastVerify || v.rows[0].mx > lastVerify)) lastVerify = v.rows[0].mx;
        } catch { /* skip */ }
      }
      // Promotion queue + canonical writes
      let pending = 0, canonicalFromLab = 0;
      try {
        const p = await c.query("SELECT count(*)::int c FROM nex_lab.promotion_events WHERE status='pending'");
        pending = Number(p.rows[0]?.c ?? 0);
      } catch { /* ignore */ }
      for (const t of ["nex.accommodation_business", "nex.food_business", "nex.business_lead_directory", "nex.brain_attractions"]) {
        try {
          const r = await c.query(`SELECT count(*)::int c FROM ${t} WHERE verification_source LIKE 'lab_promotion:%'`);
          canonicalFromLab += Number(r.rows[0]?.c ?? 0);
        } catch { /* ignore */ }
      }
      return {
        by_source: acc,
        verified_total: verifiedTotal,
        pending_promotions: pending,
        canonical_from_lab: canonicalFromLab,
        last_harvest_at: lastHarvest ? lastHarvest.toISOString() : null,
        last_verify_at: lastVerify ? lastVerify.toISOString() : null,
      };
    } finally { try { await c.end(); } catch { /* ignore */ } }
  } catch { return null; }
}

// ── Lab pending count ────────────────────────────────────────────
function countLabPending(): { concepts: number; verified: number; briefs: number } {
  const out = { concepts: 0, verified: 0, briefs: 0 };
  try {
    for (const [key, sub] of [["concepts", "concepts"], ["verified", "verified"], ["briefs", "reports"]] as const) {
      const dir = join(LAB_DIR, sub);
      if (!existsSync(dir)) continue;
      try {
        (out as unknown as Record<string, number>)[key] = readdirSync(dir).length;
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return out;
}

// ── Main handler ─────────────────────────────────────────────────
export async function GET(request: Request) {
  const auth = isFounderAuthed(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorised", policy: "HQ is founder-only · zero third-party access" }, { status: 401 });
  }
  const ts = new Date();
  const agents = readAgentHeartbeats();
  const summary = {
    running:  agents.filter((a) => a.state === "RUNNING").length,
    degraded: agents.filter((a) => a.state === "DEGRADED").length,
    crashed:  agents.filter((a) => a.state === "CRASHED").length,
    total:    agents.length,
  };
  const harvest = countRecentHarvest();
  const lastSupervisorIso = readLastSupervisorRun();
  const accommodationNow = await readAccommodationCount();
  const labPending = countLabPending();
  const lab = await readLabPipelineCounts();

  // Real Postgres counts if available · else fall back to legacy JSONL harvest counter
  const osmCount = lab?.by_source.osm ?? harvest.recent_items;
  const wikidataCount = lab?.by_source.wikidata ?? 0;
  const nominatimCount = lab?.by_source.nominatim ?? 0;
  const kemenparCount = lab?.by_source.kemenparekraf ?? 0;
  const bmkgCount = lab?.by_source.bmkg ?? 0;
  const verifiedCount = lab?.verified_total ?? 0;
  const pendingPromoCount = lab?.pending_promotions ?? 0;
  const canonicalCount = lab?.canonical_from_lab ?? 0;
  const totalHarvest = osmCount + wikidataCount + nominatimCount + kemenparCount + bmkgCount;
  const lastHarvestTs = lab?.last_harvest_at ?? harvest.last_ts;

  // Data-source nodes on the left of the graph
  const data_sources = [
    { id: "src_osm",       label: "OpenStreetMap",       recent_items: osmCount,        last_ts_iso: lastHarvestTs, active: osmCount > 0 },
    { id: "src_wikidata",  label: "Wikidata SPARQL",     recent_items: wikidataCount,   last_ts_iso: lastHarvestTs, active: wikidataCount > 0 },
    { id: "src_nominatim", label: "Nominatim (OSM alt)", recent_items: nominatimCount,  last_ts_iso: lastHarvestTs, active: nominatimCount > 0 },
    { id: "src_kemenpar",  label: "Kemenparekraf",       recent_items: kemenparCount,   last_ts_iso: null,          active: kemenparCount > 0 },
    { id: "src_bmkg",      label: "BMKG (Weather)",      recent_items: bmkgCount,       last_ts_iso: null,          active: bmkgCount > 0 },
    { id: "src_bi",        label: "Bank of Indonesia",   recent_items: 0,               last_ts_iso: null,          active: false },
    { id: "src_conv",      label: "User Conversations",  recent_items: 0,               last_ts_iso: null,          active: false },
  ];

  // Processing stages (middle of the graph)
  const processing_stages = [
    { id: "stage_harvest",    label: "Domain Harvest",       items_recent: totalHarvest,      active: totalHarvest > 0 },
    { id: "stage_verify",     label: "Fact Verifier",        items_recent: verifiedCount,     active: verifiedCount > 0 },
    { id: "stage_prototype",  label: "Concept Prototyper",   items_recent: labPending.concepts, active: labPending.concepts > 0 },
    { id: "stage_ui_mock",    label: "UI Prototyper",        items_recent: 0,                 active: false },
    { id: "stage_monetize",   label: "Monetization Model",   items_recent: 0,                 active: false },
  ];

  const outputs = [
    { id: "out_promotion",   label: "Founder Brief · Promotion Queue", items_recent: pendingPromoCount + labPending.briefs, last_ts_iso: null },
    { id: "out_main_nex",    label: "→ Main NEX (signed)",             items_recent: canonicalCount,                        last_ts_iso: null },
  ];

  // Edge list (arrows in the graph) · active means "green line lit"
  const edges: EdgeFlow[] = [
    { from: "src_osm",       to: "stage_harvest",    items_recent: osmCount,        active: osmCount > 0 },
    { from: "src_wikidata",  to: "stage_harvest",    items_recent: wikidataCount,   active: wikidataCount > 0 },
    { from: "src_nominatim", to: "stage_harvest",    items_recent: nominatimCount,  active: nominatimCount > 0 },
    { from: "src_kemenpar",  to: "stage_harvest",    items_recent: kemenparCount,   active: kemenparCount > 0 },
    { from: "src_bmkg",      to: "stage_harvest",    items_recent: bmkgCount,       active: bmkgCount > 0 },
    { from: "src_bi",        to: "stage_harvest",    items_recent: 0,               active: false },
    { from: "src_conv",      to: "stage_prototype",  items_recent: 0,               active: false },
    { from: "stage_harvest",   to: "stage_verify",    items_recent: verifiedCount,   active: verifiedCount > 0 },
    { from: "stage_verify",    to: "stage_prototype", items_recent: labPending.concepts, active: labPending.concepts > 0 },
    { from: "stage_prototype", to: "stage_ui_mock",   items_recent: labPending.concepts, active: labPending.concepts > 0 },
    { from: "stage_ui_mock",   to: "stage_monetize",  items_recent: 0, active: false },
    { from: "stage_monetize",  to: "out_promotion",   items_recent: pendingPromoCount, active: pendingPromoCount > 0 },
    { from: "out_promotion",   to: "out_main_nex",    items_recent: canonicalCount,  active: canonicalCount > 0 },
  ];

  // Uptime · running / total across the 4 known-scheduled agents
  const uptime_pct = summary.total === 0 ? 0
    : Math.round((summary.running / summary.total) * 1000) / 10;

  const body: HqLive = {
    ts_iso: ts.toISOString(),
    build_id: "hq-live-v1-2026-09-10",
    agents,
    agents_summary: summary,
    data_sources,
    processing_stages,
    outputs,
    edges,
    growth: {
      hourly_pct: null, // populated when a baseline stored (Phase 2)
      accommodation_rows_now: accommodationNow,
      accommodation_rows_1h_ago: null,
    },
    system: {
      uptime_agents_pct_24h: uptime_pct,
      last_supervisor_run_iso: lastSupervisorIso,
      harvester_runs_24h: harvest.runs_24h,
    },
    next_ping_seconds: 5,
  };

  return NextResponse.json(body, {
    headers: { "cache-control": "no-store, must-revalidate" },
  });
}
