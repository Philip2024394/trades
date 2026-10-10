// EMAIL HARVEST · Operations Live
//
// Per-second real-DB live feed for the HQ Operations Centre.
// Every number rendered comes from a fresh /api/nex/founder/email-harvest/operations-live
// query. Refresh cadence = 1 second. No client-side counters. No timer-driven
// animation. If the page number changes, a fresh DB read produced it.
//
// The `Fetch age` counter visible to the operator IS a client-side elapsed
// timer — but it only ticks between fetches, resets on every new payload, and
// its purpose is transparency (making per-second cadence auditable), not
// pretending activity.

"use client";

import { useEffect, useRef, useState } from "react";
import type { EmailHarvestPage } from "@/lib/nex-hq/email-harvest-manifest";

interface OperationsLiveFeed {
  ok: boolean;
  server_now: string;
  query_duration_ms: number;
  queue: { queued: number; claimed: number; completed: number; failed: number; dead_letter: number; by_type: Record<string, Record<string, number>> };
  workers: { active_count: number; recent: any[] };
  agents: { total: number; active_count: number; signed_count: number; detail: any[] };
  cycles: { active_count: number; completed_last_hour: number; active_detail: any[]; recent: any[] };
  current_selection: any | null;
  cooldowns_active: any[];
  totals: {
    candidates_total: number; candidates_with_website: number; candidates_walked_ok: number;
    evidence_rows_total: number; evidence_with_email: number; countries_with_email: number;
  };
  rediscoveries_total: number;
  reaper_releases_last_hour: number;
  failures_last_hour: any[];
  by_country: any[];
  by_source: any[];
  latest_heartbeat: { at: string | null; age_seconds: number | null };
  harvest_rate: { walks_last_5min: number; candidates_last_5min: number; emails_last_5min: number };
  recent_events: any[];
  recent_email_discoveries: any[];
  standing_marketing_status_line: string;
  cron_activation_state: string;
  page_fetcher_activation_state: string;
  warning?: string;
  error?: string;
  detail?: string;
}

const FETCH_CADENCE_MS = 1000;

export default function EmailHarvestOperationsLive({ page }: { page: EmailHarvestPage }) {
  const [feed, setFeed] = useState<OperationsLiveFeed | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function doFetch() {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const t0 = performance.now();
        const r = await fetch("/api/nex/founder/email-harvest/operations-live", { cache: "no-store" });
        const j: OperationsLiveFeed = await r.json();
        if (cancelled) return;
        if (!j.ok && !j.warning) throw new Error(j.error ?? "fetch failed");
        setFeed(j);
        setLastFetchAt(new Date());
        setFetchCount(c => c + 1);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally { inFlight.current = false; }
    }
    void doFetch();
    const iv = setInterval(() => { void doFetch(); }, FETCH_CADENCE_MS);
    const clock = setInterval(() => setTick(t => t + 1), 100);
    return () => { cancelled = true; clearInterval(iv); clearInterval(clock); };
  }, []);

  const fetchAgeMs = lastFetchAt ? Date.now() - lastFetchAt.getTime() : 0;
  const payloadAgeMs = feed?.server_now ? Date.now() - new Date(feed.server_now).getTime() : 0;

  return (
    <div style={{ padding: 24, background: "#0a0a0a", color: "#e5e7eb", minHeight: "100vh", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
      {/* Header · always visible */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, marginBottom: 24, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{page.label.toUpperCase()} · HQ OPERATIONS CENTRE</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#f9fafb" }}>NEX Live Harvest Feed</h1>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>
            Every number below is a fresh SQL query result. No cached counters. No fake animation. Refresh cadence: {FETCH_CADENCE_MS}ms.
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#9ca3af" }}>
          <div>Fetches: <span style={{ color: "#f9fafb", fontWeight: 700 }}>{fetchCount}</span></div>
          <div>Fetch age: <span style={{ color: fetchAgeMs > 2000 ? "#f87171" : "#34d399" }}>{fetchAgeMs}ms</span></div>
          <div>Server clock: {feed?.server_now?.slice(11, 23) ?? "—"}</div>
          <div>Payload age: <span style={{ color: payloadAgeMs > 3000 ? "#f87171" : "#34d399" }}>{payloadAgeMs}ms</span></div>
          <div>Query took: {feed?.query_duration_ms ?? "—"}ms</div>
        </div>
      </div>

      {error && (
        <Panel accent="#dc2626" title="⚠ Fetch error">
          <div style={{ color: "#fca5a5" }}>{error}</div>
        </Panel>
      )}
      {feed?.warning && (
        <Panel accent="#eab308" title="⚠ Warning">
          <div style={{ color: "#fbbf24" }}>{feed.warning}: {feed.detail}</div>
        </Panel>
      )}

      {/* Activation gates */}
      <Panel title="🔐 Activation state (Founder-controlled)">
        <Grid cols={2}>
          <Kv k="NEX_PAGE_FETCHER_ACTIVATION" v={feed?.page_fetcher_activation_state ?? "—"} good={feed?.page_fetcher_activation_state === "on"} />
          <Kv k="NEX_DISCOVERY_CRON_ACTIVATION" v={feed?.cron_activation_state ?? "—"} good={feed?.cron_activation_state === "on"} />
        </Grid>
      </Panel>

      {/* Current selection · what is happening RIGHT NOW */}
      <Panel title="🔎 Current source selection (most recent decision event)">
        {feed?.current_selection ? (
          <Grid cols={2}>
            <Kv k="Country" v={feed.current_selection.country_iso ?? "—"} />
            <Kv k="Term" v={feed.current_selection.term ?? "—"} />
            <Kv k="Selected source" v={feed.current_selection.selected_source ?? "no source available"} />
            <Kv k="Reason" v={feed.current_selection.reason ?? "—"} />
            <Kv k="At" v={feed.current_selection.at?.slice(11, 23) ?? "—"} />
            <Kv k="Cycle" v={feed.current_selection.cycle_id?.slice(0, 8) ?? "—"} />
          </Grid>
        ) : <Empty>No source-selection decision event recorded yet.</Empty>}
      </Panel>

      {/* Totals */}
      <Panel title="🏢 Totals (real DB counts)">
        <Grid cols={4}>
          <Kv k="Candidates total" v={feed?.totals?.candidates_total ?? "—"} big />
          <Kv k="With website" v={feed?.totals?.candidates_with_website ?? "—"} big />
          <Kv k="Walked ok" v={feed?.totals?.candidates_walked_ok ?? "—"} big />
          <Kv k="Evidence rows" v={feed?.totals?.evidence_rows_total ?? "—"} big />
          <Kv k="With email" v={feed?.totals?.evidence_with_email ?? "—"} big />
          <Kv k="Countries w/email" v={feed?.totals?.countries_with_email ?? "—"} big />
          <Kv k="Rediscoveries" v={feed?.rediscoveries_total ?? "—"} big />
          <Kv k="Reaper (1h)" v={feed?.reaper_releases_last_hour ?? "—"} big />
        </Grid>
      </Panel>

      {/* Queue */}
      <Panel title="📥 Job queue (nex.harvest_job)">
        <Grid cols={5}>
          <Kv k="Queued" v={feed?.queue?.queued ?? "—"} />
          <Kv k="Claimed" v={feed?.queue?.claimed ?? "—"} />
          <Kv k="Completed" v={feed?.queue?.completed ?? "—"} />
          <Kv k="Failed" v={feed?.queue?.failed ?? "—"} />
          <Kv k="Dead-letter" v={feed?.queue?.dead_letter ?? "—"} />
        </Grid>
      </Panel>

      {/* Agents */}
      <Panel title="🤖 AOF agents (nex.aof_agent)">
        <Grid cols={3}>
          <Kv k="Total registered" v={feed?.agents?.total ?? "—"} />
          <Kv k="Active" v={feed?.agents?.active_count ?? "—"} good={feed?.agents?.active_count === 12} />
          <Kv k="Signed" v={feed?.agents?.signed_count ?? "—"} />
        </Grid>
        <Table
          headers={["Role", "Name", "Status", "Last seen"]}
          rows={(feed?.agents?.detail ?? []).map(a => [
            a.agent_role, a.agent_name, a.status,
            a.last_seen_age_seconds != null ? `${a.last_seen_age_seconds}s ago` : "never",
          ])}
        />
      </Panel>

      {/* Cycles */}
      <Panel title="🔄 Cycles (nex.aof_cycle)">
        <Grid cols={2}>
          <Kv k="Active" v={feed?.cycles?.active_count ?? "—"} />
          <Kv k="Completed (1h)" v={feed?.cycles?.completed_last_hour ?? "—"} />
        </Grid>
        <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>Recent cycles:</div>
        <Table
          headers={["seq", "started", "ended", "kind", "cand", "walks", "emails", "sources"]}
          rows={(feed?.cycles?.recent ?? []).map(c => [
            c.cycle_seq,
            c.started_at?.slice(11, 19),
            c.ended_at?.slice(11, 19) ?? "—",
            c.ended_kind ?? "running",
            c.candidates_added,
            c.walks_completed,
            c.emails_captured,
            (c.sources_succeeded ?? []).join(",") || "—",
          ])}
        />
      </Panel>

      {/* Cooldowns */}
      <Panel title="⏸ Sources on cooldown (nex.aof_source_cooldown)">
        {(feed?.cooldowns_active ?? []).length === 0 ? <Empty>No sources on cooldown.</Empty> : (
          <Table
            headers={["Source", "Reason", "Expires in", "Consec fails"]}
            rows={feed!.cooldowns_active.map(cd => [
              cd.source_slug,
              cd.last_failure_kind,
              `${cd.seconds_until_expiry}s`,
              cd.consecutive_failures,
            ])}
          />
        )}
      </Panel>

      {/* Harvest rate */}
      <Panel title="📈 Harvest rate (rolling 5-minute window)">
        <Grid cols={3}>
          <Kv k="Walks / 5min" v={feed?.harvest_rate?.walks_last_5min ?? "—"} />
          <Kv k="Candidates / 5min" v={feed?.harvest_rate?.candidates_last_5min ?? "—"} />
          <Kv k="Emails / 5min" v={feed?.harvest_rate?.emails_last_5min ?? "—"} />
        </Grid>
      </Panel>

      {/* Sources */}
      <Panel title="🗄 Founder-signed sources (nex.harvest_source)">
        <Table
          headers={["Slug", "Type", "Priority", "Enabled", "Cooldown", "Candidates", "Reliability"]}
          rows={(feed?.by_source ?? []).map(s => [
            s.source_slug, s.source_type, s.priority, s.enabled ? "yes" : "no",
            s.active_cooldown_until ? "⏸ " + s.active_cooldown_until.slice(11, 19) : "—",
            s.candidates_from_this_source,
            s.reliability_score,
          ])}
        />
      </Panel>

      {/* Countries */}
      <Panel title="🗺 By country (candidates + walked + evidence)">
        <Table
          headers={["ISO", "Candidates", "Walked ok", "Evidence", "With email"]}
          rows={(feed?.by_country ?? []).map(c => [c.iso, c.candidates, c.walked_ok, c.evidence, c.with_email])}
        />
      </Panel>

      {/* Recent event stream */}
      <Panel title="📡 Recent AOF events (nex.aof_agent_event · last 30)">
        <Table
          headers={["at", "kind", "summary", "cycle"]}
          rows={(feed?.recent_events ?? []).map(e => [
            e.at?.slice(11, 23), e.kind, e.summary, e.cycle_id?.slice(0, 8) ?? "—",
          ])}
        />
      </Panel>

      {/* Recent emails */}
      <Panel title="✉ Real public emails discovered (most recent 5)">
        {(feed?.recent_email_discoveries ?? []).length === 0 ? <Empty>No emails discovered yet.</Empty> : (
          <Table
            headers={["ISO", "Business", "Email", "From", "Via source"]}
            rows={feed!.recent_email_discoveries.map(e => [
              e.iso_alpha_2, e.business_name, e.discovered_email,
              e.email_source_url, e.discovered_via_source,
            ])}
          />
        )}
      </Panel>

      {/* Failures */}
      <Panel title="🔴 Failures in last hour (nex.aof_agent_event error/cooldown_applied/audit_fail)">
        {(feed?.failures_last_hour ?? []).length === 0 ? <Empty>No failures in last hour.</Empty> : (
          <Table
            headers={["at", "kind", "op", "snippet"]}
            rows={feed!.failures_last_hour.map(f => [
              f.at?.slice(11, 23), f.kind, f.op ?? "—", f.snippet,
            ])}
          />
        )}
      </Panel>

      {/* Standing marketing line — always at the bottom, verbatim */}
      <div style={{ marginTop: 32, padding: 16, background: "#111827", border: "1px solid #374151", borderRadius: 8 }}>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>STANDING MARKETING STATUS LINE (verbatim · governance-controlled)</div>
        <div style={{ fontSize: 14, color: "#e5e7eb", fontWeight: 600 }}>
          {feed?.standing_marketing_status_line ?? "NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD."}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: "#6b7280" }}>
        Data source authority: `nex.harvest_job` · `nex.harvest_worker` · `nex.harvest_source` · `nex.harvest_business_candidate` · `nex.discovery_business_evidence` · `nex.aof_agent` · `nex.aof_cycle` · `nex.aof_agent_event` · `nex.aof_source_cooldown` — all joined at request time.
      </div>
    </div>
  );
}

// ─── Presentational primitives (no state · no timers) ─────────────
function Panel({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: "#111827", border: `1px solid ${accent ?? "#374151"}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, letterSpacing: 0.5, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function Grid({ cols, children }: { cols: number; children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 12 }}>{children}</div>;
}

function Kv({ k, v, good, big }: { k: string; v: any; good?: boolean; big?: boolean }) {
  return (
    <div style={{ background: "#1f2937", padding: 12, borderRadius: 6, border: "1px solid #374151" }}>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{k}</div>
      <div style={{ fontSize: big ? 22 : 15, fontWeight: 700, color: good === false ? "#f87171" : good ? "#34d399" : "#f9fafb" }}>{String(v)}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 12, color: "#6b7280", fontSize: 13, fontStyle: "italic" }}>{children}</div>;
}

function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr>{headers.map((h, i) => (
            <th key={i} style={{ textAlign: "left", padding: "6px 8px", color: "#9ca3af", borderBottom: "1px solid #374151", fontWeight: 600 }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ padding: 12, color: "#6b7280", fontStyle: "italic" }}>No rows.</td></tr>
          ) : rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: "1px solid #1f2937" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "6px 8px", color: "#e5e7eb", fontFamily: "ui-monospace, monospace" }}>{String(cell ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
