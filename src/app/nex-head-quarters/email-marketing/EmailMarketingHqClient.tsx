"use client";

// Reads the existing backend endpoints · never rebuilds them. Graceful degradation
// when endpoints unavailable in the current environment.

import { useEffect, useState } from "react";

interface Stats {
  pipeline?: Record<string, number>;
  by_source?: Record<string, number>;
  by_country?: Record<string, number>;
  env?: { send_enabled?: boolean; esp?: string; rate_limit?: number };
}

interface Matrix {
  cells?: Array<{ category: string; country: string; count: number; sample?: string[] }>;
}

interface ReadinessReport {
  ok?: boolean;
  report?: {
    generated_at?: string;
    verifiers?: Array<{ provider: string; secret_configured: boolean; state: string }>;
    classifier?: { state: string; note?: string };
    recorder?: { state: string; bounce_log_migration_applied?: boolean; total_recorded_events?: number };
    reputation?: { state: string; senders_with_reputation?: number };
    domain_auth?: { state: string; domains_tracked?: number; domains_aligned?: number };
    gates?: Record<string, boolean>;
    overall_state?: string;
    summary_line?: string;
  };
}

interface MatrixReport {
  ok?: boolean;
  matrix?: {
    counts?: { green_under_test?: number; founder_decision_deferred?: number; total?: number };
    world_proof_state?: string;
    gate_status_line?: string;
    standing_marketing_status_line?: string;
    categories?: Array<{ letter: string; title: string; state: string; session_of_record: string }>;
  };
}

interface InventoryReport {
  ok?: boolean;
  inventory?: {
    totals?: any;
    countries?: Array<{ iso: string; name: string; total: number; not_suppressed: number }>;
    categories?: Array<{ key: string; label: string; total: number; not_suppressed: number }>;
  };
}

interface WorldCountriesReport {
  ok?: boolean;
  countries?: Array<{ iso_alpha_2: string; name: string; region: string; un_member: boolean }>;
}

interface ScaffoldingProgrammeReport {
  ok?: boolean;
  status?: {
    programme: { slug: string; display_name: string; asia_last_policy_active: boolean; topic: string } | null;
    queue: { total_in_scope: number; completed: number; in_progress: number; queued: number; idle: number; zero_results: number; source_unavailable: number; blocked: number; percent_completed: number | null };
    asia_last: { non_asia_total: number; non_asia_completed: number; non_asia_remaining: number; asia_total: number; asia_completed: number; asia_remaining: number; in_asia_tail: boolean };
    cumulative_business_evidence: { total_rows: number; rows_with_email: number; rows_without_email: number; distinct_websites: number; distinct_countries_touched: number; rows_last_24h: number; rows_last_7d: number; provenance_coverage_percent: number | null };
    cumulative_emails: { total_captured: number; with_source_url: number; with_source_url_percent: number | null; by_country: Array<{ country: string; total: number }> };
    entities: { total: number; unresolved: number; candidate: number; resolved: number; ambiguous: number; rejected: number };
    current_country: { iso: string; name: string; region: string; status: string; businesses_discovered_today: number; new_emails_today: number; evidence_rows_lifetime: number; emails_captured_lifetime: number; last_cycle_at: string | null } | null;
    cycles: { total: number; last_24h: number; outcome_zero_results: number; outcome_source_unavailable: number; most_recent_at: string | null };
    generated_at: string;
  } | null;
  warning?: string;
}

export function EmailMarketingHqClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [az, setAz] = useState<MatrixReport | null>(null);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [worldCountries, setWorldCountries] = useState<WorldCountriesReport | null>(null);
  const [scaffolding, setScaffolding] = useState<ScaffoldingProgrammeReport | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, mRes, rRes, aRes, iRes, wcRes, spRes] = await Promise.all([
          fetch("/api/nex/marketing/stats", { cache: "no-store" }).catch(() => null),
          fetch("/api/nex/marketing/matrix", { cache: "no-store" }).catch(() => null),
          fetch("/api/nex/founder/marketing/sending-safety-readiness", { cache: "no-store" }).catch(() => null),
          fetch("/api/nex/founder/marketing/acceptance-matrix", { cache: "no-store" }).catch(() => null),
          fetch("/api/nex/founder/marketing/inventory", { cache: "no-store" }).catch(() => null),
          fetch("/api/nex/founder/world/countries?programme=scaffolding", { cache: "no-store" }).catch(() => null),
          fetch("/api/nex/founder/world/scaffolding-programme-status?programme=scaffolding", { cache: "no-store" }).catch(() => null),
        ]);
        if (sRes?.ok) setStats(await sRes.json());
        if (mRes?.ok) setMatrix(await mRes.json());
        if (rRes?.ok) setReadiness(await rRes.json());
        if (aRes?.ok) setAz(await aRes.json());
        if (iRes?.ok) setInventory(await iRes.json());
        if (wcRes?.ok) setWorldCountries(await wcRes.json());
        if (spRes?.ok) setScaffolding(await spRes.json());
        setLastRefresh(new Date().toLocaleTimeString());
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load email marketing data");
      }
    };
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  const r = readiness?.report;
  const m = az?.matrix;
  const inv = inventory?.inventory;
  // Union of world registry (242) + inventory countries (with real contact counts)
  const inventoryCountryByIso = new Map(inv?.countries?.map(c => [c.iso, c]) ?? []);
  const allCountries = worldCountries?.countries?.map(wc => ({
    iso: wc.iso_alpha_2,
    name: wc.name,
    region: wc.region,
    un_member: wc.un_member,
    contact_total: inventoryCountryByIso.get(wc.iso_alpha_2)?.total ?? 0,
    contact_sendable: inventoryCountryByIso.get(wc.iso_alpha_2)?.not_suppressed ?? 0,
  })) ?? [];
  const selectedCountryDetail = allCountries.find(c => c.iso === selectedCountry);
  const selectedCategoryDetail = inv?.categories?.find(c => c.key === selectedCategory);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div className="nws-card" style={{ color: "var(--nws-danger)" }}>
          Backend endpoint unavailable · {error}
        </div>
      )}

      {/* ═══ NEX Intelligence · Live Status ═══ */}
      <div className="nws-card" style={{ background: "linear-gradient(180deg, rgba(34,211,238,0.10), rgba(34,211,238,0.02))", borderColor: "rgba(34,211,238,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, margin: 0, color: "var(--nws-cyan)" }}>NEX Intelligence · Live Status</h3>
          <span style={{ fontSize: 10, color: "var(--nws-slate)" }}>
            Auto-refresh 20s{lastRefresh ? ` · last ${lastRefresh}` : ""}
          </span>
        </div>
        {!r && !m ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>Founder endpoints unavailable in this environment · panel visible when authenticated as Founder.</p>
        ) : (
          <>
            {m && (
              <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Standing marketing status line</div>
                <div style={{ fontSize: 12, color: "var(--nws-cyan)", fontWeight: 600 }}>
                  {m.standing_marketing_status_line ?? "—"}
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 12 }}>
              {r && (
                <>
                  <IntelTile label="Overall chain state" value={r.overall_state ?? "—"} tone={r.overall_state === "ready" ? "green" : "amber"} />
                  <IntelTile label="Recorder" value={r.recorder?.state ?? "—"} tone={r.recorder?.state === "ready" ? "green" : "slate"} />
                  <IntelTile label="Reputation" value={r.reputation?.state ?? "—"} tone={r.reputation?.state === "ready" ? "green" : "slate"} />
                  <IntelTile label="Domain auth" value={r.domain_auth?.state ?? "—"} tone={r.domain_auth?.state === "ready" ? "green" : "slate"} />
                </>
              )}
              {m && (
                <>
                  <IntelTile label="A-Z proven under test" value={`${m.counts?.green_under_test ?? "—"} / ${m.counts?.total ?? "—"}`} tone="green" />
                  <IntelTile label="Founder-deferred categories" value={String(m.counts?.founder_decision_deferred ?? "—")} tone="amber" />
                  <IntelTile label="World-proof state" value={m.world_proof_state ?? "—"} tone={m.world_proof_state === "fully_proven" ? "green" : "amber"} />
                </>
              )}
            </div>

            {r?.verifiers && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Webhook verifiers</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {r.verifiers.map(v => (
                    <span key={v.provider} style={{
                      padding: "3px 8px", borderRadius: 999, fontSize: 10,
                      background: v.state === "ready" ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.10)",
                      color: v.state === "ready" ? "var(--nws-success)" : "var(--nws-slate)",
                      border: `1px solid ${v.state === "ready" ? "rgba(34,197,94,0.4)" : "rgba(148,163,184,0.25)"}`,
                    }}>
                      {v.provider} · {v.state}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {r?.gates && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Four Founder-controlled activation gates</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(r.gates).map(([k, v]) => (
                    <span key={k} style={{
                      padding: "3px 8px", borderRadius: 999, fontSize: 10,
                      background: v ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.10)",
                      color: v ? "var(--nws-success)" : "var(--nws-warning)",
                      border: `1px solid ${v ? "rgba(34,197,94,0.4)" : "rgba(234,179,8,0.35)"}`,
                    }}>
                      {k.replace(/_/g, " ")} · {v ? "ON" : "dormant"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {r?.summary_line && (
              <div style={{ fontSize: 11, color: "var(--nws-slate)", fontStyle: "italic" }}>
                {r.summary_line}
              </div>
            )}

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--nws-card-border)", fontSize: 10, color: "var(--nws-slate)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--nws-cyan)" }}>Architectural principle:</strong> NEX can hold complete 24/7 machinery before it is granted the authority to operate 24/7.
              &nbsp;·&nbsp; Every gate above is a Founder decision · not a bug.
              &nbsp;·&nbsp; Zero LLM at runtime · every classifier/scheduler/recorder is a pure deterministic function.
            </div>
          </>
        )}
      </div>

      {/* ═══ Scaffolding World Discovery · Live Harvest State ═══ */}
      <div className="nws-card" style={{ background: "linear-gradient(180deg, rgba(22,163,74,0.06), rgba(22,163,74,0.01))", borderColor: "rgba(22,163,74,0.30)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, margin: 0, color: "var(--nws-success)" }}>Scaffolding World Discovery · Live Harvest State</h3>
          <a href="/nex-head-quarters/world-discovery" style={{ fontSize: 10, color: "var(--nws-cyan)", textDecoration: "underline" }}>
            open full world-discovery →
          </a>
        </div>
        {!scaffolding?.status && scaffolding?.warning === "schema_not_applied" && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>Discovery-world schema not applied in this environment.</p>
        )}
        {!scaffolding?.status && !scaffolding?.warning && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>Founder endpoints unavailable · panel visible when authenticated as Founder against a live NEX database.</p>
        )}
        {scaffolding?.status && (() => {
          const s = scaffolding.status!;
          const totalCompanies = s.cumulative_business_evidence.total_rows;
          const totalEmails = s.cumulative_emails.total_captured;
          const provPct = s.cumulative_business_evidence.provenance_coverage_percent;
          const zeroYet = totalCompanies === 0 && totalEmails === 0;
          return (
            <>
              {zeroYet && (
                <div style={{ padding: "10px 12px", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.35)", borderRadius: 6, marginBottom: 12, fontSize: 12, color: "var(--nws-slate)" }}>
                  <strong style={{ color: "var(--nws-warning)" }}>0 scaffolding companies · 0 emails harvested yet.</strong>
                  &nbsp;This is the truthful state · cycles are running but returning <code>zero_results</code> because Gate #1 (production PageFetcher) is dormant in this deployment and no business-directory host is on the signed allowlist. Flip <code>NEX_PAGE_FETCHER_ACTIVATION=on</code> and follow <code>docs/world-activation-pack/01-runbook-per-gate.md</code>.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 10 }}>
                <IntelTile label="Scaffolding companies" value={totalCompanies.toLocaleString()} tone={totalCompanies > 0 ? "green" : "amber"} />
                <IntelTile label="Public emails captured" value={totalEmails.toLocaleString()} tone={totalEmails > 0 ? "green" : "amber"} />
                <IntelTile label="Provenance coverage" value={provPct !== null ? `${provPct.toFixed(1)}%` : "—"} tone={provPct !== null && provPct > 0 ? "green" : "amber"} />
                <IntelTile label="Countries touched" value={String(s.cumulative_business_evidence.distinct_countries_touched)} tone={s.cumulative_business_evidence.distinct_countries_touched > 0 ? "green" : "amber"} />
                <IntelTile label="New · last 24h" value={String(s.cumulative_business_evidence.rows_last_24h)} tone="slate" />
                <IntelTile label="Cycles · last 24h" value={String(s.cycles.last_24h)} tone="slate" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 10, padding: 8, background: "rgba(0,0,0,0.15)", borderRadius: 6 }}>
                <IntelTile label="Queue in scope" value={String(s.queue.total_in_scope)} tone="slate" />
                <IntelTile label="Completed" value={String(s.queue.completed)} tone={s.queue.completed > 0 ? "green" : "slate"} />
                <IntelTile label="In progress" value={String(s.queue.in_progress)} tone="amber" />
                <IntelTile label="Non-Asia remaining" value={String(s.asia_last.non_asia_remaining)} tone="slate" />
                <IntelTile label="Asia remaining" value={String(s.asia_last.asia_remaining)} tone="slate" />
                <IntelTile label="In Asia tail?" value={s.asia_last.in_asia_tail ? "YES" : "NO"} tone={s.asia_last.in_asia_tail ? "amber" : "green"} />
              </div>
              {s.current_country ? (
                <div style={{ padding: 10, background: "rgba(22,163,74,0.10)", border: "1px solid rgba(22,163,74,0.35)", borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--nws-success)", fontWeight: 700, marginBottom: 6 }}>Current country · live</div>
                  <strong style={{ color: "var(--nws-cyan)" }}>{s.current_country.name} ({s.current_country.iso})</strong>
                  &nbsp;·&nbsp;{s.current_country.region}
                  &nbsp;·&nbsp;<span style={{ padding: "1px 6px", borderRadius: 999, background: "var(--nws-success)", color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{s.current_country.status}</span>
                  &nbsp;·&nbsp;{s.current_country.evidence_rows_lifetime} evidence rows lifetime
                  &nbsp;·&nbsp;{s.current_country.emails_captured_lifetime} emails captured lifetime
                </div>
              ) : (
                <div style={{ padding: 8, background: "rgba(0,0,0,0.15)", borderRadius: 6, fontSize: 11, color: "var(--nws-slate)", marginBottom: 8 }}>
                  No country currently in <code>crawling</code>/<code>processing</code> state.
                </div>
              )}
              <div style={{ fontSize: 10, color: "var(--nws-slate)", lineHeight: 1.5, paddingTop: 8, borderTop: "1px solid var(--nws-card-border)" }}>
                All values above are counts from persisted state (<code>discovery_business_evidence</code>, <code>discovery_country_state</code>, <code>discovery_cycle</code>) · no email addresses shown on this screen · country queue order = existing programme policy (Asia-last {s.asia_last.in_asia_tail ? "· now in tail" : "· not yet in tail"}).
                {" · English-first policy is NOT currently encoded (a Founder governance decision, separate from this fix)."}
              </div>
            </>
          );
        })()}
      </div>

      {/* ═══ Audience Targeting · All countries + categories ═══ */}
      <div className="nws-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>Audience targeting · country × category</h3>
          <span style={{ fontSize: 10, color: "var(--nws-slate)" }}>
            {allCountries.length} countries · {inv?.categories?.length ?? 0} categories · from live registry + inventory
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
              Country ({allCountries.length} total)
            </label>
            <select
              value={selectedCountry}
              onChange={e => setSelectedCountry(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px", fontSize: 12,
                background: "rgba(0,0,0,0.3)", color: "var(--nws-cyan)",
                border: "1px solid var(--nws-card-border)", borderRadius: 6,
              }}
            >
              <option value="">— All countries —</option>
              {[...allCountries]
                .sort((a, b) => (b.contact_sendable - a.contact_sendable) || a.name.localeCompare(b.name))
                .map(c => (
                  <option key={c.iso} value={c.iso}>
                    {c.name} ({c.iso}) · {c.contact_sendable} sendable / {c.contact_total} total
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
              Category ({inv?.categories?.length ?? 0} available)
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px", fontSize: 12,
                background: "rgba(0,0,0,0.3)", color: "var(--nws-cyan)",
                border: "1px solid var(--nws-card-border)", borderRadius: 6,
              }}
            >
              <option value="">— All categories —</option>
              {(inv?.categories ?? []).map(c => (
                <option key={c.key} value={c.key}>
                  {c.label} · {c.not_suppressed} sendable / {c.total} total
                </option>
              ))}
            </select>
          </div>
        </div>
        {(selectedCountryDetail || selectedCategoryDetail) && (
          <div style={{ padding: "10px 12px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.3)", borderRadius: 6, fontSize: 12 }}>
            <strong style={{ color: "var(--nws-cyan)" }}>Selected audience:</strong>{" "}
            {selectedCountryDetail && <span>{selectedCountryDetail.name} ({selectedCountryDetail.region})</span>}
            {selectedCountryDetail && selectedCategoryDetail && " · "}
            {selectedCategoryDetail && <span>{selectedCategoryDetail.label}</span>}
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--nws-slate)" }}>
              Preview via <code>POST /api/nex/founder/marketing/campaign-preflight</code> with{" "}
              {selectedCountryDetail && <code>country="{selectedCountryDetail.iso}"</code>}
              {selectedCountryDetail && selectedCategoryDetail && " · "}
              {selectedCategoryDetail && <code>category="{selectedCategoryDetail.key}"</code>}
            </div>
          </div>
        )}
      </div>

      {/* Environment status */}
      <div className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Environment</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, fontSize: 12 }}>
          <EnvTile label="Send enabled" value={stats?.env?.send_enabled ? "YES" : "NO"} tone={stats?.env?.send_enabled ? "green" : "amber"} />
          <EnvTile label="ESP" value={stats?.env?.esp ?? "…"} tone="cyan" />
          <EnvTile label="Rate limit" value={stats?.env?.rate_limit ? `${stats.env.rate_limit}/hr` : "…"} tone="slate" />
        </div>
      </div>

      {/* Pipeline */}
      <div className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>7-stage pipeline</h3>
        {!stats?.pipeline ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>Backend not reachable · pipeline stats unavailable.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {Object.entries(stats.pipeline).map(([stage, count]) => (
              <div key={stage} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--nws-card-border)", borderRadius: 8, padding: 10, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--nws-cyan)" }}>{count}</div>
                <div style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{stage.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category × country matrix */}
      <div className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Category × country matrix</h3>
        {!matrix?.cells || matrix.cells.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>Backend not reachable · matrix unavailable.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Category", "Country", "Contacts", "Sample subcategories"].map((h) => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "var(--nws-slate)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--nws-card-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.cells.slice(0, 100).map((c, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                    <td style={{ padding: "6px 10px" }}><code>{c.category}</code></td>
                    <td style={{ padding: "6px 10px" }}>{c.country}</td>
                    <td style={{ padding: "6px 10px", color: "var(--nws-cyan)", fontWeight: 700 }}>{c.count}</td>
                    <td style={{ padding: "6px 10px", color: "var(--nws-slate)" }}>{c.sample?.slice(0, 3).join(" · ") ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sources + countries */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="nws-card">
          <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>By source</h3>
          {!stats?.by_source ? <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>—</p> :
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(stats.by_source).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--nws-slate)" }}>{k}</span>
                  <strong style={{ color: "var(--nws-cyan)" }}>{v}</strong>
                </div>
              ))}
            </div>
          }
        </div>
        <div className="nws-card">
          <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>By country</h3>
          {!stats?.by_country ? <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>—</p> :
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(stats.by_country).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--nws-slate)" }}>{k}</span>
                  <strong style={{ color: "var(--nws-cyan)" }}>{v}</strong>
                </div>
              ))}
            </div>
          }
        </div>
      </div>

      <div className="nws-card" style={{ background: "rgba(34,211,238,0.06)", borderColor: "rgba(34,211,238,0.3)" }}>
        <div style={{ fontSize: 12, color: "var(--nws-slate)" }}>
          <strong style={{ color: "var(--nws-cyan)" }}>Backend preserved</strong> · this HQ page is read-only monitoring · founder authoring (templates · campaigns · policies) remains at <a href="/nexapp/lab/marketing" style={{ color: "var(--nws-cyan)" }}>/nexapp/lab/marketing</a> · nothing rebuilt · nothing broken.
        </div>
      </div>
    </div>
  );
}

function EnvTile({ label, value, tone }: { label: string; value: string; tone: "green" | "cyan" | "amber" | "slate" }) {
  const color = tone === "green" ? "var(--nws-success)" : tone === "cyan" ? "var(--nws-cyan)" : tone === "amber" ? "var(--nws-warning)" : "var(--nws-slate)";
  return (
    <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--nws-card-border)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function IntelTile({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "slate" }) {
  const color = tone === "green" ? "var(--nws-success)" : tone === "amber" ? "var(--nws-warning)" : "var(--nws-slate)";
  const bg = tone === "green" ? "rgba(34,197,94,0.08)" : tone === "amber" ? "rgba(234,179,8,0.06)" : "rgba(0,0,0,0.20)";
  return (
    <div style={{ background: bg, border: "1px solid var(--nws-card-border)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color, textTransform: "capitalize" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{label}</div>
    </div>
  );
}
