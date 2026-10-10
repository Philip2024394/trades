// EMAIL HARVEST · Live Harvest
//
// Reads real state from nex.harvest_job / harvest_worker / harvest_yield
// plus AOF context (aof_cycle) — because AOF is what actually runs the
// current harvesting orbit. Every number is a live SQL result. No
// simulated animation. No fake workers. Empty states are honest.

"use client";

import { useEffect, useRef, useState } from "react";
import type { EmailHarvestPage } from "@/lib/nex-hq/email-harvest-manifest";

interface LiveFeed {
  ok: boolean;
  server_now?: string;
  query_duration_ms?: number;
  headline?: { state: string; note: string };
  queue?: any;
  workers?: any;
  yield_ledger?: any;
  aof_context?: any;
  standing_marketing_status_line?: string;
  cron_activation_state?: string;
  page_fetcher_activation_state?: string;
  warning?: string;
  detail?: string;
  error?: string;
}

const CADENCE_MS = 2000;

export default function EmailHarvestLive({ page }: { page: EmailHarvestPage }) {
  const [feed, setFeed] = useState<LiveFeed | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function doFetch() {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const r = await fetch("/api/nex/founder/email-harvest/live-harvest", { cache: "no-store" });
        const j: LiveFeed = await r.json();
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
    const iv = setInterval(() => { void doFetch(); }, CADENCE_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const fetchAgeMs = lastFetchAt ? Date.now() - lastFetchAt.getTime() : 0;

  const stateColor: Record<string, string> = {
    active: "#065f46", active_via_aof_only: "#065f46",
    idle: "#1e3a8a", stalled: "#7f1d1d", mixed: "#78350f",
    unavailable: "#7f1d1d",
  };

  return (
    <div style={{ padding: 24, background: "#0a0a0a", color: "#e5e7eb", minHeight: "100vh", fontFamily: "ui-monospace, monospace" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, marginBottom: 20, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{page.label.toUpperCase()} · EMAIL HARVEST</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "4px 0", color: "#f9fafb" }}>Live Harvest · Workers · Queue · Yield</h1>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>
            Real DB state · never fabricated. Every counter is a fresh query. Refresh: {CADENCE_MS}ms.
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#9ca3af" }}>
          <div>Fetches: <span style={{ color: "#f9fafb", fontWeight: 700 }}>{fetchCount}</span></div>
          <div>Fetch age: <span style={{ color: fetchAgeMs > 4000 ? "#f87171" : "#34d399" }}>{fetchAgeMs}ms</span></div>
          <div>Server clock: {feed?.server_now?.slice(11, 23) ?? "—"}</div>
          <div>Query took: {feed?.query_duration_ms ?? "—"}ms</div>
        </div>
      </div>

      {error && <Panel accent="#dc2626"><div style={{ color: "#fca5a5" }}>Fetch error: {error}</div></Panel>}
      {feed?.warning && <Panel accent="#eab308"><div style={{ color: "#fbbf24" }}>{feed.warning}: {feed.detail}</div></Panel>}

      {/* Headline state */}
      {feed?.headline && (
        <div style={{ background: stateColor[feed.headline.state] ?? "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>HEADLINE STATE</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", textTransform: "uppercase" }}>{feed.headline.state.replace(/_/g, " ")}</div>
          <div style={{ fontSize: 13, color: "#e5e7eb", marginTop: 6 }}>{feed.headline.note}</div>
        </div>
      )}

      {/* Activation gates */}
      <Panel title="🔐 Activation state (Founder-controlled)">
        <Grid cols={2}>
          <Kv k="NEX_PAGE_FETCHER_ACTIVATION" v={feed?.page_fetcher_activation_state ?? "—"} good={feed?.page_fetcher_activation_state === "on"} />
          <Kv k="NEX_DISCOVERY_CRON_ACTIVATION" v={feed?.cron_activation_state ?? "—"} good={feed?.cron_activation_state === "on"} />
        </Grid>
      </Panel>

      {/* Queue totals · nex.harvest_job */}
      <Panel title="📥 nex.harvest_job · queue state">
        <Grid cols={6}>
          <Kv k="Queued" v={feed?.queue?.totals?.queued ?? "—"} big />
          <Kv k="Claimed" v={feed?.queue?.totals?.claimed ?? "—"} big />
          <Kv k="Processing" v={feed?.queue?.totals?.processing ?? "—"} big />
          <Kv k="Completed" v={feed?.queue?.totals?.completed ?? "—"} big good />
          <Kv k="Failed" v={feed?.queue?.totals?.failed ?? "—"} big bad={feed?.queue?.totals?.failed > 0} />
          <Kv k="Dead-letter" v={feed?.queue?.totals?.dead_letter ?? "—"} big bad={feed?.queue?.totals?.dead_letter > 0} />
        </Grid>
        <SectionTitle>By status × job_type</SectionTitle>
        <Table
          headers={["Status", "Job type", "Count"]}
          rows={(feed?.queue?.by_status_and_type ?? []).map((r: any) => [r.status, r.job_type, r.c])}
        />
        <SectionTitle>Recent jobs (top 30, updated_at DESC)</SectionTitle>
        <Table
          headers={["Status", "Type", "Country", "Attempts", "Lease owner", "Updated", "Last error"]}
          rows={(feed?.queue?.recent_jobs ?? []).map((r: any) => [
            r.status, r.job_type, r.country_iso ?? "—", `${r.attempts}/${r.max_attempts}`,
            r.lease_owner ?? "—", r.updated_at?.slice(11, 19) ?? "—", (r.last_error ?? "").slice(0, 60),
          ])}
        />
        {(feed?.queue?.dead_letter_sample ?? []).length > 0 && (
          <>
            <SectionTitle>Dead-letter sample (top 10 · why they failed)</SectionTitle>
            <Table
              headers={["Type", "Country", "Source", "Last error", "Updated"]}
              rows={feed!.queue!.dead_letter_sample.map((r: any) => [
                r.job_type, r.country_iso ?? "—", r.source_id ?? "—", (r.last_error ?? "").slice(0, 80),
                r.updated_at?.slice(11, 19) ?? "—",
              ])}
            />
          </>
        )}
      </Panel>

      {/* Workers · nex.harvest_worker */}
      <Panel title="👷 nex.harvest_worker · registered workers (classic path)">
        <Grid cols={3}>
          <Kv k="Alive" v={feed?.workers?.count_by_status?.alive ?? "—"} big good={feed?.workers?.count_by_status?.alive > 0} />
          <Kv k="Expired" v={feed?.workers?.count_by_status?.expired ?? "—"} big />
          <Kv k="Drained" v={feed?.workers?.count_by_status?.drained ?? "—"} big />
        </Grid>
        <div style={{ marginTop: 12, padding: 10, background: "#7c2d12", borderRadius: 6, fontSize: 12, color: "#fed7aa" }}>
          <strong>Architectural note (real, not fake):</strong> {feed?.workers?.note_architectural_gap ?? ""}
        </div>
        <SectionTitle>Recent worker heartbeats (top 20)</SectionTitle>
        <Table
          headers={["worker_id", "Status", "HB age (s)", "Jobs claimed", "Jobs completed", "Jobs failed"]}
          rows={(feed?.workers?.detail ?? []).map((r: any) => [
            r.worker_id, r.status, r.heartbeat_age_seconds ?? "—",
            r.jobs_claimed, r.jobs_completed, r.jobs_failed,
          ])}
        />
      </Panel>

      {/* AOF context · the real current activity */}
      <Panel title="🤖 AOF orbit context (the actual current activity)">
        <Grid cols={4}>
          <Kv k="Active cycles" v={feed?.aof_context?.active_cycle_count ?? "—"} big good={feed?.aof_context?.active_cycle_count > 0} />
          <Kv k="Agents active" v={feed?.aof_context?.agents_active ?? "—"} big good={feed?.aof_context?.agents_active === 12} />
          <Kv k="Agents seen ≤2 min" v={feed?.aof_context?.agents_recently_seen ?? "—"} big />
          <Kv k="Freshest agent age (s)" v={feed?.aof_context?.freshest_agent_last_seen_age_s ?? "—"} />
        </Grid>
        <SectionTitle>Active cycles (aof_cycle · ended_at IS NULL)</SectionTitle>
        <Table
          headers={["seq", "Started", "Age (s)", "Countries touched", "Trigger", "Cand added", "Walks", "Emails"]}
          rows={(feed?.aof_context?.active_cycles ?? []).map((r: any) => [
            r.cycle_seq, r.started_at?.slice(11, 19), r.age_seconds,
            (r.countries_touched ?? []).join(", ") || "—",
            r.triggered_by, r.candidates_added, r.walks_completed, r.emails_captured,
          ])}
        />
      </Panel>

      {/* Yield ledger · nex.harvest_yield */}
      <Panel title="🌾 nex.harvest_yield · evidence of real work">
        <Grid cols={4}>
          <Kv k="Total lifetime" v={feed?.yield_ledger?.total ?? "—"} big />
          <Kv k="Last 5 min" v={feed?.yield_ledger?.windows?.last_5m ?? "—"} big good={feed?.yield_ledger?.windows?.last_5m > 0} />
          <Kv k="Last 60 min" v={feed?.yield_ledger?.windows?.last_60m ?? "—"} big />
          <Kv k="Last 24h" v={feed?.yield_ledger?.windows?.last_24h ?? "—"} big />
        </Grid>
        <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
          Most recent yield: {feed?.yield_ledger?.most_recent_at?.slice(0, 19).replace("T", " ") ?? "never"}
          {feed?.yield_ledger?.most_recent_age_seconds != null && <> · {feed.yield_ledger.most_recent_age_seconds}s ago</>}
        </div>
        <SectionTitle>By yield_kind (last 60 min)</SectionTitle>
        <Table
          headers={["Kind", "Events", "Total count"]}
          rows={(feed?.yield_ledger?.by_kind_last_60_min ?? []).map((r: any) => [r.yield_kind, r.events, r.total_count])}
        />
        <SectionTitle>Recent yield events (top 15)</SectionTitle>
        <Table
          headers={["At", "Kind", "Count", "Job", "Worker"]}
          rows={(feed?.yield_ledger?.recent_events ?? []).map((r: any) => [
            r.yielded_at?.slice(11, 19), r.yield_kind, r.yield_count,
            r.job_id?.slice(0, 8), r.worker_id ?? "—",
          ])}
        />
      </Panel>

      {/* Standing marketing line */}
      <div style={{ marginTop: 24, padding: 12, background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12, color: "#e5e7eb" }}>
        <strong style={{ color: "#9ca3af" }}>STANDING MARKETING LINE (verbatim · governance-controlled):</strong>
        <div style={{ marginTop: 4, fontWeight: 600 }}>
          {feed?.standing_marketing_status_line ?? "NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD."}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "#6b7280" }}>
        Data source authority: `nex.harvest_job` · `nex.harvest_worker` · `nex.harvest_yield` · `nex.aof_cycle` · `nex.aof_agent` — all joined at request time · no caching · no fabrication.
      </div>
    </div>
  );
}

function Panel({ title, accent, children }: { title?: string; accent?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#111827", border: `1px solid ${accent ?? "#374151"}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
      {title && <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, letterSpacing: 0.5, marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 0.5, marginTop: 12, marginBottom: 8, textTransform: "uppercase" }}>{children}</div>;
}
function Grid({ cols, children }: { cols: number; children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8 }}>{children}</div>;
}
function Kv({ k, v, good, bad, big }: { k: string; v: any; good?: boolean; bad?: boolean; big?: boolean }) {
  const color = bad ? "#f87171" : good ? "#34d399" : "#f9fafb";
  return (
    <div style={{ background: "#1f2937", padding: 10, borderRadius: 4, border: "1px solid #374151" }}>
      <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{k}</div>
      <div style={{ fontSize: big ? 18 : 13, fontWeight: 600, color, fontFamily: "ui-monospace, monospace" }}>{String(v ?? "—")}</div>
    </div>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 4 }}>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead><tr>{headers.map((h, i) => (
          <th key={i} style={{ textAlign: "left", padding: "6px 8px", color: "#9ca3af", borderBottom: "1px solid #374151", fontWeight: 600 }}>{h}</th>
        ))}</tr></thead>
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
