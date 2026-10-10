// EMAIL HARVEST · Source Quality
//
// Per-source scorecard rendered from real DB metrics.
// Every column value is a SQL result — no synthesis.

"use client";

import { useEffect, useState } from "react";
import type { EmailHarvestPage } from "@/lib/nex-hq/email-harvest-manifest";

interface ScorecardFeed {
  ok: boolean;
  server_now?: string;
  scorecards?: any[];
  warning?: string;
  detail?: string;
  error?: string;
}

export default function EmailHarvestSourceQuality({ page }: { page: EmailHarvestPage }) {
  const [feed, setFeed] = useState<ScorecardFeed | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function doFetch() {
      try {
        const r = await fetch("/api/nex/founder/email-harvest/source-quality", { cache: "no-store" });
        const j: ScorecardFeed = await r.json();
        if (cancelled) return;
        if (!j.ok && !j.warning) throw new Error(j.error ?? "fetch failed");
        setFeed(j);
        setLastFetchAt(new Date());
        setError(null);
      } catch (e: any) { if (!cancelled) setError(e?.message ?? String(e)); }
    }
    void doFetch();
    const iv = setInterval(() => { void doFetch(); }, 5000);        // 5s cadence · slower than live feed
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const scorecards = feed?.scorecards ?? [];

  return (
    <div style={{ padding: 24, background: "#0a0a0a", color: "#e5e7eb", minHeight: "100vh", fontFamily: "ui-monospace, monospace" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>{page.label.toUpperCase()} · SOURCE QUALITY SCORECARD</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "4px 0", color: "#f9fafb" }}>Per-source metrics · real DB-derived</h1>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          Every ratio computed at request time from `nex.aof_agent_event` decision-op=discover + `nex.harvest_business_candidate` + `nex.discovery_business_evidence` + `nex.aof_source_cooldown`.
          {feed?.server_now && <> · Server clock: {feed.server_now.slice(11, 23)}</>}
          {lastFetchAt && <> · Last fetched: {lastFetchAt.toISOString().slice(11, 23)}</>}
        </div>
      </div>

      {error && <Panel accent="#dc2626"><div style={{ color: "#fca5a5" }}>Fetch error: {error}</div></Panel>}
      {feed?.warning && <Panel accent="#eab308"><div style={{ color: "#fbbf24" }}>{feed.warning}: {feed.detail}</div></Panel>}

      {scorecards.length === 0 ? (
        <Panel><div style={{ color: "#6b7280", fontStyle: "italic" }}>No Founder-signed sources found.</div></Panel>
      ) : scorecards.map(s => (
        <div key={s.source_slug} style={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb" }}>{s.source_slug}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{s.source_type} · {s.host} · priority {s.priority} · {s.enabled ? "enabled" : "disabled"}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Founder-signed {s.founder_signed_at?.slice(0, 19).replace("T", " ")}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              {s.currently_cooled && (
                <div style={{ background: "#7f1d1d", padding: "6px 12px", borderRadius: 4, fontSize: 12, color: "#fecaca" }}>
                  ⏸ COOLED · {s.cooldown_seconds_until_expiry}s · {s.cooldown_last_failure_kind} · consec={s.cooldown_consecutive_failures}
                </div>
              )}
            </div>
          </div>

          {/* Discover attempts */}
          <SectionTitle>Discovery attempts (event log)</SectionTitle>
          <Grid cols={6}>
            <Kv k="Total" v={s.discover_attempts_total} />
            <Kv k="OK" v={s.discover_ok} good />
            <Kv k="Zero" v={s.discover_zero_results} />
            <Kv k="Rate-limited" v={s.discover_rate_limited} bad={s.discover_rate_limited > 0} />
            <Kv k="Unavailable" v={s.discover_unavailable} bad={s.discover_unavailable > 0} />
            <Kv k="Parse error" v={s.discover_parse_error} bad={s.discover_parse_error > 0} />
          </Grid>

          {/* Rates */}
          <SectionTitle>Rates</SectionTitle>
          <Grid cols={4}>
            <Kv k="OK rate" v={pct(s.ok_rate)} />
            <Kv k="Zero-result rate" v={pct(s.zero_result_rate)} />
            <Kv k="Rate-limit rate" v={pct(s.rate_limit_rate)} bad={s.rate_limit_rate && s.rate_limit_rate > 0.1} />
            <Kv k="Unavailable rate" v={pct(s.unavailable_rate)} bad={s.unavailable_rate && s.unavailable_rate > 0.1} />
          </Grid>

          {/* Yield */}
          <SectionTitle>Yield (from real candidates + evidence)</SectionTitle>
          <Grid cols={4}>
            <Kv k="Candidates produced" v={s.candidates_produced} big />
            <Kv k="With website" v={s.candidates_with_website} big />
            <Kv k="Walked ok" v={s.candidates_walked_ok} big />
            <Kv k="Real emails" v={s.evidence_with_email} big good={s.evidence_with_email > 0} />
          </Grid>
          <Grid cols={4}>
            <Kv k="Inserted / attempt" v={rounded(s.inserted_per_attempt, 2)} />
            <Kv k="Walk success rate" v={pct(s.walk_success_rate)} />
            <Kv k="Email yield rate" v={pct(s.email_yield_rate)} />
            <Kv k="Provenance completeness" v={pct(s.provenance_completeness)} />
          </Grid>

          {/* Coverage */}
          <SectionTitle>Coverage</SectionTitle>
          <Grid cols={4}>
            <Kv k="Distinct countries" v={s.distinct_countries} />
            <Kv k="Countries with email" v={s.distinct_email_countries} />
            <Kv k="Blocked by governance" v={s.candidates_blocked_by_governance} bad={s.candidates_blocked_by_governance > 0} />
            <Kv k="Unavailable sites" v={s.candidates_unavailable} bad={s.candidates_unavailable > 0} />
          </Grid>

          {/* Freshness */}
          <SectionTitle>Freshness</SectionTitle>
          <Grid cols={3}>
            <Kv k="First candidate" v={s.first_candidate_at?.slice(0, 19).replace("T", " ") ?? "—"} />
            <Kv k="Most recent" v={s.most_recent_candidate_at?.slice(0, 19).replace("T", " ") ?? "—"} />
            <Kv k="Reliability score" v={s.reliability_score ?? "—"} />
          </Grid>
        </div>
      ))}

      <div style={{ marginTop: 24, fontSize: 11, color: "#6b7280" }}>
        Data source authority: `nex.harvest_source` (Founder-signed registry) · `nex.aof_agent_event` (event_kind='decision' payload.op='discover') · `nex.harvest_business_candidate` · `nex.discovery_business_evidence` · `nex.aof_source_cooldown` — joined at request time · no cached counters.
      </div>
    </div>
  );
}

function pct(x: number | null | undefined): string {
  if (x == null || !isFinite(x)) return "—";
  return (x * 100).toFixed(1) + "%";
}
function rounded(x: number | null | undefined, d: number): string {
  if (x == null || !isFinite(x)) return "—";
  return x.toFixed(d);
}

function Panel({ accent, children }: { accent?: string; children: React.ReactNode }) {
  return <div style={{ background: "#111827", border: `1px solid ${accent ?? "#374151"}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>{children}</div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 0.5, marginTop: 12, marginBottom: 8, textTransform: "uppercase" }}>{children}</div>;
}
function Grid({ cols, children }: { cols: number; children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8, marginBottom: 8 }}>{children}</div>;
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
