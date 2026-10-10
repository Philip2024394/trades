"use client";

// NEX World Discovery · Founder Command Centre client
// Founder-authorised programme · bounded wave · 2026-09-21.
//
// Activity dot MUST reflect real DB state · never fake pulse.
// Country cards colour-map from the durable status field.

import { useCallback, useEffect, useMemo, useState } from "react";

type Region = "Americas" | "Europe" | "Africa" | "Middle East" | "Asia" | "Oceania" | "Antarctica";
type CountryStatus =
  | "idle" | "queued" | "crawling" | "processing" | "new_data"
  | "partial" | "zero_results" | "source_unavailable" | "blocked" | "completed";

type CountryRow = {
  iso_alpha_2: string; iso_alpha_3: string; numeric_code: string; name: string;
  region: Region; subregion: string; un_member: boolean; sovereign: boolean; active_in_nex: boolean;
  state: null | {
    status: CountryStatus;
    current_cycle_id: string | null; last_cycle_id: string | null;
    claimed_at: string | null; claimed_by: string | null;
    activity_expires_at: string | null;
    last_completed_at: string | null; next_scheduled_at: string | null;
    businesses_discovered_today: number; new_emails_today: number;
    existing_matched_today: number; rejected_today: number;
    websites_resolved_today: number; sources_responded_today: number;
    sources_unavailable_today: number; metrics_day: string; updated_at: string;
  };
};

type Overview = {
  countries_total: number; countries_un_member: number; countries_active_in_nex: number;
  programmes_active: number; programmes_total: number;
  per_status: Record<CountryStatus, number>;
  per_region: { region: Region; total_countries: number; active_countries: number; businesses_today: number }[];
  totals_today: {
    businesses_discovered: number; new_emails: number; existing_matched: number;
    rejected: number; websites_resolved: number;
    sources_responded: number; sources_unavailable: number;
  };
  computed_at: string;
};

type BusinessEvidence = {
  evidence_id: string; business_name: string; website_url: string | null;
  contact_page_url: string | null; services: string[]; category: string | null;
  discovered_via_term: string; discovered_via_source: string; discovered_via_evidence_url: string | null;
  discovered_email: string | null; email_source_url: string | null;
  email_extraction_confidence: number | null; first_seen_at: string; last_seen_at: string;
  metadata?: {
    email_type?: string;
    email_evidence_tier?: string;
    email_provider_domain?: string;
    extraction_method?: string;
    role_hint?: string | null;
  };
};

type EntityRow = {
  entity_id: string;
  business_name: string;
  canonical_website: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  state: "unresolved" | "candidate_entity" | "resolved_entity" | "ambiguous_entity" | "rejected_entity";
  state_reason: string | null;
  category: string | null;
  services: string[];
  discovery_terms: string[];
  evidence_count: number;
  confidence: number;
  first_seen_at: string;
  last_seen_at: string;
};

type Relationship = {
  parent_term: string;
  child_term: string;
  relationship_kind: string;
  evidence_count: number;
  confidence: number;
  status: string;
};

type RecentCycle = {
  cycle_id: string;
  cycle_seq: number | string;
  topic: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  outcome: string;
  businesses_discovered: number;
  new_emails: number;
  existing_matched: number;
  rejected_emails: number;
};

type OrchestrationTick = {
  tick_id: string;
  tick_seq: number | string;
  tick_at: string;
  finished_at: string | null;
  duration_ms: number;
  worker_id: string;
  cycles_planned: number;
  cycles_skipped: number;
  countries_touched: string[];
  reaped_stalled_cycles: number;
  reaped_expired_claims: number;
  outcome: "in_progress" | "complete" | "partial" | "no_work" | "superseded";
  note: string | null;
};

type OrchestrationStatus = {
  programme_slug: string | null;
  last_tick: OrchestrationTick | null;
  next_expected_at: string | null;
  cadence_seconds: number;
};

type CountryDetail = {
  country: CountryRow;
  programme: { programme_id: string; slug: string; display_name: string };
  state: CountryRow["state"];
  businesses: { total: number; rows: BusinessEvidence[] };
  entities: EntityRow[];
  relationships: Relationship[];
  recent_cycles: RecentCycle[];
};

const REGION_ORDER: Region[] = ["Americas", "Europe", "Africa", "Middle East", "Asia", "Oceania", "Antarctica"];

// ─── Status → color map (Founder colour vocabulary) ──────────
const STATUS_STYLE: Record<CountryStatus, { bg: string; fg: string; dot: string; label: string; pulse: boolean }> = {
  idle:               { bg: "#f3f4f6", fg: "#666", dot: "#c8c8c8", label: "IDLE",               pulse: false },
  queued:             { bg: "#dbeafe", fg: "#1e3a8a", dot: "#3b82f6", label: "QUEUED",           pulse: false },
  crawling:           { bg: "#dcfce7", fg: "#166534", dot: "#16a34a", label: "CRAWLING",         pulse: true  },
  processing:         { bg: "#fef9c3", fg: "#713f12", dot: "#eab308", label: "PROCESSING",       pulse: true  },
  new_data:           { bg: "#f3e8ff", fg: "#581c87", dot: "#a855f7", label: "NEW DATA",         pulse: false },
  partial:            { bg: "#ffedd5", fg: "#7c2d12", dot: "#f97316", label: "PARTIAL",          pulse: false },
  zero_results:       { bg: "#f5f5f4", fg: "#57534e", dot: "#78716c", label: "ZERO RESULTS",     pulse: false },
  source_unavailable: { bg: "#fee2e2", fg: "#991b1b", dot: "#dc2626", label: "SOURCE UNAVAILABLE", pulse: false },
  blocked:            { bg: "#e5e7eb", fg: "#111", dot: "#111",    label: "BLOCKED",          pulse: false },
  completed:          { bg: "#e6f7ec", fg: "#166534", dot: "#166534", label: "COMPLETED",        pulse: false },
};

interface ScaffoldingStatus {
  programme: { slug: string; display_name: string; asia_last_policy_active: boolean; topic: string } | null;
  queue: { total_in_scope: number; completed: number; in_progress: number; queued: number; idle: number; zero_results: number; source_unavailable: number; blocked: number; percent_completed: number | null };
  asia_last: { non_asia_total: number; non_asia_completed: number; non_asia_remaining: number; asia_total: number; asia_completed: number; asia_remaining: number; in_asia_tail: boolean };
  cumulative_business_evidence: { total_rows: number; rows_with_email: number; rows_without_email: number; distinct_websites: number; distinct_countries_touched: number; rows_last_24h: number; rows_last_7d: number; provenance_coverage_percent: number | null };
  cumulative_emails: { total_captured: number; with_source_url: number; with_source_url_percent: number | null; by_country: Array<{ country: string; total: number }> };
  entities: { total: number; unresolved: number; candidate: number; resolved: number; ambiguous: number; rejected: number };
  current_country: { iso: string; name: string; region: string; status: string; claim_at: string | null; claim_expires_at: string | null; businesses_discovered_today: number; new_emails_today: number; evidence_rows_lifetime: number; emails_captured_lifetime: number; last_cycle_at: string | null } | null;
  cycles: { total: number; last_24h: number; outcome_zero_results: number; outcome_source_unavailable: number; most_recent_at: string | null };
  generated_at: string;
}

export function WorldDiscoveryClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [programme, setProgramme] = useState<{ programme_id: string; slug: string; display_name: string; policy_json: Record<string, unknown> } | null>(null);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [detail, setDetail] = useState<CountryDetail | null>(null);
  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");
  const [statusFilter, setStatusFilter] = useState<CountryStatus | "all">("all");
  const [tickBusy, setTickBusy] = useState<string | null>(null);
  const [orchestration, setOrchestration] = useState<OrchestrationStatus | null>(null);
  const [recentTicks, setRecentTicks] = useState<OrchestrationTick[]>([]);
  const [orchestrationBusy, setOrchestrationBusy] = useState(false);
  const [scaffolding, setScaffolding] = useState<ScaffoldingStatus | null>(null);
  const [liveState, setLiveState] = useState<"live" | "stale" | "unavailable">("stale");
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const loadOrchestration = useCallback(async () => {
    const r = await fetch("/api/nex/founder/world/orchestration?programme=scaffolding", { credentials: "include" }).catch(() => null);
    if (r?.ok) { const j = await r.json(); if (j.ok) { setOrchestration(j.status ?? null); setRecentTicks(j.recent ?? []); } }
  }, []);

  const runOrchestrationTick = async () => {
    setOrchestrationBusy(true);
    await fetch("/api/nex/founder/world/orchestration?programme=scaffolding&max_countries=3", { method: "POST", credentials: "include" }).catch(() => null);
    setOrchestrationBusy(false);
    void loadOrchestration(); void loadOverview(); void loadCountries();
  };

  const loadOverview = useCallback(async () => {
    const r = await fetch("/api/nex/founder/world/overview", { credentials: "include" }).catch(() => null);
    if (r?.ok) { const j = await r.json(); if (j.ok) setOverview(j.overview); }
  }, []);
  const loadCountries = useCallback(async () => {
    const r = await fetch("/api/nex/founder/world/countries?programme=scaffolding", { credentials: "include" }).catch(() => null);
    if (r?.ok) { const j = await r.json(); if (j.ok) { setCountries(j.countries); setProgramme(j.programme); } }
  }, []);
  const loadDetail = useCallback(async (iso: string) => {
    const r = await fetch(`/api/nex/founder/world/countries/${iso}?programme=scaffolding&limit=50`, { credentials: "include" }).catch(() => null);
    if (r?.ok) { const j = await r.json(); if (j.ok) setDetail(j); }
  }, []);
  const loadScaffolding = useCallback(async () => {
    const r = await fetch("/api/nex/founder/world/scaffolding-programme-status?programme=scaffolding", { credentials: "include" }).catch(() => null);
    if (r?.ok) {
      const j = await r.json();
      if (j.ok && j.status) { setScaffolding(j.status); setLiveState("live"); setLastRefreshAt(new Date().toISOString()); return; }
      if (j.ok && j.warning === "schema_not_applied") { setLiveState("unavailable"); return; }
    }
    setLiveState("unavailable");
  }, []);
  useEffect(() => { void loadOverview(); void loadCountries(); void loadOrchestration(); void loadScaffolding(); }, [loadOverview, loadCountries, loadOrchestration, loadScaffolding]);
  useEffect(() => {
    const id = setInterval(() => {
      setLiveState(prev => prev === "live" ? "stale" : prev);
      void loadOverview(); void loadCountries(); void loadOrchestration(); void loadScaffolding();
    }, 20_000);
    return () => clearInterval(id);
  }, [loadOverview, loadCountries, loadOrchestration, loadScaffolding]);
  useEffect(() => { if (selectedIso) void loadDetail(selectedIso); else setDetail(null); }, [selectedIso, loadDetail]);

  const triggerCycle = async (iso: string) => {
    setTickBusy(iso);
    await fetch(`/api/cron/nex-discovery-tick?topic=scaffolding&countries=${iso}`, { credentials: "include" }).catch(() => null);
    setTickBusy(null);
    void loadOverview(); void loadCountries();
    if (selectedIso) void loadDetail(selectedIso);
  };

  const grouped = useMemo(() => {
    const byRegion = new Map<Region, CountryRow[]>();
    for (const c of countries) {
      if (regionFilter !== "all" && c.region !== regionFilter) continue;
      if (statusFilter !== "all" && (c.state?.status ?? "idle") !== statusFilter) continue;
      const g = byRegion.get(c.region) ?? [];
      g.push(c);
      byRegion.set(c.region, g);
    }
    return REGION_ORDER.map(r => ({ region: r, countries: (byRegion.get(r) ?? []).sort((a, b) => a.name.localeCompare(b.name)) })).filter(g => g.countries.length > 0);
  }, [countries, regionFilter, statusFilter]);

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1280, margin: "0 auto" }}>
      {/* ─── Overview strip ─── */}
      {overview && (
        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            <Metric main={overview.countries_total.toLocaleString()} label="countries" strong />
            <Metric main={overview.countries_un_member.toLocaleString()} label="UN members" />
            <Metric main={String(overview.programmes_active)} label="active programmes" />
            <Metric main={String((overview.per_status.crawling ?? 0) + (overview.per_status.processing ?? 0))} label="actively working" />
            <Metric main={overview.totals_today.businesses_discovered.toLocaleString()} label="businesses today" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginTop: 10 }}>
            {(["idle","queued","crawling","processing","completed","zero_results","source_unavailable"] as CountryStatus[]).map(s => (
              <StatusChip key={s} status={s} n={overview.per_status[s] ?? 0} onClick={() => setStatusFilter(s === statusFilter ? "all" : s)} active={statusFilter === s} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
            Programme: <strong>{programme?.display_name ?? "—"}</strong>{" "}
            {programme?.policy_json && (programme.policy_json as any).asia_last ? "· Asia-last policy active" : ""}
          </div>
        </section>
      )}

      {/* ─── Scaffolding Programme · Live Persisted State ─── */}
      <section style={{ background: "linear-gradient(180deg, #f0fdf4, #ffffff)", border: "1px solid rgba(22,101,52,0.20)", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#166534", fontWeight: 700 }}>
            Scaffolding Programme · Live Persisted State
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999,
              background: liveState === "live" ? "rgba(22,163,74,0.12)" : liveState === "stale" ? "rgba(148,163,184,0.15)" : "rgba(220,38,38,0.10)",
              color: liveState === "live" ? "#166534" : liveState === "stale" ? "#57534e" : "#991b1b",
              border: `1px solid ${liveState === "live" ? "rgba(22,163,74,0.4)" : liveState === "stale" ? "rgba(148,163,184,0.35)" : "rgba(220,38,38,0.35)"}`,
              fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: liveState === "live" ? "#16a34a" : liveState === "stale" ? "#78716c" : "#dc2626" }} />
              {liveState === "live" ? "LIVE" : liveState === "stale" ? "STALE" : "UNAVAILABLE"}
            </span>
            {lastRefreshAt && liveState !== "unavailable" && (
              <span style={{ color: "#666" }}>last updated {new Date(lastRefreshAt).toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        {!scaffolding && liveState === "unavailable" && (
          <div style={{ padding: 10, background: "#fef2f2", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, fontSize: 12, color: "#991b1b" }}>
            Founder endpoints unavailable in this environment · panel visible when authenticated as Founder against a live NEX database.
          </div>
        )}

        {scaffolding && (
          <>
            {/* Queue progression */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
              <StatMini value={String(scaffolding.queue.total_in_scope)} label="in scope" />
              <StatMini value={String(scaffolding.queue.completed)} label="completed" color="#166534" />
              <StatMini value={String(scaffolding.queue.in_progress)} label="in progress" color="#eab308" />
              <StatMini value={String(scaffolding.queue.queued + scaffolding.queue.idle)} label="queued / idle" />
              <StatMini value={scaffolding.queue.percent_completed !== null ? `${scaffolding.queue.percent_completed.toFixed(1)}%` : "—"} label="progress" color="#0e7490" />
            </div>

            {/* Asia-last strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12, padding: 10, background: scaffolding.asia_last.in_asia_tail ? "rgba(249,115,22,0.06)" : "rgba(22,101,52,0.05)", borderRadius: 6 }}>
              <StatMini value={String(scaffolding.asia_last.non_asia_remaining)} label="non-Asia remaining" color={scaffolding.asia_last.non_asia_remaining > 0 ? "#166534" : "#57534e"} />
              <StatMini value={String(scaffolding.asia_last.asia_remaining)} label="Asia remaining" color="#57534e" />
              <StatMini value={scaffolding.asia_last.in_asia_tail ? "YES" : "NO"} label="in Asia tail?" color={scaffolding.asia_last.in_asia_tail ? "#c2410c" : "#166534"} />
              <StatMini value={String(scaffolding.asia_last.non_asia_completed)} label="non-Asia completed" />
              <StatMini value={String(scaffolding.asia_last.asia_completed)} label="Asia completed" />
            </div>

            {/* Persisted evidence + emails */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
              <StatMini value={scaffolding.cumulative_business_evidence.total_rows.toLocaleString()} label="business evidence rows" strong />
              <StatMini value={scaffolding.cumulative_business_evidence.rows_with_email.toLocaleString()} label="with public email" color="#166534" />
              <StatMini value={scaffolding.cumulative_business_evidence.distinct_websites.toLocaleString()} label="distinct websites" />
              <StatMini value={String(scaffolding.cumulative_business_evidence.distinct_countries_touched)} label="countries touched" />
              <StatMini value={String(scaffolding.cumulative_business_evidence.rows_last_24h)} label="new · last 24h" color="#0e7490" />
              <StatMini value={String(scaffolding.cumulative_business_evidence.rows_last_7d)} label="new · last 7d" />
              <StatMini value={scaffolding.cumulative_business_evidence.provenance_coverage_percent !== null ? `${scaffolding.cumulative_business_evidence.provenance_coverage_percent.toFixed(1)}%` : "—"} label="email provenance coverage" />
            </div>

            {/* Entity resolution state */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12, padding: 10, background: "rgba(0,0,0,0.02)", borderRadius: 6 }}>
              <StatMini value={String(scaffolding.entities.total)} label="entities total" />
              <StatMini value={String(scaffolding.entities.unresolved)} label="unresolved" color="#57534e" />
              <StatMini value={String(scaffolding.entities.candidate)} label="candidate" color="#eab308" />
              <StatMini value={String(scaffolding.entities.resolved)} label="resolved" color="#166534" />
              <StatMini value={String(scaffolding.entities.ambiguous)} label="ambiguous" color="#c2410c" />
              <StatMini value={String(scaffolding.entities.rejected)} label="rejected" color="#991b1b" />
            </div>

            {/* Current country · only shown when a country is actively working */}
            {scaffolding.current_country ? (
              <div style={{ padding: 12, background: "#dcfce7", border: "1px solid rgba(22,163,74,0.35)", borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "#166534", fontWeight: 700, marginBottom: 6 }}>
                  Current country · live
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", fontSize: 12 }}>
                  <strong style={{ fontSize: 16, color: "#166534" }}>{scaffolding.current_country.name} ({scaffolding.current_country.iso})</strong>
                  <span style={{ color: "#166534" }}>{scaffolding.current_country.region}</span>
                  <span style={{ padding: "1px 8px", borderRadius: 999, background: "#166534", color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                    {scaffolding.current_country.status}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginTop: 10 }}>
                  <StatMini value={String(scaffolding.current_country.businesses_discovered_today)} label="businesses · today" />
                  <StatMini value={String(scaffolding.current_country.new_emails_today)} label="new emails · today" color="#166534" />
                  <StatMini value={String(scaffolding.current_country.evidence_rows_lifetime)} label="evidence · lifetime" />
                  <StatMini value={String(scaffolding.current_country.emails_captured_lifetime)} label="emails · lifetime" />
                  <StatMini value={scaffolding.current_country.last_cycle_at ? new Date(scaffolding.current_country.last_cycle_at).toLocaleString() : "—"} label="last cycle" />
                </div>
              </div>
            ) : (
              <div style={{ padding: 10, background: "rgba(0,0,0,0.03)", borderRadius: 6, fontSize: 12, color: "#57534e" }}>
                No country is currently in <code>crawling</code>/<code>processing</code> state.
                {scaffolding.queue.completed > 0 && ` · ${scaffolding.queue.completed} completed so far`}
                {scaffolding.queue.zero_results > 0 && ` · ${scaffolding.queue.zero_results} zero_results`}
                {scaffolding.queue.source_unavailable > 0 && ` · ${scaffolding.queue.source_unavailable} source_unavailable`}
                .
              </div>
            )}

            {/* Cycles rollup */}
            <div style={{ fontSize: 11, color: "#666", marginTop: 8, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span>Cycles: <strong>{scaffolding.cycles.total}</strong> total · <strong>{scaffolding.cycles.last_24h}</strong> last 24h · {scaffolding.cycles.outcome_zero_results} zero_results · {scaffolding.cycles.outcome_source_unavailable} source_unavailable</span>
              {scaffolding.cycles.most_recent_at && <span>Most recent cycle: {new Date(scaffolding.cycles.most_recent_at).toLocaleString()}</span>}
            </div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 4, fontStyle: "italic" }}>
              All values above are counts read from persisted state · no email addresses shown on this screen ·
              actual contact data stays behind existing Founder controls.
            </div>
          </>
        )}
      </section>

      {/* ─── Orchestration strip (Part 13b · real DB state · no fake activity) ─── */}
      <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 6 }}>Orchestration</div>
            {orchestration?.last_tick ? (
              <div style={{ fontSize: 12, color: "#333" }}>
                Last tick <strong>#{orchestration.last_tick.tick_seq}</strong> · <strong>{orchestration.last_tick.outcome}</strong>
                {" · "} planned {orchestration.last_tick.cycles_planned} · skipped {orchestration.last_tick.cycles_skipped}
                {" · reaper "} claims {orchestration.last_tick.reaped_expired_claims} · stalled {orchestration.last_tick.reaped_stalled_cycles}
                <br />
                <span style={{ color: "#666" }}>
                  {orchestration.last_tick.tick_at ? new Date(orchestration.last_tick.tick_at).toLocaleTimeString() : "—"}
                  {" → next expected "} {orchestration.next_expected_at ? new Date(orchestration.next_expected_at).toLocaleTimeString() : "—"}
                  {" · cadence "} {orchestration.cadence_seconds}s
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#666" }}>No orchestration ticks yet.</div>
            )}
          </div>
          <button onClick={runOrchestrationTick} disabled={orchestrationBusy}
            style={{ padding: "10px 14px", background: "#166534", color: "#fff", border: 0, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>
            {orchestrationBusy ? "Running tick…" : "Run orchestration tick"}
          </button>
        </div>
        {recentTicks.length > 1 && (
          <div style={{ display: "flex", gap: 4, marginTop: 10, overflowX: "auto" }}>
            {recentTicks.slice(0, 12).map(t => (
              <div key={t.tick_id} title={`#${t.tick_seq} · ${t.outcome} · ${t.worker_id}`}
                style={{ minWidth: 56, padding: "6px 8px", borderRadius: 4, background: outcomeBg(t.outcome), color: outcomeFg(t.outcome), fontSize: 10, textAlign: "center" }}>
                <div style={{ fontWeight: 700 }}>#{t.tick_seq}</div>
                <div style={{ textTransform: "uppercase", letterSpacing: 0.3 }}>{t.outcome}</div>
                <div style={{ color: "inherit", opacity: 0.85 }}>{t.cycles_planned}p · {t.cycles_skipped}s</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
          Two-clock discipline · orchestration cadence never overrides per-country politeness. Activity backed by real DB state.
        </div>
      </section>

      {/* ─── Region filter row ─── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <FilterPill label="All regions" active={regionFilter === "all"} onClick={() => setRegionFilter("all")} />
        {REGION_ORDER.map(r => (
          <FilterPill key={r} label={r} active={regionFilter === r} onClick={() => setRegionFilter(r)} />
        ))}
      </div>

      {/* ─── Country matrix grouped by region ─── */}
      {grouped.map(g => (
        <section key={g.region} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>{g.region}</h3>
            <div style={{ fontSize: 11, color: "#666" }}>{g.countries.length} {g.countries.length === 1 ? "country" : "countries"}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {g.countries.map(c => {
              const status: CountryStatus = c.state?.status ?? "idle";
              const style = STATUS_STYLE[status];
              const active = selectedIso === c.iso_alpha_2;
              return (
                <button key={c.iso_alpha_2} onClick={() => setSelectedIso(active ? null : c.iso_alpha_2)}
                  style={{
                    textAlign: "left", background: style.bg, color: style.fg,
                    border: `1px solid ${active ? "#111" : "rgba(0,0,0,0.10)"}`,
                    borderRadius: 8, padding: 10, cursor: "pointer", minHeight: 68,
                    display: "grid", gap: 4,
                  }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 6, alignItems: "center" }}>
                    <span style={{ ...dotStyle, background: style.dot, animation: style.pulse ? "nex-pulse 1.5s ease-in-out infinite" : "none" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                    <span style={{ fontSize: 10, color: "#666", fontVariantNumeric: "tabular-nums" }}>{c.iso_alpha_2}</span>
                  </div>
                  <div style={{ fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" }}>{style.label}</div>
                  {c.state && c.state.businesses_discovered_today > 0 && (
                    <div style={{ fontSize: 10, color: "#333" }}>
                      {c.state.businesses_discovered_today} businesses · {c.state.new_emails_today} new emails today
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {grouped.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "#666" }}>
          No countries match the current filters.
        </div>
      )}

      {/* ─── Country drill-in panel ─── */}
      {selectedIso && detail && (
        <section style={{ background: "#fff", border: "2px solid #166534", borderRadius: 10, padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "start", marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>{detail.country.name}</h2>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                {detail.country.region} · {detail.country.subregion} · {detail.country.iso_alpha_2}/{detail.country.iso_alpha_3} · {detail.country.un_member ? "UN member" : "non-member"}
              </div>
            </div>
            <button onClick={() => triggerCycle(detail.country.iso_alpha_2)} disabled={tickBusy === detail.country.iso_alpha_2}
              style={{ padding: "10px 14px", background: "#166534", color: "#fff", border: 0, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>
              {tickBusy === detail.country.iso_alpha_2 ? "Running…" : "Run cycle for this country"}
            </button>
            <button onClick={() => setSelectedIso(null)} style={{ padding: "10px 14px", background: "#fff", color: "#333", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 6, fontSize: 13, cursor: "pointer", minHeight: 44 }}>
              Close
            </button>
          </div>
          {detail.state && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 14 }}>
              <Metric main={STATUS_STYLE[detail.state.status].label} label="status" strong small />
              <Metric main={String(detail.state.businesses_discovered_today)} label="businesses today" small />
              <Metric main={String(detail.state.new_emails_today)} label="new emails" small />
              <Metric main={String(detail.state.existing_matched_today)} label="existing" small />
              <Metric main={String(detail.state.rejected_today)} label="rejected" small />
              <Metric main={String(detail.state.sources_responded_today)} label="sources OK" small />
              <Metric main={String(detail.state.sources_unavailable_today)} label="sources down" small />
            </div>
          )}
          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Last completed: {detail.state?.last_completed_at ? new Date(detail.state.last_completed_at).toLocaleString() : "—"} ·
            Next scheduled: {detail.state?.next_scheduled_at ? new Date(detail.state.next_scheduled_at).toLocaleString() : "—"}
          </div>

          {/* Business evidence · Founder-only visibility · counts + provenance only · addresses behind existing Founder controls */}
          <h4 style={{ margin: "10px 0 6px", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Business / Service Inventory
          </h4>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
            Founder-only surface · <strong>{detail.businesses.total} businesses recorded</strong> (showing first {detail.businesses.rows.length}).
            Individual email addresses are not rendered on this screen · check "captured" indicator + provenance source · full contact data available through existing Founder audience-inventory controls.
          </div>
          {detail.businesses.rows.length === 0 && (
            <div style={{ padding: 12, background: "#f8faf7", borderRadius: 6, fontSize: 12, color: "#666" }}>
              No business evidence recorded for this country in the scaffolding programme yet. Recording begins once a cycle resolves real businesses.
            </div>
          )}
          {detail.businesses.rows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                    <th style={thStyle}>Business</th>
                    <th style={thStyle}>Service</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Email captured</th>
                    <th style={thStyle}>Provenance</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Discovered via</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.businesses.rows.map(b => (
                    <tr key={b.evidence_id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                      <td style={tdStyle}><strong>{b.business_name}</strong>{b.website_url && <div style={{ fontSize: 10, color: "#666" }}>{b.website_url}</div>}</td>
                      <td style={tdStyle}>{b.services.slice(0, 2).join(", ") || "—"}</td>
                      <td style={tdStyle}>{b.category ?? "—"}</td>
                      <td style={tdStyle}>
                        {b.discovered_email
                          ? <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>captured</span>
                          : <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 999, background: "#f5f5f4", color: "#78716c", fontSize: 10, textTransform: "uppercase" }}>not yet</span>}
                      </td>
                      <td style={tdStyle}>
                        {b.email_source_url
                          ? <span style={{ color: "#166534", fontSize: 10 }} title={b.email_source_url}>URL recorded</span>
                          : b.discovered_email
                            ? <span style={{ color: "#c2410c", fontSize: 10 }}>no source URL</span>
                            : <span style={{ color: "#999", fontSize: 10 }}>—</span>}
                      </td>
                      <td style={tdStyle}>{b.discovered_via_source}</td>
                      <td style={tdStyle}>{b.discovered_via_term}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Entities (Part 13c · Founder-only) */}
          <h4 style={{ margin: "18px 0 6px", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Entities discovered
          </h4>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
            Deterministic resolution · never fabricated. 5-state lifecycle.
            <strong> {detail.entities.length} entities</strong> for this country.
          </div>
          {detail.entities.length === 0 && (
            <div style={{ padding: 10, background: "#f8faf7", borderRadius: 6, fontSize: 12, color: "#666" }}>
              No entities resolved yet for this country. Resolution begins when a real cycle attaches to a permitted PageFetcher.
            </div>
          )}
          {detail.entities.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                    <th style={thStyle}>Business</th>
                    <th style={thStyle}>State</th>
                    <th style={thStyle}>Website</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Evidence</th>
                    <th style={thStyle}>Confidence</th>
                    <th style={thStyle}>Discovered via</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.entities.map(e => (
                    <tr key={e.entity_id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                      <td style={tdStyle}><strong>{e.business_name}</strong>{e.city && <div style={{ fontSize: 10, color: "#666" }}>{e.city}</div>}</td>
                      <td style={tdStyle}><EntityStateBadge state={e.state} /></td>
                      <td style={tdStyle}>{e.canonical_website ?? "—"}</td>
                      <td style={tdStyle}>{e.category ?? "—"}</td>
                      <td style={tdStyle}>{e.evidence_count}</td>
                      <td style={tdStyle}>{e.confidence.toFixed(2)}</td>
                      <td style={tdStyle}>{e.discovery_terms.slice(0, 2).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Relationships (Part 13c) */}
          <h4 style={{ margin: "18px 0 6px", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Search-term relationships (evidence-backed)
          </h4>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
            NEX learns relationships between search terms as evidence accumulates.
            <strong> {detail.relationships.length} relationships</strong> observed.
            Never silently promoted to Founder vocabulary.
          </div>
          {detail.relationships.length === 0 && (
            <div style={{ padding: 10, background: "#f8faf7", borderRadius: 6, fontSize: 12, color: "#666" }}>
              No relationships observed yet. Relationships emerge from cycle observations.
            </div>
          )}
          {detail.relationships.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                    <th style={thStyle}>Parent term</th>
                    <th style={thStyle}>Child term</th>
                    <th style={thStyle}>Kind</th>
                    <th style={thStyle}>Evidence</th>
                    <th style={thStyle}>Confidence</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.relationships.slice(0, 30).map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                      <td style={tdStyle}><strong>{r.parent_term}</strong></td>
                      <td style={tdStyle}>{r.child_term}</td>
                      <td style={tdStyle}>{r.relationship_kind}</td>
                      <td style={tdStyle}>{r.evidence_count}</td>
                      <td style={tdStyle}>{r.confidence.toFixed(2)}</td>
                      <td style={tdStyle}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent cycles (Part 13c) */}
          <h4 style={{ margin: "18px 0 6px", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Recent discovery cycles ({detail.recent_cycles.length})
          </h4>
          {detail.recent_cycles.length === 0 && (
            <div style={{ padding: 10, background: "#f8faf7", borderRadius: 6, fontSize: 12, color: "#666" }}>
              No cycles have touched this country yet.
            </div>
          )}
          {detail.recent_cycles.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Started</th>
                    <th style={thStyle}>Outcome</th>
                    <th style={thStyle}>Duration</th>
                    <th style={thStyle}>Businesses</th>
                    <th style={thStyle}>New</th>
                    <th style={thStyle}>Existing</th>
                    <th style={thStyle}>Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recent_cycles.map(c => (
                    <tr key={c.cycle_id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                      <td style={tdStyle}>#{c.cycle_seq}</td>
                      <td style={tdStyle}>{c.started_at ? new Date(c.started_at).toLocaleTimeString() : "—"}</td>
                      <td style={{ ...tdStyle, color: outcomeFg(c.outcome) }}>{c.outcome}</td>
                      <td style={tdStyle}>{c.duration_ms ?? "—"}ms</td>
                      <td style={tdStyle}>{c.businesses_discovered}</td>
                      <td style={tdStyle}>{c.new_emails}</td>
                      <td style={tdStyle}>{c.existing_matched}</td>
                      <td style={tdStyle}>{c.rejected_emails}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <style>{`
        @keyframes nex-pulse {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

// ─── Outcome color helpers (used by orchestration strip + cycle rows) ─
function outcomeBg(outcome: string): string {
  switch (outcome) {
    case "complete":   return "#dcfce7";
    case "partial":    return "#ffedd5";
    case "no_work":    return "#f3f4f6";
    case "superseded": return "#fee2e2";
    case "in_progress":return "#fef9c3";
    case "zero_results": return "#f5f5f4";
    case "source_unavailable": return "#fee2e2";
    default: return "#f3f4f6";
  }
}
function outcomeFg(outcome: string): string {
  switch (outcome) {
    case "complete":   return "#166534";
    case "partial":    return "#7c2d12";
    case "no_work":    return "#666";
    case "superseded": return "#991b1b";
    case "in_progress":return "#713f12";
    case "zero_results": return "#57534e";
    case "source_unavailable": return "#991b1b";
    default: return "#333";
  }
}
// ─── Entity state badge ─────────────────────────────────────────
function EntityStateBadge({ state }: { state: EntityRow["state"] }) {
  const styles: Record<EntityRow["state"], React.CSSProperties> = {
    unresolved:         { background: "#f3f4f6", color: "#666" },
    candidate_entity:   { background: "#fef9c3", color: "#713f12" },
    resolved_entity:    { background: "#dcfce7", color: "#166534" },
    ambiguous_entity:   { background: "#fee2e2", color: "#991b1b" },
    rejected_entity:    { background: "#e5e7eb", color: "#111" },
  };
  return (
    <span style={{ ...styles[state], padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>
      {state.replace("_entity", "")}
    </span>
  );
}

function Metric({ main, label, strong = false, small = false }: { main: string; label: string; strong?: boolean; small?: boolean }) {
  return (
    <div style={{ background: strong ? "#166534" : "#f8faf7", color: strong ? "#fff" : "#111", padding: small ? 8 : 12, borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: small ? 16 : 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{main}</div>
      <div style={{ fontSize: 10, color: strong ? "rgba(255,255,255,0.85)" : "#666", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}

function StatMini({ value, label, color, strong = false }: { value: string; label: string; color?: string; strong?: boolean }) {
  return (
    <div style={{ background: strong ? "#166534" : "rgba(255,255,255,0.7)", color: strong ? "#fff" : "#111", padding: 8, borderRadius: 4, border: "1px solid rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: strong ? "#fff" : (color ?? "#111") }}>{value}</div>
      <div style={{ fontSize: 9, color: strong ? "rgba(255,255,255,0.85)" : "#666", marginTop: 1, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}
function StatusChip({ status, n, active, onClick }: { status: CountryStatus; n: number; active: boolean; onClick: () => void }) {
  const s = STATUS_STYLE[status];
  return (
    <button onClick={onClick} style={{ background: active ? "#166534" : s.bg, color: active ? "#fff" : s.fg, border: 0, borderRadius: 4, padding: 8, cursor: "pointer", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 6, alignItems: "center" }}>
      <span style={{ ...dotStyle, background: s.dot }} />
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>{s.label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{n}</span>
    </button>
  );
}
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 12px", background: active ? "#166534" : "#fff", color: active ? "#fff" : "#333", border: `1px solid ${active ? "#166534" : "rgba(0,0,0,0.15)"}`, borderRadius: 999, fontSize: 12, cursor: "pointer", minHeight: 32, fontWeight: 600 }}>
      {label}
    </button>
  );
}

const dotStyle: React.CSSProperties = { width: 10, height: 10, borderRadius: "50%", display: "inline-block" };
const thStyle: React.CSSProperties = { padding: "6px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "#555", fontWeight: 700, whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "6px 8px", fontSize: 12, color: "#333", verticalAlign: "top" };
