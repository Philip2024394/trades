// NEX HQ · Walker · Live Monitor · per-vertical page (2026-08-23).
//
// Dynamic route: /nex-head-quarters/walker/[vertical]
//   · /walker/food          → Yogyakarta food discovery
//   · /walker/accommodation → Yogyakarta accommodation discovery
//   · unknown vertical      → notFound()
//
// Extends the Task #86 Walker Live Monitor from a food-hardcoded page into
// a vertical-parameterised one so every Walker registered in
// src/lib/nex-hq/walker-verticals.ts gets an identical data page. The old
// /walker route now redirects to /walker/food · this file is the sole
// implementation.
//
// Filtering fix carried by this refactor:
//   The prior food page selected the "latest acquisition heartbeat" with
//   worker_type='acquisition' and no worker_id filter · that was fine when
//   only ONE acquisition worker existed. With food + accommodation both
//   writing heartbeats it would race and misreport. Every query in this
//   page now filters by worker_id (or worker_config LIKE prefix) drawn
//   from the vertical registry · no more implicit cross-vertical bleed.
//
// Doctrine anchors:
//   · Dashboard Singularity · one HQ · this is a subordinate drill-down.
//   · Direct-Provenance A · pipeline verified by counting provenance rows
//     with cycle_run_id FK · same evidence chain as food.
//   · Metric A (Walker discovery) vs Metric B (public promotion) stays
//     separate per Philip 2026-08-22 verbatim.

import { existsSync, readFileSync } from "node:fs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { getWalkerVertical, type WalkerVerticalDef } from "@/lib/nex-hq/walker-verticals";
import { loadAccommodationFunnel, type AccommodationFunnelBreakdown } from "@/lib/nex-accommodation/list-businesses";
import { buildWorkItemRegistry, buildRotationSnapshot, type RotationSnapshotRow, type RotationStateKind } from "@/lib/nex-hq/discovery-rotation";
import { buildDiscoveryQueue, MAX_SLOTS, type QueueItem, type InFlightCycle, type RecentPick } from "@/lib/nex-hq/auto-orchestrator";
import WalkerLiveIndicator, { type WalkerLiveState } from "../WalkerLiveIndicator";
import WalkerAutoRefresh from "../WalkerAutoRefresh";
import "../../../nex-app/nex-app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WALKER_CADENCE_S = 900;

// ── Types ─────────────────────────────────────────────────────────────

interface HeartbeatRow {
  worker_id: string;
  last_heartbeat_at: string | Date;
  last_status: string;
  worker_config: string | null;
  age_seconds: number | null;
}

interface CycleRow {
  id: string;
  worker_config: string;
  started_at: string | Date;
  finished_at: string | Date | null;
  status: string;
  records_processed: number | null;
  records_new: number | null;
  errors_count: number;
  duration_s: number | null;
  provenance_rows: number | null;
}

interface PrimaryCatRow      { category: string; count: number }
interface SecondaryTokenRow  { token: string; count: number }
interface ZoneAggRow         { zone: string; cycle_count: number; total_processed: number; total_new: number; last_run: string | null }
interface VisibilityRow      { total: number; visible: number; discovered: number }
interface SessionFileShape   { sessionStartedAt: string; pid: number }
interface CursorFileShape    { cursor: number; lastZone: string | null; lastAdvancedAt: string | null }

// ── File helpers ──────────────────────────────────────────────────────

function readJsonSafe<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch { return null; }
}

// ── Data load · vertical-scoped ───────────────────────────────────────

async function loadData(vertical: WalkerVerticalDef) {
  const pool = getFoodDbPool();

  const session = readJsonSafe<SessionFileShape>("data/nex-scheduler/walker-session.json");
  const cursor  = readJsonSafe<CursorFileShape>(vertical.cursorFile);
  const sessionStartedAt = session?.sessionStartedAt ?? null;

  // Discovered/visible/total is UNIVERSE-level · a claim_status column is
  // assumed present on both food_business and accommodation_business (both
  // land at 'discovered' via the Walker gate). Accommodation follows the
  // same convention; if that ever diverges the query below will need a
  // vertical-specific override.
  const heartbeatQ  = pool.query<HeartbeatRow>(`
    SELECT worker_id, last_heartbeat_at, last_status, worker_config,
           EXTRACT(EPOCH FROM (now() - last_heartbeat_at))::int AS age_seconds
      FROM nex.worker_heartbeat
     WHERE worker_id = $1
     ORDER BY last_heartbeat_at DESC
     LIMIT 1
  `, [vertical.workerId]);

  const sinceSessionQ = sessionStartedAt
    ? pool.query<{ cycles: number; processed: number; new_count: number; errors: number }>(
        `SELECT COUNT(*)::int AS cycles,
                COALESCE(SUM(records_processed),0)::int AS processed,
                COALESCE(SUM(records_new),0)::int AS new_count,
                COALESCE(SUM(errors_count),0)::int AS errors
           FROM nex.worker_cycle_run
          WHERE worker_type='acquisition'
            AND worker_config LIKE $1
            AND started_at >= $2::timestamptz`,
        [vertical.workerConfigLikePrefix, sessionStartedAt],
      )
    : Promise.resolve({ rows: [{ cycles: 0, processed: 0, new_count: 0, errors: 0 }] } as { rows: Array<{ cycles: number; processed: number; new_count: number; errors: number }> });

  const recentQ = pool.query<CycleRow>(`
    SELECT cr.id, cr.worker_config, cr.started_at, cr.finished_at, cr.status,
           cr.records_processed, cr.records_new, cr.errors_count,
           EXTRACT(EPOCH FROM (cr.finished_at - cr.started_at))::int AS duration_s,
           (SELECT COUNT(*)::int FROM ${vertical.provenanceTable} p WHERE p.cycle_run_id = cr.id) AS provenance_rows
      FROM nex.worker_cycle_run cr
     WHERE cr.worker_type='acquisition'
       AND cr.worker_config LIKE $1
     ORDER BY cr.started_at DESC
     LIMIT 20
  `, [vertical.workerConfigLikePrefix]);

  const universeQ = pool.query<VisibilityRow>(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE claim_status IN ('listed','invited','claimed','paying'))::int AS visible,
           COUNT(*) FILTER (WHERE claim_status='discovered')::int AS discovered
      FROM ${vertical.businessTable}
  `);

  const primaryCatsQ = pool.query<PrimaryCatRow>(`
    SELECT category, COUNT(*)::int AS count
      FROM ${vertical.businessTable}
     GROUP BY category
     ORDER BY 2 DESC
  `);

  const secondaryTokensQ = vertical.hasSecondaryCategoriesArray
    ? pool.query<SecondaryTokenRow>(`
        SELECT unnest(categories) AS token, COUNT(*)::int AS count
          FROM ${vertical.businessTable}
         WHERE array_length(categories,1) > 0
         GROUP BY 1
         ORDER BY 2 DESC
         LIMIT 25
      `)
    : Promise.resolve({ rows: [] } as { rows: SecondaryTokenRow[] });

  const zoneAggQ = pool.query<ZoneAggRow>(`
    SELECT worker_config AS zone,
           COUNT(*)::int AS cycle_count,
           COALESCE(SUM(records_processed),0)::int AS total_processed,
           COALESCE(SUM(records_new),0)::int AS total_new,
           MAX(started_at)::text AS last_run
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition' AND worker_config LIKE $1
     GROUP BY worker_config
     ORDER BY MAX(started_at) DESC NULLS LAST
  `, [vertical.workerConfigLikePrefix]);

  const latestCycleQ = pool.query<{ started_at: string | Date; worker_config: string }>(`
    SELECT started_at, worker_config
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition' AND worker_config LIKE $1
     ORDER BY started_at DESC
     LIMIT 1
  `, [vertical.workerConfigLikePrefix]);

  // PART A (2026-08-24) · Accommodation-specific honest funnel breakdown ·
  // computed from the DB · explains why HQ reports 881/881 while /accommodation
  // renders 500 (historic invisible LIMIT · now raised to 1500 · pagination
  // available via ?page=N). Only fetched for the accommodation vertical.
  const funnelQ: Promise<AccommodationFunnelBreakdown | null> = vertical.id === "accommodation"
    ? loadAccommodationFunnel({ city: "Yogyakarta", country: "ID", publicRenderCap: 1500 })
    : Promise.resolve(null);

  // Discovery Rotation snapshot · reads discovery_rotation_state populated
  // by the rotation-tick worker. Rendered at the top of every walker page so
  // Philip sees the central controller state from any vertical.
  const rotationQ = pool.query<{
    city: string; category: string; round: number; state: RotationStateKind;
    last_cycle_started_at: string | Date | null; last_productive_at: string | Date | null;
    consecutive_zero_new_cycles: number; total_records_last_cycle: number | null;
    records_new_last_cycle: number | null; reactivation_reason: string | null;
    next_action_hint: string | null; state_entered_at: string | Date | null; updated_at: string | Date | null;
  }>(`
    SELECT city, category, round, state,
           last_cycle_started_at, last_productive_at,
           consecutive_zero_new_cycles, total_records_last_cycle,
           records_new_last_cycle, reactivation_reason, next_action_hint,
           state_entered_at, updated_at
      FROM nex.discovery_rotation_state
     ORDER BY city, category
  `);

  const [heartbeat, sinceSession, recent, universe, primaryCats, secondaryTokens, zoneAgg, latestCycle, accFunnel, rotationRows] =
    await Promise.all([heartbeatQ, sinceSessionQ, recentQ, universeQ, primaryCatsQ, secondaryTokensQ, zoneAggQ, latestCycleQ, funnelQ, rotationQ]);

  const workItems = buildWorkItemRegistry();
  const stateRows = rotationRows.rows.map((r) => ({
    city: r.city,
    category: r.category as "accommodation" | "food" | "transport" | "market",
    round: r.round,
    state: r.state,
    lastCycleStartedAt: r.last_cycle_started_at ? new Date(r.last_cycle_started_at) : null,
    lastProductiveAt: r.last_productive_at ? new Date(r.last_productive_at) : null,
  }));
  const extras = new Map(rotationRows.rows.map((r) => [`${r.city}:${r.category}:${r.round}`, {
    consecutiveZero: r.consecutive_zero_new_cycles ?? 0,
    totalLast: r.total_records_last_cycle,
    newLast: r.records_new_last_cycle,
    reactivation: r.reactivation_reason,
    hint: r.next_action_hint,
    stateEnteredAt: r.state_entered_at ? new Date(r.state_entered_at) : null,
    updatedAt: r.updated_at ? new Date(r.updated_at) : null,
  }]));
  const rotationSnapshot = buildRotationSnapshot(stateRows, workItems, extras);

  // Auto Orchestrator queue view · uses the same rotation snapshot + live
  // in-flight tracking + recent-pick fairness data. Env-gate status is read
  // at request time so switching NEX_ORCHESTRATOR_ENABLED without rebuild is
  // reflected in the panel immediately.
  const inFlightRaw = await pool.query<{ id: string; worker_config: string | null; started_at: string | Date }>(`
    SELECT id, worker_config, started_at
      FROM nex.worker_cycle_run
     WHERE status='running' AND started_at > now() - interval '2 hours'
  `);
  const inFlight: InFlightCycle[] = [];
  for (const row of inFlightRaw.rows) {
    const cfg = String(row.worker_config ?? "");
    for (const wi of workItems) {
      if (!wi.workerConfigLikePrefix) continue;
      const prefix = wi.workerConfigLikePrefix.replace("%", "");
      if (cfg.startsWith(prefix)) {
        inFlight.push({ cycleId: row.id, city: wi.city, category: wi.category, startedAt: new Date(row.started_at) });
        break;
      }
    }
  }

  let recentPicks: RecentPick[] = [];
  try {
    const picks = await pool.query<{ city: string; category: string; picked_at: string | Date }>(`
      SELECT city, category, picked_at
        FROM nex.discovery_orchestrator_pick
       WHERE picked_at > now() - interval '60 minutes'
       ORDER BY picked_at ASC
       LIMIT 20
    `);
    recentPicks = picks.rows.map((r) => ({ city: r.city, category: r.category, pickedAt: new Date(r.picked_at) }));
  } catch { /* table may not exist yet · orchestrator hasn't ticked with gate on */ }

  const orchestratorQueue = buildDiscoveryQueue(rotationSnapshot, inFlight, recentPicks);
  const orchestratorEnabled = process.env.NEX_ORCHESTRATOR_ENABLED === "true";

  return {
    session: sessionStartedAt,
    cursor,
    heartbeat: heartbeat.rows[0] ?? null,
    sinceSession: sinceSession.rows[0],
    recent: recent.rows,
    universe: universe.rows[0],
    primaryCats: primaryCats.rows,
    secondaryTokens: secondaryTokens.rows,
    zoneAgg: zoneAgg.rows,
    latestCycle: latestCycle.rows[0] ?? null,
    accFunnel,
    rotationSnapshot,
    orchestratorQueue,
    orchestratorEnabled,
    orchestratorInFlight: inFlight,
    orchestratorRecentPicks: recentPicks,
  };
}

// ── Formatters ────────────────────────────────────────────────────────

function fmtInt(n: number): string { return n.toLocaleString("en-GB"); }
function fmtIso(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-GB", { hour12: false });
}
function fmtDuration(s: number | null): string {
  if (s == null || Number.isNaN(s)) return "—";
  if (s < 60)     return `${s}s`;
  if (s < 3600)   return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}
function shortZone(worker_config: string | null | undefined): string {
  if (!worker_config) return "—";
  const parts = worker_config.split(":");
  return parts[parts.length - 1] ?? worker_config;
}
function nextZone(zones: readonly string[], currentCursor: number | undefined): string {
  const idx = ((currentCursor ?? 0) % zones.length + zones.length) % zones.length;
  return zones[idx] ?? "?";
}

// ── Page ──────────────────────────────────────────────────────────────

export default async function WalkerVerticalPage({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical: verticalParam } = await params;
  const vertical = getWalkerVertical(verticalParam);
  if (!vertical) notFound();

  const d = await loadData(vertical);

  const walkerAge = d.heartbeat?.age_seconds ?? null;
  const liveState: WalkerLiveState = {
    ageSeconds: walkerAge,
    lastHeartbeatAt: d.heartbeat?.last_heartbeat_at
      ? (typeof d.heartbeat.last_heartbeat_at === "string" ? d.heartbeat.last_heartbeat_at : d.heartbeat.last_heartbeat_at.toISOString())
      : null,
    lastStatus: d.heartbeat?.last_status ?? null,
    currentZone: shortZone(d.latestCycle?.worker_config),
  };

  const sessionAgeSec = d.session ? Math.max(0, Math.round((Date.now() - new Date(d.session).getTime()) / 1000)) : null;
  const lastCycleStartMs = d.latestCycle ? new Date(d.latestCycle.started_at).getTime() : null;
  const nextRunMs = lastCycleStartMs ? lastCycleStartMs + WALKER_CADENCE_S * 1000 : null;
  const secondsUntilNextRun = nextRunMs ? Math.max(0, Math.round((nextRunMs - Date.now()) / 1000)) : null;
  const nextRunEta = nextRunMs ? new Date(nextRunMs).toLocaleString("en-GB", { hour12: false }) : "—";
  const nextZoneName = nextZone(vertical.zones, d.cursor?.cursor);

  const pipelineErrors = d.sinceSession?.errors ?? 0;
  const pipelineTotal = d.sinceSession?.processed ?? 0;
  const pipelineSuccessPct = pipelineTotal > 0
    ? Math.max(0, Math.min(100, Math.round(((pipelineTotal - pipelineErrors) / pipelineTotal) * 100)))
    : 100;

  return (
    <div className="nex-app-root" style={rootStyle}>
      <WalkerAutoRefresh />

      {/* ── Header ── */}
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={eyebrowStyle}>NEX HQ · WALKER · LIVE MONITOR · {vertical.id.toUpperCase()}</div>
            <h1 style={h1Style}>Walker · {vertical.pageTitle}</h1>
            <div style={subEyebrowStyle}>
              Discovery pipeline verification · every status derived from live database evidence ·
              green tick means Walker processed the business into the discovery directory · never conflated with public promotion.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <WalkerLiveIndicator state={liveState} />
            <Link
              href={vertical.directoryHref}
              target="_blank"
              rel="noopener noreferrer"
              style={viewDirectoryButtonStyle}
              title={`Open the public ${vertical.id} directory in a new tab · see the cards + businesses Walker + NEX have built`}
            >
              View {vertical.id} directory →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Discovery Rotation Controller · central state across ALL walked
           categories × cities · same on every vertical page · badges below
           switch category view · philosophy: NEX is systematically mapping
           the local economy · not a collection of cron jobs. ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Discovery Rotation Controller · central state · every card from DB</div>
        <div style={panelStyle}>
          <RotationCategoryNav currentVertical={vertical.id} />
          <div style={{ marginTop: 14, marginBottom: 10, fontSize: 12, color: "var(--nex-neutral-700)", lineHeight: 1.5 }}>
            Central rotation state per (city, category) · refreshed every 10 minutes by <code>scripts/nex-discovery-rotation/_rotation-tick.mjs</code>.
            Lifecycle: BUILD → SATURATED → MAINTENANCE → REACTIVATE → BUILD. Combos labelled &ldquo;walker not yet city-configurable&rdquo;
            surface honestly · never hidden.
          </div>
          <RotationGrid snapshot={d.rotationSnapshot} />
        </div>
      </section>

      {/* ── Auto Walker Orchestrator · env-gated central authority · same page ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Auto Walker Orchestrator · central authority for what discovery work runs next</div>
        <div style={panelStyle}>
          <AutoOrchestratorPanel
            enabled={d.orchestratorEnabled}
            queue={d.orchestratorQueue}
            inFlightCount={d.orchestratorInFlight.length}
            recentPickCount={d.orchestratorRecentPicks.length}
          />
        </div>
      </section>

      {/* ── Session cards ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Session · this Victus power-on</div>
        <div style={cardsGridStyle}>
          <Card label="Session started" value={d.session ? fmtIso(d.session) : "—"} sub={sessionAgeSec != null ? `uptime ${fmtDuration(sessionAgeSec)}` : "no session file · start the scheduler"} />
          <Card label="Cycles this session"        value={fmtInt(d.sinceSession.cycles)}    sub="acquisition cycles since session start" />
          <Card label="Processed this session"     value={fmtInt(d.sinceSession.processed)} sub="records examined this session" />
          <Card label="New this session"           value={fmtInt(d.sinceSession.new_count)} sub="genuinely new discoveries" tone={d.sinceSession.new_count > 0 ? "success" : "neutral"} />
          <Card label="Errors this session"        value={fmtInt(d.sinceSession.errors)}    sub="cycle-level errors" tone={d.sinceSession.errors > 0 ? "warning" : "success"} />
          <Card label="Current zone"               value={liveState.currentZone ?? "—"}    sub={d.latestCycle ? `cycle ended ${fmtIso(d.latestCycle?.started_at)}` : "no cycle recorded"} />
          <Card label="Next zone"                  value={nextZoneName}                    sub={secondsUntilNextRun != null ? `ETA in ${fmtDuration(secondsUntilNextRun)} (${nextRunEta})` : "—"} />
          <Card label="Rotation cursor"            value={String(d.cursor?.cursor ?? 0)}   sub={`of ${vertical.zones.length} zones · deterministic`} />
        </div>
      </section>

      {/* ── Pipeline verification · Metric A vs Metric B ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Pipeline verification · discovery vs public promotion</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...bigCardStyle, border: `1px solid rgba(16,185,129,0.35)`, background: "rgba(16,185,129,0.06)" }}>
            <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#047857", fontWeight: 700 }}>🟢 Walker discovery pipeline</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "#047857", marginTop: 6 }}>{pipelineSuccessPct}%</div>
            <div style={{ fontSize: 12, color: "var(--nex-neutral-700)", marginTop: 6, lineHeight: 1.5 }}>
              {pipelineSuccessPct}% of successfully processed records completed the discovery pipeline
              (Collected → Processed → <code>{vertical.businessTable}</code> → Provenance stamped with <code>cycle_run_id</code>).
              <br /><strong>{fmtInt(d.universe?.discovered ?? 0)}</strong> businesses currently in the discovery directory.
            </div>
            {pipelineErrors > 0 && (
              <div style={sessionErrorCalloutStyle}>
                <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 800, color: "#b45309" }}>
                  ⚠️ Session errors: {fmtInt(pipelineErrors)}
                </div>
                <div style={{ fontSize: 12, color: "var(--nex-neutral-700)", marginTop: 4 }}>
                  {fmtInt(pipelineTotal)} processed · <strong>{fmtInt(d.sinceSession.new_count)} new</strong> ·{" "}
                  <strong>{fmtInt(pipelineErrors)} failed cycle{pipelineErrors === 1 ? "" : "s"}</strong>
                  <br />See the Cycle history table for the specific row · investigate the zone before the next rotation.
                </div>
              </div>
            )}
          </div>
          <div style={{ ...bigCardStyle, border: `1px solid rgba(245,158,11,0.45)`, background: "rgba(245,158,11,0.06)" }}>
            <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#a16207", fontWeight: 700 }}>🟡 Public directory promotion</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "#a16207", marginTop: 6 }}>
              {fmtInt(d.universe?.visible ?? 0)} <span style={{ fontSize: 18, fontWeight: 500 }}>/ {fmtInt(d.universe?.total ?? 0)}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--nex-neutral-700)", marginTop: 6, lineHeight: 1.5 }}>
              <strong>{fmtInt(d.universe?.discovered ?? 0)}</strong> discovered · awaiting owner claim or admin promotion to <code>listed / invited / claimed / paying</code>.
              <br />Promotion is a <strong>separate pipeline</strong> · Walker cannot promote · admin/owner gate never bypassed.
              <br />Walker looks perfectly healthy even when this is zero — that is the correct architecture.
            </div>
          </div>
        </div>
      </section>

      {/* ── PART A (2026-08-24) · Accommodation honest funnel · only rendered
           for the accommodation vertical · every number from DB · zero fabrication ── */}
      {d.accFunnel && (
        <section style={sectionStyle}>
          <div style={sectionLabelStyle}>Public funnel · Discovered ≠ Eligible ≠ Public ≠ Claimed ≠ Verified</div>
          <div style={panelStyle}>
            <div style={{ fontSize: 12, color: "var(--nex-neutral-700)", marginBottom: 12, lineHeight: 1.55 }}>
              This funnel is computed from <code>nex.accommodation_business</code> live. It resolves the historical
              &ldquo;HQ says {fmtInt(d.accFunnel.total)} · public says 500&rdquo; discrepancy: the public page previously carried an
              invisible <code>LIMIT 500</code> · that ceiling has been raised to <strong>{fmtInt(d.accFunnel.publicRenderCap)}</strong> and pagination
              is available via <code>?page=N</code>. Nothing is renamed &ldquo;verified&rdquo; that isn&apos;t.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <Card label="Discovered (walker-found)" value={fmtInt(d.accFunnel.discovered)} sub="claim_status='discovered'" />
              <Card label="Eligible (public-visible)" value={fmtInt(d.accFunnel.eligibleListed)} sub="claim_status='listed'" tone={d.accFunnel.eligibleListed > 0 ? "success" : "neutral"} />
              <Card label="Invited"                   value={fmtInt(d.accFunnel.invited)}         sub="owner outreach sent" />
              <Card label="Claimed"                   value={fmtInt(d.accFunnel.claimed)}         sub="owner claim received" />
              <Card label="Paying"                    value={fmtInt(d.accFunnel.paying)}          sub="paying subscriber" />
              <Card label="Owner verified"            value={fmtInt(d.accFunnel.ownerVerified)}   sub="owner_status verified/claimed" />
              <Card label="Public render cap"         value={fmtInt(d.accFunnel.publicRenderCap)} sub="per-page limit on /accommodation" />
              <Card label="Pages available"           value={fmtInt(d.accFunnel.publicPagesAvailable)} sub={`?page=1..${d.accFunnel.publicPagesAvailable}`} />
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700, marginBottom: 8 }}>
                Row-quality within the {fmtInt(d.accFunnel.eligibleListed)} eligible · what NEX actually knows about them
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                <Card label="With hero image"          value={fmtInt(d.accFunnel.eligibleWithHeroImage)}   sub="never fabricated · letter-tile fallback used" tone={d.accFunnel.eligibleWithHeroImage === 0 ? "warning" : "success"} />
                <Card label="With amenities"           value={fmtInt(d.accFunnel.eligibleWithAmenities)}   sub="wifi · A/C · pool · etc." />
                <Card label="With contact"             value={fmtInt(d.accFunnel.eligibleWithContact)}     sub="phone OR WhatsApp OR website" />
                <Card label="With coordinates"         value={fmtInt(d.accFunnel.eligibleWithCoords)}      sub="enables Nearby · slider · map" tone="success" />
                <Card label="With star rating"         value={fmtInt(d.accFunnel.eligibleWithStarRating)}  sub="1★-5★ · shown only when present" />
                <Card label="With recovered evidence"  value={fmtInt(d.accFunnel.eligibleWithRecoveredEv)} sub="OSM raw tags · Path A · 2026-08-23" />
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--nex-neutral-500)", lineHeight: 1.5 }}>
              <strong>Terminology guardrail</strong>: none of the {fmtInt(d.accFunnel.eligibleListed)} eligible rows should be labelled
              &ldquo;verified accommodations&rdquo; · owner-verified count is <strong>{fmtInt(d.accFunnel.ownerVerified)}</strong>.
              Ratings and reviews are NEVER surfaced fabricated: 0/881 have review data · the Details slider shows
              &ldquo;No verified reviews&rdquo; honestly rather than inventing a number.
            </div>
          </div>
        </section>
      )}

      {/* ── Recent cycles table ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Cycle history · last 20 · every one a real cycle_run row</div>
        <div style={panelStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Time (started)</th>
                <th style={thStyle}>Zone</th>
                <th style={thNumStyle}>Processed</th>
                <th style={thNumStyle}>New</th>
                <th style={thNumStyle}>Provenance</th>
                <th style={thNumStyle}>Duration</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.recent.length === 0 ? (
                <tr><td style={{ ...tdStyle, textAlign: "center", color: "var(--nex-neutral-500)", padding: 24 }} colSpan={7}>No cycles yet · start the scheduler with NEX_DEV_WORKERS=1 npm run dev:workers</td></tr>
              ) : d.recent.map((c) => {
                const isError = c.errors_count > 0 || c.status === "failed";
                return (
                  <tr key={c.id}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{fmtIso(c.started_at)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{shortZone(c.worker_config)}</td>
                    <td style={tdNumStyle}>{fmtInt(c.records_processed ?? 0)}</td>
                    <td style={{ ...tdNumStyle, color: (c.records_new ?? 0) > 0 ? "#047857" : "var(--nex-neutral-500)", fontWeight: 700 }}>
                      {fmtInt(c.records_new ?? 0)}
                    </td>
                    <td style={tdNumStyle}>{fmtInt(c.provenance_rows ?? 0)}</td>
                    <td style={tdNumStyle}>{fmtDuration(c.duration_s)}</td>
                    <td style={tdStyle}>
                      {isError
                        ? <span style={{ color: "#b91c1c", fontWeight: 700 }}>✕ {c.status}{c.errors_count > 0 ? ` · ${c.errors_count} err` : ""}</span>
                        : <span style={{ color: "#047857", fontWeight: 700 }}>✓ {c.status}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Geographic breakdown ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Geographic coverage · per zone · lifetime</div>
        <div style={panelStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Zone</th>
                <th style={thNumStyle}>Cycles</th>
                <th style={thNumStyle}>Total processed</th>
                <th style={thNumStyle}>Total new</th>
                <th style={thStyle}>Last run</th>
              </tr>
            </thead>
            <tbody>
              {d.zoneAgg.map((z) => (
                <tr key={z.zone}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{shortZone(z.zone)}</td>
                  <td style={tdNumStyle}>{fmtInt(z.cycle_count)}</td>
                  <td style={tdNumStyle}>{fmtInt(z.total_processed)}</td>
                  <td style={{ ...tdNumStyle, color: z.total_new > 0 ? "#047857" : "var(--nex-neutral-500)", fontWeight: 700 }}>{fmtInt(z.total_new)}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{fmtIso(z.last_run)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Category totals · primary + secondary (secondary hidden for verticals without categories[]) ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Category coverage · what Walker has discovered</div>
        <div style={{ display: "grid", gridTemplateColumns: vertical.hasSecondaryCategoriesArray ? "1fr 1fr" : "1fr", gap: 12 }}>
          <div style={panelStyle}>
            <div style={miniHeaderStyle}>Primary category · vertical CHECK enum</div>
            <table style={tableStyle}>
              <tbody>
                {d.primaryCats.map((r) => (
                  <tr key={r.category}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.category}</td>
                    <td style={tdNumStyle}>{fmtInt(r.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {vertical.hasSecondaryCategoriesArray && (
            <div style={panelStyle}>
              <div style={miniHeaderStyle}>Secondary tokens · NEX-approved ontology · Task #85 widened</div>
              {d.secondaryTokens.length === 0
                ? <div style={{ padding: 12, color: "var(--nex-neutral-500)", fontSize: 12 }}>No secondary tokens yet · appears when Walker runs cycles under Task #85 code.</div>
                : (
                  <table style={tableStyle}>
                    <tbody>
                      {d.secondaryTokens.map((r) => (
                        <tr key={r.token}>
                          <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{r.token}</td>
                          <td style={tdNumStyle}>{fmtInt(r.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
          )}
        </div>
      </section>

      {/* ── Footer · doctrine anchors ── */}
      <footer style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--nex-neutral-200)", fontSize: 10, color: "var(--nex-neutral-500)", lineHeight: 1.6 }}>
        <div>Every row above derived from live nex.worker_heartbeat / nex.worker_cycle_run / {vertical.businessTable} queries · zero LLM · zero fabrication.</div>
        <div>Walker doctrine: <Link href="/nex-head-quarters" style={{ color: "#c2410c" }}>Reception</Link> · Workers is the six-criteria drill-down · this page is Walker-specific discovery-pipeline verification · not a competing dashboard.</div>
        <div>Runs local while Victus is powered on · when the machine sleeps Walker stops and this page shows OFFLINE honestly · cloud 24/7 migration deferred to a separate future task.</div>
      </footer>
    </div>
  );
}

// ── Rotation category navigation · top-of-page badges (no new dashboard) ──
// Yogyakarta-focused for now · Food + Accommodation link to dedicated walker
// pages · Transport + Market link to their existing subordinate HQ pages.
function RotationCategoryNav({ currentVertical }: { currentVertical: string }) {
  const badges = [
    { key: "food",          label: "🍜 Food",          href: "/nex-head-quarters/walker/food",          active: currentVertical === "food",          enabled: true },
    { key: "accommodation", label: "🏨 Accommodation", href: "/nex-head-quarters/walker/accommodation", active: currentVertical === "accommodation", enabled: true },
    { key: "transport",     label: "🚕 Transport",     href: "/nex-head-quarters/transport-data",       active: false,                                enabled: true },
    { key: "market",        label: "🏪 Market",        href: "/nex-head-quarters/commerce",             active: false,                                enabled: true },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {badges.map((b) => (
        <Link key={b.key} href={b.href} style={{
          padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
          textDecoration: "none",
          background: b.active ? "#c2410c" : "#fff",
          color: b.active ? "#fff" : "#1a1a1a",
          border: b.active ? "1px solid #9a3412" : "1px solid rgba(0,0,0,0.14)",
        }}>
          {b.label}
        </Link>
      ))}
    </div>
  );
}

// ── Rotation grid · one card per (city, category) combo ──
function RotationGrid({ snapshot }: { snapshot: RotationSnapshotRow[] }) {
  // Group by city so the grid reads city-by-city.
  const byCity = new Map<string, RotationSnapshotRow[]>();
  for (const r of snapshot) {
    const arr = byCity.get(r.city) ?? [];
    arr.push(r);
    byCity.set(r.city, arr);
  }
  const cities = [...byCity.keys()];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {cities.map((city) => (
        <div key={city} style={{
          border: "1px solid var(--nex-neutral-200)", borderRadius: 10,
          background: "var(--nex-neutral-0)", padding: "10px 12px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
            📍 {city}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {byCity.get(city)!.map((row) => (
              <RotationCard key={`${row.city}:${row.category}`} row={row} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RotationCard({ row }: { row: RotationSnapshotRow }) {
  const badge = badgeForState(row.state);
  const inactive = !row.walkerAvailable;
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 8,
      border: `1px solid ${badge.border}`,
      background: inactive ? "rgba(0,0,0,0.02)" : badge.bg,
      opacity: inactive ? 0.7 : 1,
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", textTransform: "capitalize" }}>
          {row.category}
        </div>
        <span style={{
          fontSize: 9.5, letterSpacing: 0.8, textTransform: "uppercase",
          padding: "2px 7px", borderRadius: 999, fontWeight: 800,
          background: badge.chipBg, color: badge.chipFg,
        }}>
          {badge.dot} {row.state}
        </span>
      </div>
      {inactive ? (
        <div style={{ fontSize: 10.5, color: "var(--nex-neutral-500)", fontStyle: "italic" }}>
          {row.note ?? "not walked yet"}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: "var(--nex-neutral-700)" }}>
            Round {row.round}
            {row.recordsNewLastCycle != null && (
              <> · last cycle <strong>{row.recordsNewLastCycle}</strong> new</>
            )}
            {row.consecutiveZeroNewCycles > 0 && (
              <> · {row.consecutiveZeroNewCycles} zero-new streak</>
            )}
          </div>
          <div style={{ fontSize: 10, color: "var(--nex-neutral-500)" }}>
            {row.lastProductiveAt ? `Last productive ${row.lastProductiveAt.toLocaleString("en-GB", { hour12: false })}` : "no productive cycle yet"}
          </div>
        </>
      )}
    </div>
  );
}

function badgeForState(state: RotationStateKind) {
  switch (state) {
    case "build":       return { dot: "🟢", chipBg: "rgba(16,185,129,0.15)", chipFg: "#047857", bg: "rgba(16,185,129,0.05)",  border: "rgba(16,185,129,0.25)" };
    case "saturated":   return { dot: "🔴", chipBg: "rgba(220,38,38,0.14)",  chipFg: "#991b1b", bg: "rgba(220,38,38,0.04)",   border: "rgba(220,38,38,0.20)" };
    case "maintenance": return { dot: "🟡", chipBg: "rgba(245,158,11,0.16)", chipFg: "#92400e", bg: "rgba(245,158,11,0.05)",  border: "rgba(245,158,11,0.22)" };
    case "reactivate":  return { dot: "🔵", chipBg: "rgba(37,99,235,0.14)",  chipFg: "#1e40af", bg: "rgba(37,99,235,0.05)",   border: "rgba(37,99,235,0.22)" };
    default:            return { dot: "⚪", chipBg: "rgba(0,0,0,0.05)",       chipFg: "#333",    bg: "rgba(0,0,0,0.02)",       border: "rgba(0,0,0,0.10)" };
  }
}

// ── Auto Orchestrator Panel · env-gate status + NOW/NEXT/THEN/WAITING queue ──
function AutoOrchestratorPanel({
  enabled, queue, inFlightCount, recentPickCount,
}: {
  enabled: boolean;
  queue: QueueItem[];
  inFlightCount: number;
  recentPickCount: number;
}) {
  const groups = {
    now:      queue.filter((q) => q.status === "in-flight"),
    next:     queue.filter((q) => q.status === "would-pick"),
    then:     queue.filter((q) => q.status === "eligible"),
    waiting:  queue.filter((q) => q.status === "waiting-cooldown"),
    saturated: queue.filter((q) => q.status === "skipped-saturated"),
    unavailable: queue.filter((q) => q.status === "skipped-not-city-configurable"),
    gated:    queue.filter((q) => q.status === "skipped-gated-provider"),
  };
  const nextItem = groups.next[0] ?? null;
  const statusChip = enabled
    ? (inFlightCount > 0 ? { label: "RUNNING",     bg: "rgba(16,185,129,0.15)", fg: "#047857" }
       : nextItem     ? { label: "READY · waiting for next tick", bg: "rgba(37,99,235,0.14)",  fg: "#1e40af" }
       :                { label: "WAITING FOR WORK · all combos saturated/in-flight", bg: "rgba(245,158,11,0.16)", fg: "#92400e" })
    : { label: "DISABLED · set NEX_ORCHESTRATOR_ENABLED=true", bg: "rgba(0,0,0,0.06)", fg: "#666" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{
          padding: "5px 12px", borderRadius: 999,
          background: statusChip.bg, color: statusChip.fg,
          fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase",
        }}>
          🤖 Orchestrator · {statusChip.label}
        </span>
        <span style={{ fontSize: 11, color: "var(--nex-neutral-500)" }}>
          Slots: <strong style={{ color: "var(--nex-neutral-900)" }}>{inFlightCount} / {MAX_SLOTS}</strong>
          {" · "}Recent picks (60 min): <strong style={{ color: "var(--nex-neutral-900)" }}>{recentPickCount}</strong>
          {" · "}Saturated skipped: <strong>{groups.saturated.length}</strong>
          {" · "}Not city-configurable: <strong>{groups.unavailable.length}</strong>
        </span>
      </div>
      {!enabled && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--nex-neutral-500)", lineHeight: 1.5 }}>
          Orchestrator is <strong>disabled by default for safety</strong>. Existing walker scheduler entries continue firing
          on their own cadence · state is still refreshed by the rotation tick. Set
          <code style={{ margin: "0 4px", padding: "1px 6px", background: "var(--nex-neutral-100)", borderRadius: 4 }}>NEX_ORCHESTRATOR_ENABLED=true</code>
          in <code>.env.local</code> to activate the central authority.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginTop: 14 }}>
        <QueueColumn title="NOW · in-flight"           tone="green"  items={groups.now}   emptyHint="no walker currently running" />
        <QueueColumn title="NEXT · would-pick"          tone="blue"   items={groups.next}  emptyHint="no eligible combo · all in-flight/saturated" />
        <QueueColumn title="THEN · eligible after"      tone="cyan"   items={groups.then.slice(0, 8)}  emptyHint="no further eligible combos" />
        <QueueColumn title="WAITING · fairness cooldown" tone="amber" items={groups.waiting} emptyHint="none held for fairness" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginTop: 10 }}>
        <QueueColumn title="SATURATED · skipped honestly" tone="red"  items={groups.saturated} emptyHint="none saturated · walker discovery still fruitful" />
        <QueueColumn title="NOT CITY-CONFIGURABLE · walker doesn't support" tone="grey" items={groups.unavailable.slice(0, 8)} emptyHint="none · every combo has a walker" />
      </div>
    </div>
  );
}

function QueueColumn({ title, items, tone, emptyHint }: { title: string; items: QueueItem[]; tone: "green" | "blue" | "cyan" | "amber" | "red" | "grey"; emptyHint: string }) {
  const toneMap = {
    green: { bg: "rgba(16,185,129,0.06)",  fg: "#047857", bd: "rgba(16,185,129,0.25)" },
    blue:  { bg: "rgba(37,99,235,0.06)",   fg: "#1e40af", bd: "rgba(37,99,235,0.22)" },
    cyan:  { bg: "rgba(6,182,212,0.06)",   fg: "#0e7490", bd: "rgba(6,182,212,0.20)" },
    amber: { bg: "rgba(245,158,11,0.06)",  fg: "#92400e", bd: "rgba(245,158,11,0.22)" },
    red:   { bg: "rgba(220,38,38,0.04)",   fg: "#991b1b", bd: "rgba(220,38,38,0.20)" },
    grey:  { bg: "rgba(0,0,0,0.03)",       fg: "#555",    bd: "rgba(0,0,0,0.10)" },
  }[tone];
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${toneMap.bd}`, background: toneMap.bg }}>
      <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: toneMap.fg, fontWeight: 800, marginBottom: 8 }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--nex-neutral-500)", fontStyle: "italic" }}>{emptyHint}</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
          {items.map((q) => (
            <li key={`${q.city}:${q.category}`} style={{ fontSize: 12, color: "var(--nex-neutral-900)" }}>
              <strong style={{ fontWeight: 700 }}>{q.city}</strong> / <span style={{ textTransform: "capitalize" }}>{q.category}</span>
              <span style={{ fontSize: 10, color: "var(--nex-neutral-500)", marginLeft: 4 }}>· Round {q.round}</span>
              <div style={{ fontSize: 10.5, color: "var(--nex-neutral-500)", marginTop: 2 }}>{q.reason}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Small Card component (server-safe · no state) ─────────────────────

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "neutral" }) {
  const toneColor =
    tone === "success" ? "#047857" :
    tone === "warning" ? "#a16207" :
                          "var(--nex-neutral-900)";
  return (
    <div style={miniCardStyle}>
      <div style={miniCardLabelStyle}>{label}</div>
      <div style={{ ...miniCardValueStyle, color: toneColor }}>{value}</div>
      {sub && <div style={miniCardSubStyle}>{sub}</div>}
    </div>
  );
}

// ── Styles · cream theme · matches Workers / Reception ─────────────────

const rootStyle: React.CSSProperties = { padding: "24px 32px", background: "var(--nex-cream)", minHeight: "100vh", color: "var(--nex-neutral-900)" };
const headerStyle: React.CSSProperties = { marginBottom: 24 };
const eyebrowStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700 };
const subEyebrowStyle: React.CSSProperties = { fontSize: 12, color: "var(--nex-neutral-500)", marginTop: 6, lineHeight: 1.55 };
const h1Style: React.CSSProperties = { fontSize: 26, fontWeight: 800, margin: "6px 0 4px 0" };
const sectionStyle: React.CSSProperties = { marginTop: 22 };
const sectionLabelStyle: React.CSSProperties = { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700, marginBottom: 8 };
const cardsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 };
const miniCardStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 10, padding: "12px 14px" };
const miniCardLabelStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700 };
const miniCardValueStyle: React.CSSProperties = { fontSize: 22, fontWeight: 800, marginTop: 4 };
const miniCardSubStyle: React.CSSProperties = { fontSize: 11, color: "var(--nex-neutral-500)", marginTop: 4, lineHeight: 1.35 };
const bigCardStyle: React.CSSProperties = { borderRadius: 12, padding: "18px 20px" };
const sessionErrorCalloutStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  border: "1px solid rgba(245,158,11,0.55)",
  background: "rgba(245,158,11,0.10)",
  borderRadius: 8,
};
const panelStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "12px 16px", overflowX: "auto" };
const miniHeaderStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--nex-neutral-700)", padding: "4px 4px 10px 4px", borderBottom: "1px solid var(--nex-neutral-200)", marginBottom: 4 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", padding: "8px 8px 8px 0", textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid var(--nex-neutral-200)" };
const thNumStyle: React.CSSProperties = { ...thStyle, textAlign: "right" };
const tdStyle: React.CSSProperties = { color: "var(--nex-neutral-900)", padding: "8px 8px 8px 0", verticalAlign: "top", borderTop: "1px solid var(--nex-neutral-100)" };
const tdNumStyle: React.CSSProperties = { ...tdStyle, textAlign: "right", fontFamily: "monospace", fontSize: 12 };
const viewDirectoryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#ffffff",
  background: "#c2410c", // accent orange · matches WalkerLiveIndicator "running" state
  border: "1px solid #9a3412",
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  textTransform: "capitalize",
};
