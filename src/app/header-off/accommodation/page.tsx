// src/app/header-off/accommodation/page.tsx
//
// NEX Headquarters · Accommodation Container · LIVE PROOF page
// Founder BEGIN 2026-09-08 · Indonesia Complete Country Intelligence Mission
//
// Renders:
//   §21 · 3 REAL landscape hotel cards (backed by nex.accommodation_business)
//   §23 · 10 REAL postings (never fabricates; if fewer visible rows exist, honestly says so)
//   §22 · "Found N" reflects ACTUAL count from Postgres
//   §29 · observatory strip (coverage state · gap counts · latency · evidence label)
//
// Data source: /api/nex/accommodation/live-proof (Server Component fetches server-side).
// No LLM. No fabrication. No third-party image copy (ADR-0022 preserved).
//
// If the API returns 0 rows or an error, the page HONESTLY says so.

import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "NEX Headquarters · Accommodation · Live Proof",
  description: "Live NEX Chat accommodation demonstration · 3 landscape cards + 10 postings · zero fabrication",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface LandscapeCard {
  posting_id: string;
  hotel_name: string;
  location_label: string;
  property_type: string;
  hero_image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  star_rating: number | null;
  amenities_top: string[];
  useful_facts: string[];
  evidence_label: string;
}

interface Posting {
  posting_id: string;
  hotel_name: string;
  category: string;
  city: string;
  district: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  star_rating: number | null;
  room_count: number | null;
  amenity_count: number;
  hero_image_url: string | null;
  has_website: boolean;
  has_phone: boolean;
  claim_status: string;
  evidence_label: string;
}

interface GapEngineSummary {
  scanned_rows: number;
  scanned_rows_denominator_note: string;
  total_gaps_detected: number;
  gaps_by_kind: Record<string, number>;
  top_gap_kinds: readonly { kind: string; count: number }[];
  gap_kinds_enum_size: number;
}

interface CoverageSummary {
  total_units: number;
  provinces_total: number;
  provinces_not_started: number;
  provinces_partially_covered: number;
  provinces_covered: number;
  provinces_source_unavailable: number;
  properties_measured_total: number;
  attempted_units: number;
  attempted_units_denominator_note: string;
}

interface CoveragePriorityRow {
  unit_slug: string;
  display_name: string;
  island_group: string | null;
  state: string;
  state_reason: string;
  property_count_measured: number;
  tourism_evidence_strength: number;
  next_research_priority: number;
}

interface AgentHeartbeat {
  status: string;
  status_verdict: "ACTIVE" | "DEGRADED" | "STOPPED" | "UNKNOWN";
  last_heartbeat_iso: string | null;
  heartbeat_age_seconds: number | null;
  process_id: number | null;
  current_task: string | null;
  internet_state: string;
  last_success_iso: string | null;
  last_failure_iso: string | null;
}

interface LiveProofResponse {
  found: number;
  found_denominator_note: string;
  requested_limit: number;
  landscape_card_count: number;
  city: string;
  country: string;
  category: string | null;
  funnel: { visible: number; discovered: number; total: number };
  evidence_label: string;
  gap_engine: GapEngineSummary;
  gap_engine_scan_ms: number;
  coverage: {
    summary: CoverageSummary;
    top_priority_provinces: readonly CoveragePriorityRow[];
    registry_stats: { provinces_seeded: number; island_groups: readonly string[]; coverage_states: readonly string[]; allowed_transitions_count: number };
  };
  agent_heartbeat: AgentHeartbeat;
  governance_gateway: {
    note: string;
    external_calls_this_request: number;
    canonical_reads_this_request: number;
    canonical_writes_this_request: number;
  };
  trace: {
    source: string;
    adapter: string;
    visibility_gate: string;
    marketing_claim_funnel_note: string;
    no_fabrication: boolean;
    no_llm_used: boolean;
    found_matches_reality: boolean;
  };
  latency_ms: number;
  landscape_cards: LandscapeCard[];
  postings: Posting[];
  error?: string;
  message?: string;
}

async function loadLiveProof(): Promise<LiveProofResponse | null> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3008";
  const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/api/nex/accommodation/live-proof?city=Yogyakarta&country=ID&limit=10`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ...(body as any), error: `live-proof API ${res.status}`, found: 0, landscape_cards: [], postings: [] };
    }
    return (await res.json()) as LiveProofResponse;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// LANDSCAPE CARD (§21 · 16:9 · image left · verified facts right)
// ═══════════════════════════════════════════════════════════════════

function LandscapeCardView({ card }: { card: LandscapeCard }): React.ReactElement {
  const hasImage = !!card.hero_image_url;
  const hasCoords = card.latitude != null && card.longitude != null;
  return (
    <article style={{
      background: "#111827",
      border: "1px solid #1F2937",
      borderRadius: 12,
      overflow: "hidden",
      display: "grid",
      gridTemplateColumns: "minmax(220px, 40%) 1fr",
      minHeight: 180,
      gap: 0,
    }}>
      <div style={{
        background: hasImage
          ? `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%), url("${card.hero_image_url}") center/cover no-repeat #0A0A0B`
          : "#0A0A0B",
        position: "relative",
        borderRight: "1px solid #1F2937",
      }}>
        {!hasImage && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", height: "100%", color: "#6B7280", fontSize: 13,
            padding: 16, textAlign: "center", lineHeight: 1.5,
          }}>
            IMAGE_UNAVAILABLE<br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>§11 · never fabricated</span>
          </div>
        )}
        {hasImage && card.star_rating != null && (
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(0,0,0,0.7)", color: "#FCD34D",
            padding: "3px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
          }}>
            {"★".repeat(Math.round(card.star_rating))}
          </div>
        )}
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#E5E7EB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.hotel_name}
          </h3>
          <p style={{ margin: "4px 0 8px", fontSize: 12, color: "#9CA3AF" }}>
            {card.location_label} · <span style={{ textTransform: "capitalize" }}>{card.property_type}</span>
          </p>
          {card.useful_facts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {card.useful_facts.map((f) => (
                <span key={f} style={{
                  fontSize: 11, background: "#1F2937", color: "#D1D5DB",
                  padding: "3px 8px", borderRadius: 4, border: "1px solid #374151",
                }}>{f}</span>
              ))}
            </div>
          )}
          {card.amenities_top.length > 0 && (
            <p style={{ margin: 0, fontSize: 11, color: "#6B7280", lineHeight: 1.5 }}>
              {card.amenities_top.join(" · ")}
            </p>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#6B7280", marginTop: 10, display: "flex", gap: 8 }}>
          <span>ID: {card.posting_id}</span>
          <span>·</span>
          <span>{hasCoords ? "GEO ✓" : "GEO ✗"}</span>
          <span>·</span>
          <span>[{card.evidence_label}]</span>
        </div>
      </div>
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════
// POSTING ROW (§23 · 10 real postings · compact)
// ═══════════════════════════════════════════════════════════════════

function PostingRow({ p, idx }: { p: Posting; idx: number }): React.ReactElement {
  const badges: string[] = [];
  if (p.star_rating != null) badges.push(`${p.star_rating}★`);
  if (p.room_count != null) badges.push(`${p.room_count} rooms`);
  if (p.amenity_count > 0) badges.push(`${p.amenity_count} amenities`);
  if (p.has_website) badges.push("web");
  if (p.has_phone) badges.push("phone");
  return (
    <tr style={{ borderTop: "1px solid #1F2937" }}>
      <td style={{ padding: "8px 12px", fontSize: 12, color: "#6B7280", verticalAlign: "top", width: 24 }}>{idx + 1}</td>
      <td style={{ padding: "8px 12px", fontSize: 13, color: "#E5E7EB", fontWeight: 500 }}>
        {p.hotel_name}
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
          {[p.district, p.city].filter(Boolean).join(" · ")}
        </div>
      </td>
      <td style={{ padding: "8px 12px", fontSize: 11, color: "#9CA3AF", textTransform: "capitalize" }}>{p.category}</td>
      <td style={{ padding: "8px 12px", fontSize: 11, color: "#9CA3AF" }}>{p.claim_status}</td>
      <td style={{ padding: "8px 12px", fontSize: 11, color: "#D1D5DB" }}>
        {badges.length > 0 ? badges.join(" · ") : <span style={{ color: "#6B7280" }}>UNKNOWN</span>}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 10, color: "#6B7280" }}>{p.posting_id}</td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════

export default async function AccommodationHeadquartersPage(): Promise<React.ReactElement> {
  const data = await loadLiveProof();

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0A0A0B",
      color: "#E5E7EB",
      padding: "32px 24px",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <header style={{ maxWidth: 1400, margin: "0 auto 24px" }}>
        <a href="/header-off" style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>← NEX Headquarters</a>
        <h1 style={{ fontSize: 32, margin: "8px 0 0", letterSpacing: -0.5, fontWeight: 700 }}>
          Accommodation · Live Proof
        </h1>
        <p style={{ color: "#9CA3AF", marginTop: 8, marginBottom: 0, fontSize: 13 }}>
          Founder §21-§23 · 3 landscape cards + 10 postings · every value MEASURED from nex.accommodation_business · zero fabrication · zero LLM
        </p>
      </header>

      {data === null ? (
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: 16, background: "#111827", borderRadius: 8, color: "#F59E0B" }}>
          Live proof API unreachable. Check: <code style={{ background: "#000", padding: "2px 6px", borderRadius: 4 }}>/api/nex/accommodation/live-proof</code>
        </div>
      ) : data.error ? (
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: 16, background: "#111827", borderRadius: 8, color: "#EF4444" }}>
          <strong>API error:</strong> {data.error} — {data.message ?? ""}
        </div>
      ) : (
        <>
          {/* §22 · Found N strip · real count · never static */}
          <div style={{ maxWidth: 1400, margin: "0 auto 24px", padding: 16, background: "#111827", borderRadius: 8, border: "1px solid #1F2937" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#10B981" }}>Found {data.found}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>real accommodation results</div>
              </div>
              <div>
                <div style={{ fontSize: 20, color: "#E5E7EB" }}>{data.city} · {data.country}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>query location</div>
              </div>
              <div>
                <div style={{ fontSize: 20, color: "#E5E7EB" }}>{data.funnel.visible}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>visible (claim gate)</div>
              </div>
              <div>
                <div style={{ fontSize: 20, color: "#9CA3AF" }}>{data.funnel.discovered}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>discovered (pending admin)</div>
              </div>
              <div>
                <div style={{ fontSize: 20, color: "#9CA3AF" }}>{data.funnel.total}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>total in canonical</div>
              </div>
              <div>
                <div style={{ fontSize: 20, color: "#E5E7EB" }}>{data.latency_ms}ms</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>end-to-end</div>
              </div>
              <div>
                <div style={{ fontSize: 14, color: "#10B981" }}>
                  {data.trace.no_llm_used ? "no LLM" : "LLM used"} · {data.trace.no_fabrication ? "no fabrication" : "!!"}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>evidence gate</div>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 10, color: "#6B7280", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
              {data.found_denominator_note}
            </div>
          </div>

          {/* §21 · 3 landscape hotel cards */}
          <section style={{ maxWidth: 1400, margin: "0 auto 32px" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#E5E7EB" }}>
              §21 · 3 landscape hotel cards
              <span style={{ fontSize: 12, fontWeight: 400, color: "#6B7280", marginLeft: 12 }}>
                showing {data.landscape_cards.length} (real records · sorted by verified-fact density)
              </span>
            </h2>
            {data.landscape_cards.length === 0 ? (
              <div style={{ padding: 16, background: "#111827", borderRadius: 8, color: "#9CA3AF", fontSize: 13 }}>
                No landscape cards available for this query.
                <div style={{ fontSize: 11, marginTop: 4, color: "#6B7280" }}>
                  §23 · honestly reported · no fabrication used to fill slots
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {data.landscape_cards.map((c) => <LandscapeCardView key={c.posting_id} card={c} />)}
              </div>
            )}
          </section>

          {/* §23 · 10 real postings */}
          <section style={{ maxWidth: 1400, margin: "0 auto 32px" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#E5E7EB" }}>
              §23 · 10-posting test
              <span style={{ fontSize: 12, fontWeight: 400, color: "#6B7280", marginLeft: 12 }}>
                returned {data.postings.length} of {data.requested_limit} requested (real records only)
              </span>
            </h2>
            {data.postings.length === 0 ? (
              <div style={{ padding: 16, background: "#111827", borderRadius: 8, color: "#9CA3AF" }}>No postings for this query.</div>
            ) : (
              <div style={{ background: "#111827", borderRadius: 8, border: "1px solid #1F2937", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#0A0A0B" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>#</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Property</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Category</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Claim</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Verified facts</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.postings.map((p, i) => <PostingRow key={p.posting_id} p={p} idx={i} />)}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* §29 · Agent heartbeat · REAL activity signal (never fake pulse) */}
          <section style={{ maxWidth: 1400, margin: "0 auto 24px" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#E5E7EB" }}>
              §29 · Agent activity
              <span style={{ fontSize: 12, fontWeight: 400, color: "#6B7280", marginLeft: 12 }}>
                real heartbeat · read from data/nex-agent-runtime/heartbeat-accommodation.json · never simulated
              </span>
            </h2>
            <div style={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 8, padding: 16, display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{
                  display: "inline-block", width: 14, height: 14, borderRadius: "50%",
                  background: data.agent_heartbeat.status_verdict === "ACTIVE" ? "#10B981"
                            : data.agent_heartbeat.status_verdict === "DEGRADED" ? "#F59E0B"
                            : data.agent_heartbeat.status_verdict === "STOPPED" ? "#EF4444"
                            : "#9CA3AF",
                  boxShadow: data.agent_heartbeat.status_verdict === "ACTIVE" ? "0 0 12px rgba(16,185,129,0.6)" : "none",
                  animation: data.agent_heartbeat.status_verdict === "ACTIVE" ? "hb 2s ease-in-out infinite" : "none",
                }} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#E5E7EB" }}>
                    {data.agent_heartbeat.status_verdict === "ACTIVE" ? "🟢 ACTIVE" : data.agent_heartbeat.status_verdict === "DEGRADED" ? "🟡 DEGRADED" : data.agent_heartbeat.status_verdict === "STOPPED" ? "🔴 STOPPED" : "⚪ UNKNOWN"}
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>Accommodation worker · verdict from heartbeat freshness</div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 12, color: "#D1D5DB" }}>
                <div><span style={{ color: "#6B7280" }}>PID:</span> {data.agent_heartbeat.process_id ?? "—"}</div>
                <div><span style={{ color: "#6B7280" }}>Task:</span> {data.agent_heartbeat.current_task ?? "—"}</div>
                <div><span style={{ color: "#6B7280" }}>Heartbeat age:</span> {data.agent_heartbeat.heartbeat_age_seconds != null ? `${data.agent_heartbeat.heartbeat_age_seconds}s` : "UNKNOWN"}</div>
                <div><span style={{ color: "#6B7280" }}>Internet:</span> {data.agent_heartbeat.internet_state}</div>
                <div><span style={{ color: "#6B7280" }}>Last success:</span> {data.agent_heartbeat.last_success_iso ?? "—"}</div>
              </div>
            </div>
            <style>{`@keyframes hb { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.7; transform: scale(1.15) } }`}</style>
          </section>

          {/* §3-§4 · Indonesia coverage state · REAL (from seed queue) */}
          <section style={{ maxWidth: 1400, margin: "0 auto 24px" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#E5E7EB" }}>
              §3-§4 · Indonesia coverage
              <span style={{ fontSize: 12, fontWeight: 400, color: "#6B7280", marginLeft: 12 }}>
                {data.coverage.summary.provinces_total} provinces · state machine (never fabricates NO_ACCOMMODATION)
              </span>
            </h2>
            <div style={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 16 }}>
                <div><div style={{ fontSize: 20, color: "#E5E7EB" }}>{data.coverage.summary.provinces_total}</div><div style={{ fontSize: 11, color: "#6B7280" }}>total</div></div>
                <div><div style={{ fontSize: 20, color: "#F59E0B" }}>{data.coverage.summary.provinces_not_started}</div><div style={{ fontSize: 11, color: "#6B7280" }}>NOT_STARTED</div></div>
                <div><div style={{ fontSize: 20, color: "#3B82F6" }}>{data.coverage.summary.provinces_partially_covered}</div><div style={{ fontSize: 11, color: "#6B7280" }}>PARTIALLY_COVERED</div></div>
                <div><div style={{ fontSize: 20, color: "#10B981" }}>{data.coverage.summary.provinces_covered}</div><div style={{ fontSize: 11, color: "#6B7280" }}>COVERED</div></div>
                <div><div style={{ fontSize: 20, color: "#EF4444" }}>{data.coverage.summary.provinces_source_unavailable}</div><div style={{ fontSize: 11, color: "#6B7280" }}>SOURCE_UNAVAILABLE</div></div>
                <div><div style={{ fontSize: 20, color: "#E5E7EB" }}>{data.coverage.summary.attempted_units}</div><div style={{ fontSize: 11, color: "#6B7280" }}>attempted</div></div>
                <div><div style={{ fontSize: 20, color: "#E5E7EB" }}>{data.coverage.summary.properties_measured_total.toLocaleString()}</div><div style={{ fontSize: 11, color: "#6B7280" }}>properties measured</div></div>
              </div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 12 }}>{data.coverage.summary.attempted_units_denominator_note}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>Province</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>Island</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>State</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>Rows</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>Tourism</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coverage.top_priority_provinces.map((u) => (
                    <tr key={u.unit_slug} style={{ borderBottom: "1px solid #0F172A" }}>
                      <td style={{ padding: "6px 8px", fontSize: 12, color: "#E5E7EB" }}>{u.display_name}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "#9CA3AF" }}>{u.island_group ?? "—"}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: u.state === "PARTIALLY_COVERED" ? "#3B82F6" : u.state === "COVERED" ? "#10B981" : "#F59E0B" }}>{u.state}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "#D1D5DB", textAlign: "right" }}>{u.property_count_measured.toLocaleString()}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "#D1D5DB", textAlign: "right" }}>{(u.tourism_evidence_strength * 100).toFixed(0)}%</td>
                      <td style={{ padding: "6px 8px", fontSize: 11, color: "#D1D5DB", textAlign: "right" }}>{u.next_research_priority.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 10, color: "#6B7280", marginTop: 10 }}>
                Registry: {data.coverage.registry_stats.provinces_seeded} provinces seeded · {data.coverage.registry_stats.coverage_states.length} states · {data.coverage.registry_stats.allowed_transitions_count} allowed transitions
              </div>
            </div>
          </section>

          {/* §5-§7 · Gap Engine · REAL run over existing records (Founder discipline: gap-engine BEFORE any new collection) */}
          <section style={{ maxWidth: 1400, margin: "0 auto 24px" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#E5E7EB" }}>
              §5-§7 · Gap Engine · run over existing records
              <span style={{ fontSize: 12, fontWeight: 400, color: "#6B7280", marginLeft: 12 }}>
                {data.gap_engine.scanned_rows.toLocaleString()} rows scanned in {data.gap_engine_scan_ms}ms · {data.gap_engine.total_gaps_detected.toLocaleString()} gaps detected · zero new collection this pass
              </span>
            </h2>
            <div style={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 16 }}>
                <div><div style={{ fontSize: 24, color: "#E5E7EB", fontWeight: 700 }}>{data.gap_engine.scanned_rows.toLocaleString()}</div><div style={{ fontSize: 11, color: "#6B7280" }}>records scanned</div></div>
                <div><div style={{ fontSize: 24, color: "#F59E0B", fontWeight: 700 }}>{data.gap_engine.total_gaps_detected.toLocaleString()}</div><div style={{ fontSize: 11, color: "#6B7280" }}>gaps detected</div></div>
                <div><div style={{ fontSize: 24, color: "#E5E7EB" }}>{data.gap_engine.gap_kinds_enum_size}</div><div style={{ fontSize: 11, color: "#6B7280" }}>gap kinds available</div></div>
                <div><div style={{ fontSize: 24, color: "#E5E7EB" }}>{data.gap_engine_scan_ms}ms</div><div style={{ fontSize: 11, color: "#6B7280" }}>engine scan time</div></div>
                <div><div style={{ fontSize: 24, color: "#10B981" }}>{(data.gap_engine.total_gaps_detected / Math.max(data.gap_engine.scanned_rows, 1)).toFixed(1)}</div><div style={{ fontSize: 11, color: "#6B7280" }}>avg gaps / record</div></div>
              </div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 12 }}>{data.gap_engine.scanned_rows_denominator_note}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>#</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>Gap kind</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>Count</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>% of rows</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #1F2937" }}>Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gap_engine.top_gap_kinds.map((g, i) => {
                    const pct = data.gap_engine.scanned_rows > 0 ? (g.count / data.gap_engine.scanned_rows) * 100 : 0;
                    return (
                      <tr key={g.kind} style={{ borderBottom: "1px solid #0F172A" }}>
                        <td style={{ padding: "6px 8px", fontSize: 11, color: "#6B7280" }}>{i + 1}</td>
                        <td style={{ padding: "6px 8px", fontSize: 12, color: "#E5E7EB", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{g.kind}</td>
                        <td style={{ padding: "6px 8px", fontSize: 12, color: "#D1D5DB", textAlign: "right" }}>{g.count.toLocaleString()}</td>
                        <td style={{ padding: "6px 8px", fontSize: 11, color: "#9CA3AF", textAlign: "right" }}>{pct.toFixed(1)}%</td>
                        <td style={{ padding: "6px 8px", width: 240 }}>
                          <div style={{ background: "#0F172A", height: 6, borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: pct > 80 ? "#F59E0B" : pct > 50 ? "#3B82F6" : "#10B981" }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Governance gateway (documented · not activated) */}
          <section style={{ maxWidth: 1400, margin: "0 auto 24px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px", color: "#9CA3AF" }}>§13-§15 · Governed research/acquisition gateway (this request)</h2>
            <div style={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 8 }}>
                <div><div style={{ fontSize: 18, color: "#10B981" }}>{data.governance_gateway.external_calls_this_request}</div><div style={{ fontSize: 11, color: "#6B7280" }}>external scraping calls</div></div>
                <div><div style={{ fontSize: 18, color: "#E5E7EB" }}>{data.governance_gateway.canonical_reads_this_request}</div><div style={{ fontSize: 11, color: "#6B7280" }}>canonical Postgres reads</div></div>
                <div><div style={{ fontSize: 18, color: "#E5E7EB" }}>{data.governance_gateway.canonical_writes_this_request}</div><div style={{ fontSize: 11, color: "#6B7280" }}>canonical Postgres writes</div></div>
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.5 }}>{data.governance_gateway.note}</div>
            </div>
          </section>

          {/* §29 · trace strip */}
          <section style={{ maxWidth: 1400, margin: "0 auto 32px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px", color: "#9CA3AF" }}>§29 · Trace (auditable)</h2>
            <pre style={{
              background: "#111827",
              border: "1px solid #1F2937",
              borderRadius: 8,
              padding: 16,
              fontSize: 11,
              lineHeight: 1.6,
              color: "#9CA3AF",
              overflow: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}>
{`source                  : ${data.trace.source}
adapter                 : ${data.trace.adapter}
visibility_gate         : ${data.trace.visibility_gate}
claim_funnel            : ${data.trace.marketing_claim_funnel_note}
no_fabrication          : ${data.trace.no_fabrication}
no_llm_used             : ${data.trace.no_llm_used}
evidence_label          : ${data.evidence_label}
latency_ms              : ${data.latency_ms}
found                   : ${data.found}
requested_limit         : ${data.requested_limit}
landscape_shown         : ${data.landscape_card_count}
funnel_visible          : ${data.funnel.visible}
funnel_discovered       : ${data.funnel.discovered}
funnel_total            : ${data.funnel.total}
gap_engine_rows_scanned : ${data.gap_engine.scanned_rows}
gap_engine_total_gaps   : ${data.gap_engine.total_gaps_detected}
gap_engine_scan_ms      : ${data.gap_engine_scan_ms}
coverage_provinces      : ${data.coverage.summary.provinces_total}
coverage_not_started    : ${data.coverage.summary.provinces_not_started}
coverage_partial        : ${data.coverage.summary.provinces_partially_covered}
agent_heartbeat_verdict : ${data.agent_heartbeat.status_verdict}
agent_heartbeat_age_s   : ${data.agent_heartbeat.heartbeat_age_seconds ?? "UNKNOWN"}
agent_internet_state    : ${data.agent_heartbeat.internet_state}
external_scraping_calls : ${data.governance_gateway.external_calls_this_request}`}
            </pre>
          </section>
        </>
      )}
    </main>
  );
}
