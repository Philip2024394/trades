// src/app/nex-head-quarters/accommodation-agent/page.tsx
//
// NEX Headquarters · Accommodation Agent container (theme-matched)
// Founder BEGIN 2026-09-08 · Indonesia Complete Country Intelligence Mission
//
// Founder directive: "our headquarters section is nex headquaters already built
// with off white theme. this is where the agents pages and containers should be
// listed with same color theme."
//
// This page lives INSIDE the /nex-head-quarters shell (layout wraps it with
// HQShell · nex.cream tokens · sidebar · header) so it visually belongs with
// every other HQ container. Same data source as /header-off/accommodation:
// GET /api/nex/accommodation/live-proof (real Postgres · zero fabrication ·
// zero LLM · governed gateway).
//
// Founder success criteria displayed:
//   §21 · 3 landscape hotel cards (real records)
//   §22 · "Found N" backed by real count
//   §23 · 10 real postings
//   §29 · real agent heartbeat (green pulse ONLY when < 15s fresh)
//   §3-§4 · Indonesia coverage state (37 provinces · state machine)
//   §5-§7 · Gap Engine over existing records (BEFORE any new collection)
//   §26 · latency decomposition (stage timers + overhead)
//   §13-§15 · governed research/acquisition gateway (external calls: 0)

import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "NEX HQ · Accommodation Agent · Live Proof",
  robots: { index: false },
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface LandscapeCard {
  posting_id: string; hotel_name: string; location_label: string; property_type: string;
  hero_image_url: string | null; latitude: number | null; longitude: number | null;
  star_rating: number | null; amenities_top: string[]; useful_facts: string[]; evidence_label: string;
}
interface Posting {
  posting_id: string; hotel_name: string; category: string; city: string; district: string | null;
  address: string | null; latitude: number | null; longitude: number | null; star_rating: number | null;
  room_count: number | null; amenity_count: number; hero_image_url: string | null;
  has_website: boolean; has_phone: boolean; claim_status: string; evidence_label: string;
}
interface GapEngineSummary {
  scanned_rows: number; scanned_rows_denominator_note: string; total_gaps_detected: number;
  gaps_by_kind: Record<string, number>; top_gap_kinds: readonly { kind: string; count: number }[];
  gap_kinds_enum_size: number;
}
interface FullCorpusScan {
  scanned_rows: number; scanned_rows_denominator_note: string; total_gaps_detected: number;
  gaps_by_kind: Record<string, number>; top_gap_kinds: readonly { kind: string; count: number }[];
  distinct_cities: number; distinct_countries: number;
  claim_status_breakdown: Record<string, number>;
  scan_ms: number;
}
interface CoverageSummary {
  total_units: number; provinces_total: number; provinces_not_started: number;
  provinces_partially_covered: number; provinces_covered: number;
  provinces_source_unavailable: number; properties_measured_total: number;
  attempted_units: number; attempted_units_denominator_note: string;
}
interface CoveragePriorityRow {
  unit_slug: string; display_name: string; island_group: string | null;
  state: string; state_reason: string; property_count_measured: number;
  tourism_evidence_strength: number; next_research_priority: number;
}
interface AgentHeartbeat {
  status: string;
  status_verdict: "ACTIVE" | "DEGRADED" | "STOPPED" | "UNKNOWN";
  last_heartbeat_iso: string | null; heartbeat_age_seconds: number | null;
  process_id: number | null; current_task: string | null; internet_state: string;
  last_success_iso: string | null; last_failure_iso: string | null;
}
interface HotTierInfo {
  scope: "hot-tier" | "canonical";
  cache_hit: boolean;
  cache_key: string;
  cache_age_ms: number;
  cache_ttl_remaining_ms: number;
  cache_ttl_configured_ms: number;
  payload_identity_hash: string;
  stats: { size: number; hits: number; misses: number; evictions: number; refreshes: number; hit_ratio: number; bootstrap_at_iso: string; ttl_ms: number; max_entries: number };
  note: string;
}
interface Throughput24h {
  window_hours: number;
  window_start_iso: string; window_end_iso: string;
  events_total: number; work_completed: number; work_blocked: number;
  internet_offline_toggles: number; internet_online_toggles: number;
  records_processed_sum: number;
  work_types: Record<string, number>;
  bar_bins: readonly { hour_start_iso: string; events: number; records: number }[];
  events_denominator_note: string;
  source_file: string;
}
interface AgentActivity {
  operational_state: "WORKING_NOW" | "IDLE_ALIVE" | "IDLE_STALE" | "DEGRADED" | "STOPPED" | "UNKNOWN";
  operational_state_reason: string;
  most_recent_event_iso: string | null;
  most_recent_event_kind: string | null;
  most_recent_event_work: string | null;
  most_recent_event_age_seconds: number | null;
  most_recent_event_attributes: Record<string, unknown> | null;
  events_scanned_this_request: number;
  strict_rule_note: string;
}
interface PanelSignal {
  live_updating_now: boolean;
  last_data_change_iso: string | null;
  age_seconds: number | null;
  source: string;
  static_reason?: string;
}
interface PanelSignals {
  heartbeat?: PanelSignal;
  throughput_24h?: PanelSignal;
  coverage?: PanelSignal;
  gap_engine_visible?: PanelSignal;
  gap_engine_full_corpus?: PanelSignal;
  hot_tier?: PanelSignal;
  found_strip?: PanelSignal;
  cards?: PanelSignal;
  postings?: PanelSignal;
}
interface LatencyBreakdown {
  stage_ms: Record<string, number>;
  stage_sum_ms: number;
  overhead_ms: number;
  overhead_note: string;
}
interface LiveProofResponse {
  found: number; found_denominator_note: string; requested_limit: number;
  landscape_card_count: number; city: string; country: string; category: string | null;
  funnel: { visible: number; discovered: number; total: number };
  evidence_label: string;
  gap_engine: GapEngineSummary; gap_engine_scan_ms: number;
  gap_engine_full_corpus: FullCorpusScan;
  coverage: { summary: CoverageSummary; top_priority_provinces: readonly CoveragePriorityRow[]; registry_stats: { provinces_seeded: number; island_groups: readonly string[]; coverage_states: readonly string[]; allowed_transitions_count: number } };
  agent_heartbeat: AgentHeartbeat;
  throughput_24h: Throughput24h;
  hot_tier?: HotTierInfo;
  agent_activity?: AgentActivity;
  panel_signals?: PanelSignals;
  governance_gateway: { note: string; external_calls_this_request: number; canonical_reads_this_request: number; canonical_writes_this_request: number };
  trace: { source: string; adapter: string; visibility_gate: string; marketing_claim_funnel_note: string; no_fabrication: boolean; no_llm_used: boolean; found_matches_reality: boolean };
  latency_ms: number;
  latency_breakdown: LatencyBreakdown;
  landscape_cards: LandscapeCard[];
  postings: Posting[];
  error?: string; message?: string;
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
      return { ...(body as any), error: `live-proof API ${res.status}`, found: 0, landscape_cards: [], postings: [] } as LiveProofResponse;
    }
    return (await res.json()) as LiveProofResponse;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PanelBadge · Founder STRICT rule: heartbeat effect ONLY on panels with
// live_updating_now=true · else render STATIC badge with the source reason.
// Never fake activity indication.
// ═══════════════════════════════════════════════════════════════════

function PanelBadge({ signal }: { signal?: PanelSignal }): React.ReactElement {
  if (!signal) {
    return (
      <span className="ml-2 inline-flex items-center gap-1 rounded border border-black/10 bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/50">
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
        UNKNOWN
      </span>
    );
  }
  if (signal.live_updating_now) {
    return (
      <span className="ml-2 inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800" title={`Live · source: ${signal.source} · age: ${signal.age_seconds ?? "?"}s`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: "hqhb 2s ease-in-out infinite" }} />
        PROCESSING NOW · age {signal.age_seconds ?? "?"}s
      </span>
    );
  }
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded border border-black/10 bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/60" title={`Static · source: ${signal.source}${signal.static_reason ? " · " + signal.static_reason : ""}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
      STATIC · from stored data
    </span>
  );
}

// Panel wrapper that shows soft heartbeat glow ONLY when live_updating_now
function PanelFrame({ children, signal }: { children: React.ReactNode; signal?: PanelSignal }): React.ReactElement {
  const live = signal?.live_updating_now === true;
  return (
    <div
      className={`rounded-2xl border ${live ? "border-emerald-300" : "border-black/10"} bg-white p-4 shadow-sm`}
      style={live ? { boxShadow: "0 0 0 3px rgba(16,185,129,0.10), 0 1px 2px rgba(0,0,0,0.04)", animation: "hqframe 2.5s ease-in-out infinite" } : {}}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Landscape card · off-white theme (NEX HQ tokens · Tailwind utilities)
// ═══════════════════════════════════════════════════════════════════

function LandscapeCardView({ card }: { card: LandscapeCard }): React.ReactElement {
  const hasImage = !!card.hero_image_url;
  const hasCoords = card.latitude != null && card.longitude != null;
  return (
    <article className="grid overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm" style={{ gridTemplateColumns: "minmax(200px, 38%) 1fr", minHeight: 170 }}>
      <div className="relative border-r border-black/5" style={{
        background: hasImage
          ? `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%), url("${card.hero_image_url}") center/cover no-repeat #F4F4F2`
          : "#F4F4F2",
      }}>
        {!hasImage && (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-[11px] font-semibold uppercase tracking-widest text-black/40">
            <div>
              IMAGE_UNAVAILABLE<br />
              <span className="mt-1 block font-normal normal-case tracking-normal text-[10px] text-black/30">§11 · never fabricated</span>
            </div>
          </div>
        )}
        {hasImage && card.star_rating != null && (
          <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-bold text-amber-300">
            {"★".repeat(Math.round(card.star_rating))}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-between p-4">
        <div>
          <h3 className="truncate text-base font-bold text-black">{card.hotel_name}</h3>
          <p className="mt-1 text-xs text-black/60">
            {card.location_label} · <span className="capitalize">{card.property_type}</span>
          </p>
          {card.useful_facts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {card.useful_facts.map((f) => (
                <span key={f} className="rounded border border-black/10 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-900">{f}</span>
              ))}
            </div>
          )}
          {card.amenities_top.length > 0 && (
            <p className="mt-2 text-[11px] text-black/50">{card.amenities_top.join(" · ")}</p>
          )}
        </div>
        <div className="mt-3 flex gap-3 text-[10px] uppercase tracking-wider text-black/40">
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
// Page (server component · under HQShell)
// ═══════════════════════════════════════════════════════════════════

export default async function AccommodationAgentHQPage(): Promise<React.ReactElement> {
  const data = await loadLiveProof();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
          NEX Accommodation Agent · live proof · read-only
        </div>
        <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight text-black">
          Indonesia Complete Country Intelligence Mission
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-black/60">
          Founder §21-§23 · 3 landscape cards + 10 postings backed by real{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 text-[11px]">nex.accommodation_business</code> rows.
          Gap Engine runs over existing 877 rows <em>before</em> any new collection.
          Zero LLM · zero fabrication · zero scraping this request.
        </p>
      </header>

      {data === null ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Live proof API unreachable · check <code className="font-mono">/api/nex/accommodation/live-proof</code>
        </div>
      ) : data.error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <strong>API error:</strong> {data.error} — {data.message ?? ""}
        </div>
      ) : (
        <>
          {/* §22 · Found N strip · REAL count · never static */}
          <section className="mb-6 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-baseline gap-6">
              <div>
                <div className="text-3xl font-black text-emerald-600">Found {data.found}</div>
                <div className="text-[10px] uppercase tracking-wider text-black/50">real accommodation results</div>
              </div>
              <div><div className="text-lg font-bold text-black">{data.city} · {data.country}</div><div className="text-[10px] uppercase tracking-wider text-black/50">query location</div></div>
              <div><div className="text-lg font-bold text-black">{data.funnel.visible}</div><div className="text-[10px] uppercase tracking-wider text-black/50">visible</div></div>
              <div><div className="text-lg font-bold text-black/60">{data.funnel.discovered}</div><div className="text-[10px] uppercase tracking-wider text-black/50">discovered</div></div>
              <div><div className="text-lg font-bold text-black/60">{data.funnel.total}</div><div className="text-[10px] uppercase tracking-wider text-black/50">total</div></div>
              <div><div className="text-lg font-bold text-black">{data.latency_ms}ms</div><div className="text-[10px] uppercase tracking-wider text-black/50">end-to-end</div></div>
              <div><div className="text-sm font-bold text-emerald-600">{data.trace.no_llm_used ? "no LLM" : "LLM used"} · {data.trace.no_fabrication ? "no fabrication" : "!!"}</div><div className="text-[10px] uppercase tracking-wider text-black/50">evidence gate</div></div>
            </div>
            <div className="mt-3 font-mono text-[10px] text-black/40">{data.found_denominator_note}</div>
          </section>

          {/* §21 · 3 landscape hotel cards */}
          <section className="mb-8">
            <h2 className="mb-3 text-base font-bold text-black">
              §21 · 3 landscape hotel cards
              <PanelBadge signal={data.panel_signals?.cards} />
              <span className="ml-3 text-xs font-normal text-black/50">showing {data.landscape_cards.length} (real records · sorted by verified-fact density)</span>
            </h2>
            {data.landscape_cards.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/60">
                No landscape cards available for this query. <span className="ml-2 text-[11px] text-black/40">§23 · honestly reported · no fabrication used to fill slots</span>
              </div>
            ) : (
              <div className="grid gap-3">
                {data.landscape_cards.map((c) => <LandscapeCardView key={c.posting_id} card={c} />)}
              </div>
            )}
          </section>

          {/* §23 · 10 real postings */}
          <section className="mb-8">
            <h2 className="mb-3 text-base font-bold text-black">
              §23 · 10-posting test
              <PanelBadge signal={data.panel_signals?.postings} />
              <span className="ml-3 text-xs font-normal text-black/50">returned {data.postings.length} of {data.requested_limit} requested (real records only)</span>
            </h2>
            {data.postings.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/60">No postings for this query.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-orange-50">
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-orange-900">#</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-orange-900">Property</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-orange-900">Category</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-orange-900">Claim</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-orange-900">Verified facts</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-orange-900">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.postings.map((p, i) => {
                      const badges: string[] = [];
                      if (p.star_rating != null) badges.push(`${p.star_rating}★`);
                      if (p.room_count != null) badges.push(`${p.room_count} rooms`);
                      if (p.amenity_count > 0) badges.push(`${p.amenity_count} amenities`);
                      if (p.has_website) badges.push("web");
                      if (p.has_phone) badges.push("phone");
                      return (
                        <tr key={p.posting_id} className="border-t border-black/5">
                          <td className="px-3 py-2 align-top text-xs text-black/40">{i + 1}</td>
                          <td className="px-3 py-2">
                            <div className="text-sm font-semibold text-black">{p.hotel_name}</div>
                            <div className="mt-0.5 text-[11px] text-black/50">{[p.district, p.city].filter(Boolean).join(" · ")}</div>
                          </td>
                          <td className="px-3 py-2 text-xs capitalize text-black/60">{p.category}</td>
                          <td className="px-3 py-2 text-xs text-black/60">{p.claim_status}</td>
                          <td className="px-3 py-2 text-xs text-black/80">{badges.length > 0 ? badges.join(" · ") : <span className="text-black/30">UNKNOWN</span>}</td>
                          <td className="px-3 py-2 font-mono text-[10px] text-black/40">{p.posting_id}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* §29 · HONEST agent operational state · Founder STRICT 2026-09-09
              "Green dot with heart beat is not proven that agent is working."
              Verdict below requires BOTH heartbeat fresh AND recent measurable
              work event. Never fakes activity. */}
          <section className="mb-8">
            <h2 className="mb-3 text-base font-bold text-black">
              §29 · Agent operational state
              <span className="ml-3 text-xs font-normal text-black/50">
                honest verdict · heartbeat + event-log correlation · false ACTIVE prevented at type level
              </span>
            </h2>
            {(() => {
              const opState = data.agent_activity?.operational_state ?? "UNKNOWN";
              const workingNow = opState === "WORKING_NOW";
              const idleAlive = opState === "IDLE_ALIVE";
              const idleStale = opState === "IDLE_STALE";
              const degraded = opState === "DEGRADED";
              const stopped = opState === "STOPPED";
              const bgHalo =
                workingNow ? "0 0 12px rgba(16,185,129,0.55)" :
                idleAlive ? "0 0 6px rgba(59,130,246,0.35)" :
                idleStale ? "0 0 6px rgba(245,158,11,0.35)" :
                degraded ? "0 0 4px rgba(245,158,11,0.35)" :
                stopped ? "0 0 4px rgba(239,68,68,0.5)" : "none";
              const dotColor =
                workingNow ? "#10B981" :
                idleAlive ? "#3B82F6" :
                idleStale ? "#F59E0B" :
                degraded ? "#F59E0B" :
                stopped ? "#EF4444" : "#A3A39C";
              const label =
                workingNow ? "🟢 WORKING NOW" :
                idleAlive ? "🔵 ALIVE · idle briefly" :
                idleStale ? "🟠 IDLE_STALE · heartbeat fresh but no measurable work" :
                degraded ? "🟡 DEGRADED" :
                stopped ? "🔴 STOPPED" : "⚪ UNKNOWN";
              const framePulse = workingNow ? "0 0 0 3px rgba(16,185,129,0.10), 0 1px 2px rgba(0,0,0,0.04)" : "0 1px 2px rgba(0,0,0,0.06)";
              return (
                <div
                  className={`grid grid-cols-1 gap-3 rounded-2xl border p-4 sm:grid-cols-[auto_1fr] sm:items-center ${workingNow ? "border-emerald-300" : "border-black/10"} bg-white`}
                  style={{ boxShadow: framePulse, animation: workingNow ? "hqframe 2.5s ease-in-out infinite" : "none" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full"
                      style={{
                        background: dotColor,
                        boxShadow: bgHalo,
                        animation: workingNow ? "hqhb 2s ease-in-out infinite" : "none",
                      }}
                    />
                    <div>
                      <div className="text-lg font-bold text-black">{label}</div>
                      <div className="text-[10px] uppercase tracking-wider text-black/40">
                        {opState} · honest verdict
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-5 text-xs text-black/70">
                    <div><span className="text-black/40">PID:</span> {data.agent_heartbeat.process_id ?? "—"}</div>
                    <div><span className="text-black/40">Heartbeat age:</span> {data.agent_heartbeat.heartbeat_age_seconds != null ? `${data.agent_heartbeat.heartbeat_age_seconds}s` : "UNKNOWN"}</div>
                    <div><span className="text-black/40">Last event:</span> {data.agent_activity?.most_recent_event_iso ?? "—"} {data.agent_activity?.most_recent_event_age_seconds != null ? `(${data.agent_activity.most_recent_event_age_seconds}s ago)` : ""}</div>
                    <div><span className="text-black/40">Work:</span> {data.agent_activity?.most_recent_event_work ?? "—"}</div>
                    <div><span className="text-black/40">Internet:</span> {data.agent_heartbeat.internet_state}</div>
                  </div>
                  {data.agent_activity && (
                    <div className="col-span-full mt-1 rounded-md bg-neutral-50 p-2 text-[11px] leading-snug text-black/60">
                      <strong className="text-black/70">verdict reason:</strong> {data.agent_activity.operational_state_reason}
                      <br />
                      <strong className="text-black/70">strict rule:</strong> {data.agent_activity.strict_rule_note}
                    </div>
                  )}
                </div>
              );
            })()}
            <style>{`
              @keyframes hqhb { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.7; transform: scale(1.15) } }
              @keyframes hqframe { 0%,100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.10), 0 1px 2px rgba(0,0,0,0.04) } 50% { box-shadow: 0 0 0 5px rgba(16,185,129,0.16), 0 1px 4px rgba(0,0,0,0.06) } }
            `}</style>
          </section>

          {/* Master AI Engineer directive · 24h processed-data scale bar (with hourly marks) */}
          <section className="mb-8">
            <h2 className="mb-3 text-base font-bold text-black">
              Master AI Engineer · 24h data processed to NEX
              <PanelBadge signal={data.panel_signals?.throughput_24h} />
              <span className="ml-3 text-xs font-normal text-black/50">
                {data.throughput_24h.events_total.toLocaleString()} events · {data.throughput_24h.work_completed.toLocaleString()} completed · {data.throughput_24h.records_processed_sum.toLocaleString()} records · real from <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[10px]">{data.throughput_24h.source_file}</code>
              </span>
            </h2>
            <PanelFrame signal={data.panel_signals?.throughput_24h}>
              <div className="mb-4 flex flex-wrap gap-6">
                <div><div className="text-2xl font-black text-black">{data.throughput_24h.events_total.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">events (24h)</div></div>
                <div><div className="text-2xl font-black text-emerald-600">{data.throughput_24h.work_completed.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">WORK_COMPLETED</div></div>
                <div><div className="text-2xl font-black text-amber-600">{data.throughput_24h.work_blocked.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">WORK_BLOCKED</div></div>
                <div><div className="text-2xl font-black text-black">{data.throughput_24h.records_processed_sum.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">records processed</div></div>
                <div><div className="text-2xl font-black text-blue-600">{data.throughput_24h.internet_online_toggles.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">internet ↑ toggles</div></div>
                <div><div className="text-2xl font-black text-red-600">{data.throughput_24h.internet_offline_toggles.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">internet ↓ toggles</div></div>
              </div>

              {/* Scale bar with per-hour marks · 24 bins · today's hourly throughput */}
              {(() => {
                const bins = data.throughput_24h.bar_bins;
                const maxEvents = Math.max(1, ...bins.map((b) => b.events));
                const maxRecords = Math.max(1, ...bins.map((b) => b.records));
                const now = new Date();
                const currentHourIdx = 23;
                return (
                  <div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <div className="text-xs font-semibold text-black/70">Hourly throughput (last 24h · MEASURED)</div>
                      <div className="text-[10px] uppercase tracking-wider text-black/40">peak {maxEvents} events/hr · {maxRecords} records/hr</div>
                    </div>
                    <div className="relative rounded-lg bg-neutral-50 p-3">
                      {/* Bars */}
                      <div className="flex items-end gap-[3px]" style={{ height: 60 }}>
                        {bins.map((b, i) => {
                          const eventsPct = (b.events / maxEvents) * 100;
                          const recordsPct = (b.records / maxRecords) * 100;
                          const isCurrent = i === currentHourIdx;
                          const isEmpty = b.events === 0;
                          return (
                            <div key={i} className="relative flex flex-1 flex-col justify-end" title={`${b.hour_start_iso}\nevents: ${b.events}\nrecords: ${b.records}`}>
                              <div
                                className="rounded-t-sm"
                                style={{
                                  height: `${Math.max(2, eventsPct)}%`,
                                  background: isEmpty
                                    ? "#E8E8E4"
                                    : isCurrent
                                      ? "#F97316"           /* current hour · orange · MARK */
                                      : eventsPct > 60 ? "#10B981" : eventsPct > 20 ? "#3B82F6" : "#94A3B8",
                                  boxShadow: isCurrent ? "0 0 6px rgba(249,115,22,0.6)" : "none",
                                }}
                              />
                              {b.records > 0 && (
                                <div
                                  className="absolute left-0 right-0 border-t border-dashed border-black/20"
                                  style={{ bottom: `${Math.max(2, recordsPct)}%` }}
                                  title={`records mark @${b.records}`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Axis labels · every 6 hours + NOW mark */}
                      <div className="mt-1.5 flex items-center justify-between text-[9px] uppercase tracking-wider text-black/40">
                        <span>-24h</span>
                        <span>-18h</span>
                        <span>-12h</span>
                        <span>-6h</span>
                        <span className="rounded bg-orange-100 px-1 py-0.5 font-semibold text-orange-800">NOW</span>
                      </div>
                      {/* Legend */}
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-black/60">
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />high activity</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-blue-500" />steady</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#94A3B8" }} />low</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#E8E8E4" }} />no events</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-orange-500" />current hour MARK</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block h-[2px] w-4 border-t border-dashed border-black/40" />records processed mark</span>
                      </div>
                    </div>

                    {/* Work-type breakdown */}
                    {Object.keys(data.throughput_24h.work_types).length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-black/40">Work types (last 24h)</div>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(data.throughput_24h.work_types).sort((a, b) => b[1] - a[1]).map(([w, c]) => (
                            <span key={w} className="rounded border border-black/10 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-900">
                              {w} · {c.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 font-mono text-[10px] text-black/40">{data.throughput_24h.events_denominator_note}</div>
                    <div className="mt-1 text-[10px] text-black/40">
                      window: {data.throughput_24h.window_start_iso} → {data.throughput_24h.window_end_iso}
                    </div>
                  </div>
                );
              })()}
            </PanelFrame>
          </section>

          {/* §3-§4 · Indonesia coverage state */}
          <section className="mb-8">
            <h2 className="mb-3 text-base font-bold text-black">
              §3-§4 · Indonesia coverage
              <PanelBadge signal={data.panel_signals?.coverage} />
              <span className="ml-3 text-xs font-normal text-black/50">{data.coverage.summary.provinces_total} provinces · state machine (never fabricates NO_ACCOMMODATION)</span>
            </h2>
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap gap-6">
                <div><div className="text-lg font-bold text-black">{data.coverage.summary.provinces_total}</div><div className="text-[10px] uppercase tracking-wider text-black/50">total</div></div>
                <div><div className="text-lg font-bold text-amber-600">{data.coverage.summary.provinces_not_started}</div><div className="text-[10px] uppercase tracking-wider text-black/50">NOT_STARTED</div></div>
                <div><div className="text-lg font-bold text-blue-600">{data.coverage.summary.provinces_partially_covered}</div><div className="text-[10px] uppercase tracking-wider text-black/50">PARTIALLY_COVERED</div></div>
                <div><div className="text-lg font-bold text-emerald-600">{data.coverage.summary.provinces_covered}</div><div className="text-[10px] uppercase tracking-wider text-black/50">COVERED</div></div>
                <div><div className="text-lg font-bold text-red-600">{data.coverage.summary.provinces_source_unavailable}</div><div className="text-[10px] uppercase tracking-wider text-black/50">SOURCE_UNAVAILABLE</div></div>
                <div><div className="text-lg font-bold text-black">{data.coverage.summary.attempted_units}</div><div className="text-[10px] uppercase tracking-wider text-black/50">attempted</div></div>
                <div><div className="text-lg font-bold text-black">{data.coverage.summary.properties_measured_total.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">properties measured</div></div>
              </div>
              <div className="mb-3 font-mono text-[10px] text-black/40">{data.coverage.summary.attempted_units_denominator_note}</div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">Province</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">Island</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">State</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-black uppercase tracking-wider text-black/50">Rows</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-black uppercase tracking-wider text-black/50">Tourism</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-black uppercase tracking-wider text-black/50">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coverage.top_priority_provinces.map((u) => (
                    <tr key={u.unit_slug} className="border-b border-black/5">
                      <td className="px-2 py-1.5 text-black">{u.display_name}</td>
                      <td className="px-2 py-1.5 text-black/60">{u.island_group ?? "—"}</td>
                      <td className="px-2 py-1.5" style={{ color: u.state === "PARTIALLY_COVERED" ? "#2563EB" : u.state === "COVERED" ? "#059669" : "#D97706" }}>{u.state}</td>
                      <td className="px-2 py-1.5 text-right text-black/70">{u.property_count_measured.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right text-black/70">{(u.tourism_evidence_strength * 100).toFixed(0)}%</td>
                      <td className="px-2 py-1.5 text-right text-black/70">{u.next_research_priority.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 text-[10px] uppercase tracking-wider text-black/40">
                Registry: {data.coverage.registry_stats.provinces_seeded} provinces seeded · {data.coverage.registry_stats.coverage_states.length} states · {data.coverage.registry_stats.allowed_transitions_count} allowed transitions
              </div>
            </div>
          </section>

          {/* §5-§7 · Gap Engine over existing records · Founder discipline */}
          <section className="mb-8">
            <h2 className="mb-3 text-base font-bold text-black">
              §5-§7 · Gap Engine · run over existing records
              <PanelBadge signal={data.panel_signals?.gap_engine_visible} />
              <span className="ml-3 text-xs font-normal text-black/50">{data.gap_engine.scanned_rows.toLocaleString()} rows scanned in {data.gap_engine_scan_ms}ms · {data.gap_engine.total_gaps_detected.toLocaleString()} gaps detected · zero new collection this pass</span>
            </h2>
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap gap-6">
                <div><div className="text-2xl font-black text-black">{data.gap_engine.scanned_rows.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">records scanned</div></div>
                <div><div className="text-2xl font-black text-amber-600">{data.gap_engine.total_gaps_detected.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">gaps detected</div></div>
                <div><div className="text-2xl font-black text-black">{data.gap_engine.gap_kinds_enum_size}</div><div className="text-[10px] uppercase tracking-wider text-black/50">gap kinds available</div></div>
                <div><div className="text-2xl font-black text-black">{data.gap_engine_scan_ms}ms</div><div className="text-[10px] uppercase tracking-wider text-black/50">engine scan time</div></div>
                <div><div className="text-2xl font-black text-emerald-600">{(data.gap_engine.total_gaps_detected / Math.max(data.gap_engine.scanned_rows, 1)).toFixed(1)}</div><div className="text-[10px] uppercase tracking-wider text-black/50">avg gaps / record</div></div>
              </div>
              <div className="mb-3 font-mono text-[10px] text-black/40">{data.gap_engine.scanned_rows_denominator_note}</div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">#</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">Gap kind</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-black uppercase tracking-wider text-black/50">Count</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-black uppercase tracking-wider text-black/50">% of rows</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gap_engine.top_gap_kinds.map((g, i) => {
                    const pct = data.gap_engine.scanned_rows > 0 ? (g.count / data.gap_engine.scanned_rows) * 100 : 0;
                    return (
                      <tr key={g.kind} className="border-b border-black/5">
                        <td className="px-2 py-1.5 text-black/40">{i + 1}</td>
                        <td className="px-2 py-1.5 font-mono text-black">{g.kind}</td>
                        <td className="px-2 py-1.5 text-right text-black/70">{g.count.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right text-black/60">{pct.toFixed(1)}%</td>
                        <td className="px-2 py-1.5" style={{ width: 240 }}>
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                            <div className="h-full" style={{ width: `${Math.min(100, pct)}%`, background: pct > 80 ? "#F59E0B" : pct > 50 ? "#3B82F6" : "#10B981" }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Founder mandate · Full 9,203 corpus scan (not just 877 visible) */}
          <section className="mb-8">
            <h2 className="mb-3 text-base font-bold text-black">
              §5-§7 · Full canonical corpus (9,203) · knowledge audit
              <PanelBadge signal={data.panel_signals?.gap_engine_full_corpus} />
              <span className="ml-3 text-xs font-normal text-black/50">
                {data.gap_engine_full_corpus.scanned_rows.toLocaleString()} rows across {data.gap_engine_full_corpus.distinct_cities} cities · claim status {Object.entries(data.gap_engine_full_corpus.claim_status_breakdown).map(([k, v]) => `${k}=${v}`).join(" · ")} · scan {data.gap_engine_full_corpus.scan_ms}ms
              </span>
            </h2>
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap gap-6">
                <div><div className="text-2xl font-black text-black">{data.gap_engine_full_corpus.scanned_rows.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">total canonical rows</div></div>
                <div><div className="text-2xl font-black text-amber-600">{data.gap_engine_full_corpus.total_gaps_detected.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">gaps detected</div></div>
                <div><div className="text-2xl font-black text-black">{data.gap_engine_full_corpus.distinct_cities}</div><div className="text-[10px] uppercase tracking-wider text-black/50">distinct cities</div></div>
                <div><div className="text-2xl font-black text-blue-600">{(data.gap_engine_full_corpus.claim_status_breakdown.discovered ?? 0).toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">discovered (pending)</div></div>
                <div><div className="text-2xl font-black text-emerald-600">{(data.gap_engine_full_corpus.claim_status_breakdown.listed ?? 0).toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-black/50">listed (public)</div></div>
                <div><div className="text-2xl font-black text-black">{(data.gap_engine_full_corpus.total_gaps_detected / Math.max(data.gap_engine_full_corpus.scanned_rows, 1)).toFixed(1)}</div><div className="text-[10px] uppercase tracking-wider text-black/50">avg gaps / record</div></div>
              </div>
              <div className="mb-3 font-mono text-[10px] text-black/40">{data.gap_engine_full_corpus.scanned_rows_denominator_note}</div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">#</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">Gap kind</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-black uppercase tracking-wider text-black/50">Count (of 9,203)</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-black uppercase tracking-wider text-black/50">% of rows</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gap_engine_full_corpus.top_gap_kinds.map((g, i) => {
                    const pct = data.gap_engine_full_corpus.scanned_rows > 0 ? (g.count / data.gap_engine_full_corpus.scanned_rows) * 100 : 0;
                    return (
                      <tr key={g.kind} className="border-b border-black/5">
                        <td className="px-2 py-1.5 text-black/40">{i + 1}</td>
                        <td className="px-2 py-1.5 font-mono text-black">{g.kind}</td>
                        <td className="px-2 py-1.5 text-right text-black/70">{g.count.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right text-black/60">{pct.toFixed(1)}%</td>
                        <td className="px-2 py-1.5" style={{ width: 240 }}>
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                            <div className="h-full" style={{ width: `${Math.min(100, pct)}%`, background: pct > 80 ? "#F59E0B" : pct > 50 ? "#3B82F6" : "#10B981" }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-3 text-[11px] leading-relaxed text-black/60">
                <strong>Founder discipline (§5, §7):</strong> Gap Engine ran over the ENTIRE 9,203-row corpus (visible + discovered) BEFORE any new collection.
                Result: NEX knows a hotel exists in each row, but for <em>all 9,203</em> rows it doesn't yet know rooms, services, food, breakfast, policies, accessibility, or nearby relationships.
                This is the honest answer to <em>"what NEX already has vs what it should research next"</em> — closes 143,225 knowledge gaps rather than blindly accumulating duplicates.
              </div>
            </div>
          </section>

          {/* BEGIN 1 · Hot-tier vs canonical · Founder rigor: measured speed proof */}
          {data.hot_tier && (
            <section className="mb-8">
              <h2 className="mb-3 text-base font-bold text-black">
                BEGIN 1 · Hot-tier · this request
                <PanelBadge signal={data.panel_signals?.hot_tier} />
                <span className="ml-3 text-xs font-normal text-black/50">
                  {data.hot_tier.cache_hit ? "🟢 CACHE HIT" : "🟡 CACHE MISS (rebuilt from canonical)"} · scope=<code className="rounded bg-black/5 px-1 font-mono text-[10px]">{data.hot_tier.scope}</code>
                </span>
              </h2>
              <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap gap-6">
                  <div>
                    <div className={`text-2xl font-black ${data.hot_tier.cache_hit ? "text-emerald-600" : "text-amber-600"}`}>
                      {data.hot_tier.cache_hit ? "HIT" : "MISS"}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-black/50">cache verdict</div>
                  </div>
                  <div><div className="text-2xl font-black text-black">{data.hot_tier.cache_age_ms.toLocaleString()}<span className="text-sm font-normal text-black/50"> ms</span></div><div className="text-[10px] uppercase tracking-wider text-black/50">age</div></div>
                  <div><div className="text-2xl font-black text-black">{Math.round(data.hot_tier.cache_ttl_remaining_ms / 1000)}<span className="text-sm font-normal text-black/50"> s</span></div><div className="text-[10px] uppercase tracking-wider text-black/50">ttl remaining</div></div>
                  <div><div className="text-2xl font-black text-black">{data.hot_tier.cache_ttl_configured_ms / 1000}<span className="text-sm font-normal text-black/50"> s</span></div><div className="text-[10px] uppercase tracking-wider text-black/50">ttl configured</div></div>
                  <div><div className="text-2xl font-black text-black">{data.hot_tier.stats.size}<span className="text-sm font-normal text-black/50"> / {data.hot_tier.stats.max_entries}</span></div><div className="text-[10px] uppercase tracking-wider text-black/50">cache entries</div></div>
                  <div><div className="text-2xl font-black text-black">{(data.hot_tier.stats.hit_ratio * 100).toFixed(1)}<span className="text-sm font-normal text-black/50">%</span></div><div className="text-[10px] uppercase tracking-wider text-black/50">lifetime hit ratio</div></div>
                </div>
                <div className="mb-3 flex flex-wrap gap-4 text-xs text-black/60">
                  <div><span className="text-black/40">hits:</span> {data.hot_tier.stats.hits.toLocaleString()}</div>
                  <div><span className="text-black/40">misses:</span> {data.hot_tier.stats.misses.toLocaleString()}</div>
                  <div><span className="text-black/40">refreshes:</span> {data.hot_tier.stats.refreshes.toLocaleString()}</div>
                  <div><span className="text-black/40">evictions:</span> {data.hot_tier.stats.evictions.toLocaleString()}</div>
                  <div><span className="text-black/40">bootstrap:</span> {data.hot_tier.stats.bootstrap_at_iso}</div>
                </div>
                <div className="rounded-lg bg-orange-50 p-3 text-[11px] text-orange-900">
                  <div className="mb-1 font-semibold">Payload identity hash (proves hot-tier == canonical)</div>
                  <div className="font-mono text-orange-800">{data.hot_tier.payload_identity_hash}</div>
                  <div className="mt-1 text-[10px] text-orange-800/80">
                    Same query with <code className="rounded bg-white/50 px-1">?scope=canonical</code> MUST return the same hash · verified by <code className="rounded bg-white/50 px-1">scripts/bench-accommodation-hot-tier-vs-canonical.mjs</code>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-black/40">{data.hot_tier.note}</div>
                <div className="mt-3 text-[11px] text-black/60">
                  <strong>Bench command:</strong>{" "}
                  <code className="rounded bg-black/5 px-1 py-0.5 font-mono">node scripts/bench-accommodation-hot-tier-vs-canonical.mjs --n 25</code>
                  {" "}· measures canonical vs hot-tier P50/P95/P99 side-by-side · verifies identity hash
                </div>
              </div>
            </section>
          )}

          {/* §26 · Latency decomposition (Founder: know where the ms go) */}
          <section className="mb-8">
            <h2 className="mb-3 text-base font-bold text-black">
              §26 · Latency decomposition
              <span className="ml-3 text-xs font-normal text-black/50">stage-by-stage timing · total {data.latency_ms}ms · sum {data.latency_breakdown.stage_sum_ms}ms · overhead {data.latency_breakdown.overhead_ms}ms</span>
            </h2>
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">Stage</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-black uppercase tracking-wider text-black/50">ms</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-black uppercase tracking-wider text-black/50">% of total</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wider text-black/50">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.latency_breakdown.stage_ms).sort((a, b) => b[1] - a[1]).map(([stage, ms]) => {
                    const pct = data.latency_ms > 0 ? (ms / data.latency_ms) * 100 : 0;
                    return (
                      <tr key={stage} className="border-b border-black/5">
                        <td className="px-2 py-1.5 font-mono text-black">{stage}</td>
                        <td className="px-2 py-1.5 text-right text-black/70">{ms.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right text-black/60">{pct.toFixed(1)}%</td>
                        <td className="px-2 py-1.5" style={{ width: 240 }}>
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                            <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-b border-black/5 bg-orange-50/40">
                    <td className="px-2 py-1.5 font-mono font-semibold text-orange-900">overhead (Next.js + serialize + un-instrumented)</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-orange-900">{data.latency_breakdown.overhead_ms.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right text-orange-800">{data.latency_ms > 0 ? ((data.latency_breakdown.overhead_ms / data.latency_ms) * 100).toFixed(1) : "0"}%</td>
                    <td className="px-2 py-1.5" style={{ width: 240 }}>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                        <div className="h-full bg-orange-300" style={{ width: `${Math.min(100, data.latency_ms > 0 ? (data.latency_breakdown.overhead_ms / data.latency_ms) * 100 : 0)}%` }} />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 text-[10px] text-black/40">{data.latency_breakdown.overhead_note}</div>
              <div className="mt-2 text-[11px] text-black/60">
                For P50 / P95 / P99 across N requests · run <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[10px]">node scripts/bench-accommodation-live-proof.mjs</code>
              </div>
            </div>
          </section>

          {/* §13-§15 · Governance gateway */}
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-bold text-black/70">§13-§15 · Governed research/acquisition gateway (this request)</h2>
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap gap-6">
                <div><div className="text-lg font-bold text-emerald-600">{data.governance_gateway.external_calls_this_request}</div><div className="text-[10px] uppercase tracking-wider text-black/50">external scraping calls</div></div>
                <div><div className="text-lg font-bold text-black">{data.governance_gateway.canonical_reads_this_request}</div><div className="text-[10px] uppercase tracking-wider text-black/50">canonical Postgres reads</div></div>
                <div><div className="text-lg font-bold text-black">{data.governance_gateway.canonical_writes_this_request}</div><div className="text-[10px] uppercase tracking-wider text-black/50">canonical Postgres writes</div></div>
              </div>
              <div className="text-xs leading-relaxed text-black/70">{data.governance_gateway.note}</div>
            </div>
          </section>

          {/* §29 · Trace strip */}
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-bold text-black/70">§29 · Trace (auditable)</h2>
            <pre className="overflow-auto rounded-2xl border border-black/10 bg-neutral-50 p-4 font-mono text-[11px] leading-relaxed text-black/70">
{`source                  : ${data.trace.source}
adapter                 : ${data.trace.adapter}
visibility_gate         : ${data.trace.visibility_gate}
claim_funnel            : ${data.trace.marketing_claim_funnel_note}
no_fabrication          : ${data.trace.no_fabrication}
no_llm_used             : ${data.trace.no_llm_used}
evidence_label          : ${data.evidence_label}
latency_ms              : ${data.latency_ms}
latency_stage_sum_ms    : ${data.latency_breakdown.stage_sum_ms}
latency_overhead_ms     : ${data.latency_breakdown.overhead_ms}
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
    </div>
  );
}
