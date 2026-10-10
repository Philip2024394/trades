// EMAIL HARVEST · Evidence & Provenance (live)
//
// Renders every row from nex.discovery_business_evidence with full
// provenance: what (business_name) / where (website + source URLs) /
// when (first_seen_at) / how (discovered_via_source + evidence_url) /
// confidence (email_extraction_confidence) / provenance tier
// (email_evidence_tier) / entity resolution state.
//
// Every field is a live DB read. No fabrication.

"use client";

import { useEffect, useState } from "react";
import type { EmailHarvestPage } from "@/lib/nex-hq/email-harvest-manifest";

interface EvidenceFeed {
  ok: boolean;
  server_now?: string;
  totals?: any;
  by_country?: any[];
  by_source?: any[];
  by_evidence_tier?: any[];
  by_confidence_bucket?: any[];
  by_entity_state?: any[];
  rows?: any[];
  standing_marketing_status_line?: string;
  warning?: string;
  detail?: string;
  error?: string;
}

export default function EmailHarvestEvidence({ page }: { page: EmailHarvestPage }) {
  const [feed, setFeed] = useState<EvidenceFeed | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [withEmailOnly, setWithEmailOnly] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    async function doFetch() {
      try {
        const qs = new URLSearchParams();
        qs.set("limit", "200");
        if (withEmailOnly) qs.set("with_email", "true");
        if (countryFilter) qs.set("country", countryFilter);
        const r = await fetch("/api/nex/founder/email-harvest/evidence?" + qs.toString(), { cache: "no-store" });
        const j: EvidenceFeed = await r.json();
        if (cancelled) return;
        if (!j.ok && !j.warning) throw new Error(j.error ?? "fetch failed");
        setFeed(j);
        setLastFetchAt(new Date());
        setError(null);
      } catch (e: any) { if (!cancelled) setError(e?.message ?? String(e)); }
    }
    void doFetch();
    const iv = setInterval(() => { void doFetch(); }, 3000);          // 3s cadence
    return () => { cancelled = true; clearInterval(iv); };
  }, [countryFilter, withEmailOnly]);

  const rows = feed?.rows ?? [];
  const totals = feed?.totals;

  return (
    <div style={{ padding: 24, background: "#0a0a0a", color: "#e5e7eb", minHeight: "100vh", fontFamily: "ui-monospace, monospace" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>{page.label.toUpperCase()} · EMAIL HARVEST</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "4px 0", color: "#f9fafb" }}>Evidence & Provenance · Live</h1>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          Every row below is a real record in `nex.discovery_business_evidence`. Every column is the actual stored value.
          Joined at request time with `nex.discovery_entity` (entity resolution state) and `nex.harvest_source` (source signature).
          {feed?.server_now && <> · Server clock: {feed.server_now.slice(11, 23)}</>}
          {lastFetchAt && <> · Last refreshed: {lastFetchAt.toISOString().slice(11, 23)}</>}
        </div>
      </div>

      {error && <Panel accent="#dc2626"><div style={{ color: "#fca5a5" }}>Fetch error: {error}</div></Panel>}
      {feed?.warning && <Panel accent="#eab308"><div style={{ color: "#fbbf24" }}>{feed.warning}: {feed.detail}</div></Panel>}

      {/* Filter controls · client-side, DB does the actual filtering */}
      <Panel title="🔍 Filters">
        <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={withEmailOnly} onChange={e => setWithEmailOnly(e.target.checked)} />
            <span>Only rows with email</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>Country ISO:</span>
            <input
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="e.g. GB · leave empty = all"
              style={{ background: "#1f2937", color: "#e5e7eb", border: "1px solid #374151", padding: "4px 8px", width: 140, fontFamily: "ui-monospace, monospace" }}
            />
          </label>
        </div>
      </Panel>

      {/* Totals */}
      {totals && (
        <Panel title="📊 Totals (unfiltered baseline · from DB)">
          <Grid cols={6}>
            <Kv k="Total evidence rows" v={totals.total_rows} big />
            <Kv k="With email" v={totals.with_email} big good />
            <Kv k="With email source URL" v={totals.with_source_url} big />
            <Kv k="Distinct countries" v={totals.distinct_countries} big />
            <Kv k="Distinct sources" v={totals.distinct_sources} big />
            <Kv k="Entities total" v={totals.entities_total} big />
          </Grid>
        </Panel>
      )}

      {/* By country */}
      <Panel title="🗺 By country (nex.discovery_business_evidence GROUP BY iso_alpha_2)">
        <Table
          headers={["ISO", "Rows", "With email", "Distinct websites"]}
          rows={(feed?.by_country ?? []).map(r => [r.iso_alpha_2, r.rows, r.with_email, r.distinct_websites])}
        />
      </Panel>

      {/* By source */}
      <Panel title="🗄 By discovery source (via nex.harvest_source join)">
        <Table
          headers={["Source", "Rows", "With email", "Distinct countries"]}
          rows={(feed?.by_source ?? []).map(r => [r.discovered_via_source, r.rows, r.with_email, r.distinct_countries])}
        />
      </Panel>

      {/* Provenance tier */}
      <Panel title="🎖 By evidence tier (email_evidence_tier)">
        <Table
          headers={["Tier", "Rows"]}
          rows={(feed?.by_evidence_tier ?? []).map(r => [r.tier, r.rows])}
        />
      </Panel>

      {/* Confidence */}
      <Panel title="📶 By extraction confidence bucket">
        <Table
          headers={["Confidence bucket", "Rows"]}
          rows={(feed?.by_confidence_bucket ?? []).map(r => [r.bucket, r.rows])}
        />
      </Panel>

      {/* Entity states */}
      <Panel title="🧬 By entity resolution state (nex.discovery_entity)">
        <Table
          headers={["State", "Rows"]}
          rows={(feed?.by_entity_state ?? []).map(r => [r.state, r.rows])}
        />
      </Panel>

      {/* Row-by-row detail · full provenance */}
      <Panel title={`📑 Evidence rows · full provenance · showing ${rows.length}`}>
        {rows.length === 0 ? <Empty>No rows match the current filter.</Empty> : rows.map(r => (
          <div key={r.evidence_id} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{r.business_name ?? "—"}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  [{r.iso_alpha_2}] · {r.category ?? "no category"} · first_seen {r.first_seen_at?.slice(0, 19).replace("T", " ")}
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 11 }}>
                {r.discovered_email && (
                  <div style={{ background: "#065f46", padding: "3px 8px", borderRadius: 4, color: "#a7f3d0", fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
                    ✉ {r.discovered_email}
                  </div>
                )}
                {r.email_evidence_tier && <div style={{ marginTop: 4, color: "#a7f3d0" }}>tier: {r.email_evidence_tier}</div>}
                {r.email_extraction_confidence != null && <div style={{ color: "#9ca3af" }}>confidence: {Number(r.email_extraction_confidence).toFixed(2)}</div>}
              </div>
            </div>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 11, color: "#d1d5db" }}>
              <span style={{ color: "#9ca3af" }}>website:</span>
              <span>{r.website_url ? <a href={r.website_url} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>{r.website_url}</a> : "—"}</span>

              <span style={{ color: "#9ca3af" }}>contact page:</span>
              <span>{r.contact_page_url ? <a href={r.contact_page_url} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>{r.contact_page_url}</a> : "—"}</span>

              <span style={{ color: "#9ca3af" }}>email source:</span>
              <span>{r.email_source_url ? <a href={r.email_source_url} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>{r.email_source_url}</a> : "—"}</span>

              <span style={{ color: "#9ca3af" }}>via source:</span>
              <span>{r.discovered_via_source ?? "—"} {r.source_founder_signed_at ? <span style={{ color: "#a7f3d0" }}>· Founder-signed {r.source_founder_signed_at.slice(0, 10)}</span> : ""}</span>

              <span style={{ color: "#9ca3af" }}>via evidence url:</span>
              <span>{r.discovered_via_evidence_url ? <a href={r.discovered_via_evidence_url} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>{r.discovered_via_evidence_url}</a> : "—"}</span>

              <span style={{ color: "#9ca3af" }}>via term:</span>
              <span>{r.discovered_via_term ?? "—"}</span>

              <span style={{ color: "#9ca3af" }}>email type:</span>
              <span>{r.email_type ?? "—"}</span>

              <span style={{ color: "#9ca3af" }}>email domain:</span>
              <span>{r.email_provider_domain ?? "—"}</span>

              <span style={{ color: "#9ca3af" }}>entity:</span>
              <span>{r.entity_id ? `${r.entity_id.slice(0, 8)} · state=${r.entity_state ?? "?"}${r.entity_confidence != null ? " · conf=" + Number(r.entity_confidence).toFixed(2) : ""}` : "—"}</span>

              <span style={{ color: "#9ca3af" }}>cycle:</span>
              <span>{r.cycle_id ? r.cycle_id.slice(0, 8) : "—"}</span>

              <span style={{ color: "#9ca3af" }}>evidence_id:</span>
              <span style={{ fontFamily: "ui-monospace, monospace", color: "#6b7280" }}>{r.evidence_id}</span>
            </div>
          </div>
        ))}
      </Panel>

      <div style={{ marginTop: 24, padding: 12, background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12, color: "#e5e7eb" }}>
        <strong style={{ color: "#9ca3af" }}>STANDING MARKETING LINE (verbatim · governance-controlled):</strong>
        <div style={{ marginTop: 4, fontWeight: 600 }}>
          {feed?.standing_marketing_status_line ?? "NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD."}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "#6b7280" }}>
        Data source authority: `nex.discovery_business_evidence` (evidence rows) · `nex.discovery_entity` (entity resolution) · `nex.harvest_source` (Founder-signed source signature) — all joined at request time · no caching · no fabrication.
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
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 12, color: "#6b7280", fontSize: 13, fontStyle: "italic" }}>{children}</div>;
}
function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
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
