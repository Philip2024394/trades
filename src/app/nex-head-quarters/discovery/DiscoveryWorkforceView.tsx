"use client";

// src/app/nex-head-quarters/discovery/DiscoveryWorkforceView.tsx
//
// Client-side filter/sort + rendering shell for the HQ Workforce Command View.
// Server loads all state (rotation · in-flight · queue · last-cycle · registry),
// this component owns the interactive filtering + sort surface.
//
// Doctrine (Philip 2026-08-24 · project_nex_hq_workforce_command_view_2026_08_24):
//   · One page becomes the command view for a growing Indonesian workforce
//   · Global counter header · NOW WORKING · NEXT sections · then the matrix
//   · Filters (search · region · category · status) + sort · scalable to 100+ cities
//   · SATURATED means TEMPORARILY cooled down · Rotation Controller revisits later
//   · Every number is real DB · never fake activity

import Link from "next/link";
import { useMemo, useState } from "react";
import { WORKFORCE_STATUS_META, type WorkforceStatus } from "@/lib/nex-hq/workforce-status";
import type { WorkforceMetrics } from "@/lib/nex-hq/workforce-metrics";

export interface WorkforceCellData {
  city: string;
  citySlug: string;
  cityProvince: string;
  cityRegion: string;
  category: string;
  walkerAvailable: boolean;
  status: WorkforceStatus;
  recordsNewLastCycle: number | null;
  consecutiveZeroNewCycles: number;
  lastCycleStartedAt: string | null;   // ISO
  reactivationReason: string | null;
  drillHref: string | null;            // where clicking the cell goes · MUST include ?city=slug so context survives
  note: string | null;
  // 2026-08-24 · admin visibility · authoritative persisted-row count from the
  // real business table for this (city, category). Never derived from cycle
  // counters. 0 here means literally 0 rows in the directory · not 0 processed.
  directoryTotal?: number;
  // 2026-08-24 · Philip · per-card processed/matched/new/saved must be visible
  // on EVERY combo cell (not only in the recently-completed section). Sourced
  // from loadCityCategoryObservability's latest cycle for the combo. Null when
  // the combo has never run (walker-unavailable / never-picked).
  processed?: number | null;
  matched?: number | null;
  saved?: number | null;                 // authoritative persisted count (== recordsNewLastCycle post P1)
  provider?: string | null;              // primary provider from summary.provider_results[0]
  providerError?: string | null;         // summary.unexpected_error · shown as small chip
  diagnosis?: string;                    // "Productive" | "All deduped" | "Provider empty" | ... (null → not surfaced)
}

interface NowWorkingItem {
  city: string;
  category: string;
  cycleId: string;
  startedAtIso: string;
  workerConfig: string;
}

interface NextQueuedItem {
  city: string;
  category: string;
  reason: string;
}

interface RecentlyCompletedItem {
  cycleId: string;
  city: string;
  category: string;
  unresolved?: boolean;         // when true · city/category hold "Unresolved" + raw cfg
  status: string;               // 'completed' · 'failed'
  startedAtIso: string;
  durationSec: number;
  recordsNew: number | null;
  recordsProcessed: number | null;
  // 2026-08-24 · admin visibility enrichments · source: observability helper.
  matched?: number | null;
  saved?: number | null;            // authoritative persisted count (== recordsNew post P1)
  provider?: string | null;
  providerError?: string | null;    // summary.unexpected_error truncated
  diagnosis?: string;               // "Productive" | "All deduped" | "Provider empty" | "Provider error" | "Cycle failed" | ...
  directoryTotal?: number;          // real persisted-row count for (city, category) right now
}

interface Props {
  cells: WorkforceCellData[];
  nowWorking: NowWorkingItem[];
  nextQueued: NextQueuedItem[];
  recentlyCompleted: RecentlyCompletedItem[];
  workforceCounts: Record<WorkforceStatus, number>;
  workforceMax: number;
  activeWorkers: number;
  totalCities: number;
  totalCategories: number;
  metrics1h?: WorkforceMetrics;
  metrics24h?: WorkforceMetrics;
}

type SortMode = "workforce" | "city" | "recent" | "records";
type RegionFilter = "all" | "DIY" | "Central Java";
type CategoryFilter = "all" | "food" | "accommodation" | "market" | "transport";
type StatusFilter = "all" | WorkforceStatus;

const WORKFORCE_ORDER: WorkforceStatus[] = ["working", "queued", "waiting", "idle", "saturated", "error", "unavailable"];

export function DiscoveryWorkforceView(props: Props): React.JSX.Element {
  const [search, setSearch]     = useState("");
  const [region, setRegion]     = useState<RegionFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus]     = useState<StatusFilter>("all");
  const [sort, setSort]         = useState<SortMode>("workforce");

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = props.cells.filter((c) => {
      if (q && !c.city.toLowerCase().includes(q) && !c.cityProvince.toLowerCase().includes(q)) return false;
      if (region   !== "all" && c.cityRegion !== region) return false;
      if (category !== "all" && c.category !== category) return false;
      if (status   !== "all" && c.status !== status) return false;
      return true;
    });
    filtered.sort((a, b) => {
      switch (sort) {
        case "workforce": {
          const aRank = WORKFORCE_ORDER.indexOf(a.status);
          const bRank = WORKFORCE_ORDER.indexOf(b.status);
          if (aRank !== bRank) return aRank - bRank;
          return a.city.localeCompare(b.city);
        }
        case "city":
          return a.city.localeCompare(b.city) || a.category.localeCompare(b.category);
        case "recent": {
          const aMs = a.lastCycleStartedAt ? new Date(a.lastCycleStartedAt).getTime() : 0;
          const bMs = b.lastCycleStartedAt ? new Date(b.lastCycleStartedAt).getTime() : 0;
          return bMs - aMs;
        }
        case "records":
          return (b.recordsNewLastCycle ?? 0) - (a.recordsNewLastCycle ?? 0);
      }
    });
    return filtered;
  }, [props.cells, search, region, category, status, sort]);

  return (
    <>
      {/* Real workforce metrics · Stage-10 observation phase (2026-08-24) ·
          every number from live DB · no estimates. */}
      {props.metrics1h && props.metrics24h && (
        <section style={{ marginBottom: 18 }}>
          <SectionLabel emoji="📊">Workforce metrics · real DB</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <MetricsBox label={`${props.metrics1h.windowLabel} · ${props.metrics1h.observationWindowSec}s observed`} m={props.metrics1h} />
            <MetricsBox label={`${props.metrics24h.windowLabel}`}                                                     m={props.metrics24h} />
          </div>
          {props.metrics1h.zombieCycles > 0 && (
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", fontSize: 11.5, color: "#92400e" }}>
              ⚠️ {props.metrics1h.zombieCycles} zombie cycle{props.metrics1h.zombieCycles === 1 ? "" : "s"} detected
              (status=&apos;running&apos; · started &gt; 2h ago · scheduler likely died mid-cycle).
              Autonomous recovery is the correct future mechanism · a scheduled reconciler will detect and mark these &apos;failed&apos; without human intervention. Manual operator SQL is not the operating model.
            </div>
          )}
        </section>
      )}

      {/* Global counter header · every number real DB */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
          {WORKFORCE_ORDER.map((s) => {
            const m = WORKFORCE_STATUS_META[s];
            const n = props.workforceCounts[s] ?? 0;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(status === s ? "all" : s)}
                style={{
                  padding: "8px 14px", borderRadius: 999,
                  background: status === s ? m.fg : m.bg,
                  color:      status === s ? "#fff" : m.fg,
                  border: `1px solid ${m.border}`,
                  fontWeight: 700, cursor: "pointer",
                  fontSize: 12, letterSpacing: 0.3,
                }}
                aria-pressed={status === s}
                title={status === s ? `Clear filter · showing only ${m.label}` : `Filter by ${m.label}`}
              >
                {m.dot} {m.label} <strong style={{ fontWeight: 900 }}>{n}</strong>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--nex-neutral-500)" }}>
          Workforce slots: <strong>{props.activeWorkers} / {props.workforceMax}</strong>
          {" · "}Cities: <strong>{props.totalCities}</strong>
          {" · "}Categories: <strong>{props.totalCategories}</strong>
          {" · "}Total combos: <strong>{props.cells.length}</strong>
          {status !== "all" && <> · <a href="#" onClick={(e) => { e.preventDefault(); setStatus("all"); }} style={{ color: "#c2410c" }}>clear status filter</a></>}
        </div>
      </section>

      {/* NOW WORKING */}
      <section style={{ marginBottom: 18 }}>
        <SectionLabel emoji="🟢">Now Working ({props.nowWorking.length})</SectionLabel>
        {props.nowWorking.length === 0 ? (
          <div style={hollowPanel()}>
            No walker is currently running. Orchestrator evaluates the workforce every 60 seconds when <code>NEX_ORCHESTRATOR_ENABLED=true</code> (Stage-10 cadence).
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
            {props.nowWorking.map((n) => (
              <div key={n.cycleId} style={{
                padding: "10px 14px", borderRadius: 10,
                background: WORKFORCE_STATUS_META.working.bg,
                border: `1px solid ${WORKFORCE_STATUS_META.working.border}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: WORKFORCE_STATUS_META.working.fg }}>
                  🟢 {n.city} / <span style={{ textTransform: "capitalize" }}>{n.category}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--nex-neutral-700)", marginTop: 4, fontFamily: "monospace" }}>
                  since {new Date(n.startedAtIso).toLocaleTimeString("en-GB", { hour12: false })}
                </div>
                <div style={{ fontSize: 10, color: "var(--nex-neutral-500)", marginTop: 2, fontFamily: "monospace" }}>
                  {n.workerConfig}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* RECENTLY COMPLETED · trailing activity (last 10 min) · walkers finish
          fast so they're rarely caught 'running' at snapshot time · this shows
          the workforce is actually moving. */}
      <section style={{ marginBottom: 18 }}>
        <SectionLabel emoji="⚫">Recently completed (last 10 min · {props.recentlyCompleted.length})</SectionLabel>
        {props.recentlyCompleted.length === 0 ? (
          <div style={hollowPanel()}>
            No cycles completed in the last 10 minutes. Start the scheduler with <code>NEX_DEV_WORKERS=1 npm run dev:workers</code> · food/accommodation walkers fire every 15 min · market walker every 15 min (non-stop, 2h zone cooldown).
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
            {props.recentlyCompleted.map((rc) => {
              const isFailed = rc.status === "failed";
              const isProductive = (rc.recordsNew ?? 0) > 0;
              const bg = isFailed ? WORKFORCE_STATUS_META.error.bg
                       : isProductive ? WORKFORCE_STATUS_META.working.bg
                       : "rgba(0,0,0,0.03)";
              const border = isFailed ? WORKFORCE_STATUS_META.error.border
                           : isProductive ? WORKFORCE_STATUS_META.working.border
                           : "rgba(0,0,0,0.14)";
              const fg = isFailed ? WORKFORCE_STATUS_META.error.fg
                       : isProductive ? WORKFORCE_STATUS_META.working.fg
                       : "#525252";
              return (
                <div key={rc.cycleId} style={{
                  padding: "10px 14px", borderRadius: 10, background: bg, border: `1px solid ${border}`,
                }}>
                  {rc.unresolved ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#525252" }}>
                        ⚫ Unresolved worker configuration
                      </div>
                      <div style={{ fontSize: 10, color: "var(--nex-neutral-500)", marginTop: 2, fontFamily: "monospace" }}>
                        raw: <code>{rc.category}</code>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 800, color: fg }}>
                      {isFailed ? "🟠" : isProductive ? "✅" : "⚪"} {rc.city} / <span style={{ textTransform: "capitalize" }}>{rc.category}</span>
                    </div>
                  )}
                  {/* Workforce activity line · processed · matched · new · saved */}
                  <div style={{ fontSize: 11, color: "var(--nex-neutral-700)", marginTop: 4 }}>
                    {rc.recordsProcessed != null && <>{rc.recordsProcessed} processed · </>}
                    {rc.matched != null && <>{rc.matched} matched · </>}
                    {rc.recordsNew != null && <>{rc.recordsNew} new · </>}
                    <strong style={{ color: (rc.saved ?? rc.recordsNew ?? 0) > 0 ? "#047857" : "#666" }}>
                      {rc.saved ?? rc.recordsNew ?? 0} saved
                    </strong>
                    {" · "}<span style={{ fontFamily: "monospace" }}>{rc.durationSec}s</span>
                  </div>
                  {/* Diagnosis pill · answers WHY the numbers are what they are */}
                  {rc.diagnosis && (
                    <div style={{ marginTop: 6, display: "inline-block",
                                  padding: "2px 8px", borderRadius: 999,
                                  fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                                  background: diagnosisBg(rc.diagnosis),
                                  color: diagnosisFg(rc.diagnosis) }}>
                      {rc.diagnosis}
                    </div>
                  )}
                  {/* Directory total · authoritative persisted-row count for context */}
                  {rc.directoryTotal != null && (
                    <div style={{ fontSize: 10.5, color: "var(--nex-neutral-500)", marginTop: 4 }}>
                      Directory total: <strong style={{ color: "var(--nex-neutral-900)" }}>{rc.directoryTotal.toLocaleString("en-GB")}</strong>
                      {rc.provider && <> · via {rc.provider}</>}
                    </div>
                  )}
                  {/* Provider error text · shown only when present */}
                  {rc.providerError && (
                    <div style={{ marginTop: 4, fontSize: 10, fontFamily: "monospace",
                                  padding: "3px 6px", borderRadius: 4,
                                  background: "rgba(239,68,68,0.10)", color: "#991b1b",
                                  wordBreak: "break-word" }}>
                      {rc.providerError}
                    </div>
                  )}
                  <div style={{ fontSize: 9.5, color: "var(--nex-neutral-500)", marginTop: 4, fontFamily: "monospace" }}>
                    {new Date(rc.startedAtIso).toLocaleTimeString("en-GB", { hour12: false })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* NEXT · orchestrator's would-pick queue */}
      <section style={{ marginBottom: 20 }}>
        <SectionLabel emoji="🔵">Next in queue ({props.nextQueued.length})</SectionLabel>
        {props.nextQueued.length === 0 ? (
          <div style={hollowPanel()}>
            No combo is queued right now. All eligible combos may be waiting for a fairness cooldown, or every walker slot is in-flight, or nothing is eligible at all (all-saturated scenario).
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
            {props.nextQueued.map((q, i) => (
              <div key={`${q.city}:${q.category}:${i}`} style={{
                padding: "8px 12px", borderRadius: 8,
                background: WORKFORCE_STATUS_META.queued.bg,
                border: `1px solid ${WORKFORCE_STATUS_META.queued.border}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: WORKFORCE_STATUS_META.queued.fg }}>
                  🔵 {q.city} / <span style={{ textTransform: "capitalize" }}>{q.category}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--nex-neutral-500)", marginTop: 2 }}>
                  {q.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Filter/sort controls */}
      <section style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "12px 14px", background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 10 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search city or province…"
            style={{ flex: "1 1 220px", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--nex-neutral-200)", fontSize: 12.5 }}
          />
          <SelectFilter label="Region"   value={region}   onChange={(v) => setRegion(v as RegionFilter)}     options={[["all","All regions"],["DIY","DIY"],["Central Java","Central Java"]]} />
          <SelectFilter label="Category" value={category} onChange={(v) => setCategory(v as CategoryFilter)} options={[["all","All categories"],["food","🍜 Food"],["accommodation","🏨 Accommodation"],["market","🏪 Market"],["transport","🚕 Transport"]]} />
          <SelectFilter label="Sort"     value={sort}     onChange={(v) => setSort(v as SortMode)}           options={[["workforce","Workforce state"],["city","City (alphabetical)"],["recent","Most recent activity"],["records","Records new last cycle"]]} />
          {(search || region !== "all" || category !== "all" || status !== "all") && (
            <button type="button" onClick={() => { setSearch(""); setRegion("all"); setCategory("all"); setStatus("all"); }} style={{ padding: "6px 12px", borderRadius: 999, background: "transparent", border: "1px dashed rgba(0,0,0,0.2)", fontSize: 11, cursor: "pointer", color: "#c2410c", fontWeight: 700 }}>
              clear all filters
            </button>
          )}
        </div>
      </section>

      {/* Matrix / list rendering */}
      <section>
        <SectionLabel>Cities × Categories · {filteredSorted.length} combo{filteredSorted.length === 1 ? "" : "s"} shown</SectionLabel>
        {filteredSorted.length === 0 ? (
          <div style={hollowPanel()}>
            No combos match the current filters. Try clearing filters above.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
            {filteredSorted.map((cell) => (
              <MatrixCard key={`${cell.city}:${cell.category}`} cell={cell} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

// Diagnosis colour map · mirrors the /directory admin card pills.
function diagnosisBg(d: string): string {
  switch (d) {
    case "Productive":         return "rgba(74,222,128,0.18)";
    case "All deduped":        return "rgba(251,191,36,0.18)";
    case "Provider empty":     return "rgba(148,163,184,0.18)";
    case "Provider error":     return "rgba(239,68,68,0.20)";
    case "Cycle failed":       return "rgba(239,68,68,0.20)";
    case "Zombie reconciled":  return "rgba(249,115,22,0.18)";
    case "Running now":        return "rgba(96,165,250,0.18)";
    case "Never run":          return "rgba(115,115,115,0.18)";
    default:                    return "rgba(115,115,115,0.14)";
  }
}
function diagnosisFg(d: string): string {
  switch (d) {
    case "Productive":         return "#047857";
    case "All deduped":        return "#92400e";
    case "Provider empty":     return "#475569";
    case "Provider error":     return "#991b1b";
    case "Cycle failed":       return "#991b1b";
    case "Zombie reconciled":  return "#c2410c";
    case "Running now":        return "#1d4ed8";
    case "Never run":          return "#525252";
    default:                    return "#525252";
  }
}

function MatrixCard({ cell }: { cell: WorkforceCellData }): React.JSX.Element {
  const m = WORKFORCE_STATUS_META[cell.status];
  const inner = (
    <div style={{
      padding: "12px 14px", borderRadius: 10,
      background: m.bg, border: `1px solid ${m.border}`,
      display: "flex", flexDirection: "column", gap: 4,
      minHeight: 90,
      opacity: cell.walkerAvailable ? 1 : 0.65,
      cursor: cell.drillHref ? "pointer" : "default",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#1a1a1a" }}>
          {cell.city}
        </div>
        <span style={{
          fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase",
          padding: "2px 8px", borderRadius: 999, fontWeight: 800,
          background: "rgba(255,255,255,0.6)", color: m.fg,
        }}>
          {m.dot} {m.label}
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--nex-neutral-500)" }}>
        {cell.cityProvince} · <span style={{ textTransform: "capitalize" }}>{cell.category}</span>
      </div>
      {/* 2026-08-24 · admin visibility · authoritative persisted-row count for
          this (city, category) from the real business table. Shown on EVERY
          cell (even Idle/Error) so the admin can see the directory reality
          alongside the workforce state. */}
      {cell.directoryTotal != null && (
        <div style={{
          fontSize: 11, marginTop: 4, padding: "3px 8px", borderRadius: 6,
          background: "rgba(255,255,255,0.55)",
          color: cell.directoryTotal > 0 ? "#047857" : "var(--nex-neutral-500)",
          fontWeight: 700, display: "inline-block",
        }}>
          {cell.directoryTotal.toLocaleString("en-GB")} in directory
        </div>
      )}
      {/* 2026-08-24 · Philip · per-card processed / matched / new / saved must
          be visible on every cell. Rendered only when the last cycle actually
          examined something (processed > 0) so 'never-run' cells stay quiet.
          `saved` deliberately styled in green when > 0 so the eye lands on
          real productive activity first. */}
      {(cell.processed ?? 0) > 0 && (
        <div style={{ fontSize: 11, color: "#333", marginTop: 4, lineHeight: 1.55 }}>
          {cell.processed != null && <>{cell.processed} processed · </>}
          {cell.matched != null && <>{cell.matched} matched · </>}
          {cell.recordsNewLastCycle != null && <>{cell.recordsNewLastCycle} new · </>}
          <strong style={{ color: (cell.saved ?? cell.recordsNewLastCycle ?? 0) > 0 ? "#047857" : "#666" }}>
            {(cell.saved ?? cell.recordsNewLastCycle ?? 0).toLocaleString("en-GB")} saved
          </strong>
        </div>
      )}
      {/* Fallback for cells with no processed-count yet · still surface the
          consecutive-zero streak so the admin knows the walker HAS been trying. */}
      {(cell.processed == null || cell.processed === 0) && cell.walkerAvailable && cell.recordsNewLastCycle != null && (
        <div style={{ fontSize: 11, color: "#333", marginTop: 4 }}>
          last cycle: <strong>{cell.recordsNewLastCycle}</strong> new
          {cell.consecutiveZeroNewCycles > 0 && <> · {cell.consecutiveZeroNewCycles}× zero</>}
        </div>
      )}
      {/* Diagnosis pill · answers WHY the numbers are what they are · same
          colour system as the recently-completed section for consistency. */}
      {cell.diagnosis && (
        <div style={{ marginTop: 6, display: "inline-block",
                      padding: "2px 8px", borderRadius: 999,
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                      background: diagnosisBg(cell.diagnosis),
                      color: diagnosisFg(cell.diagnosis) }}>
          {cell.diagnosis}
        </div>
      )}
      {/* Provider name + last-run timestamp on the same row · monospace so it
          reads as raw evidence not marketing copy. */}
      {cell.walkerAvailable && (cell.provider || cell.lastCycleStartedAt) && (
        <div style={{ fontSize: 9.5, color: "var(--nex-neutral-500)", fontFamily: "monospace", marginTop: 4 }}>
          {cell.provider && <>via {cell.provider}{cell.lastCycleStartedAt ? " · " : ""}</>}
          {cell.lastCycleStartedAt && new Date(cell.lastCycleStartedAt).toLocaleString("en-GB", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
      )}
      {/* Provider-error text · shown as a compact chip when the LAST cycle
          errored at the provider layer · truncated to keep the card tight. */}
      {cell.providerError && (
        <div style={{ marginTop: 4, fontSize: 10, fontFamily: "monospace",
                      padding: "3px 6px", borderRadius: 4,
                      background: "rgba(239,68,68,0.10)", color: "#991b1b",
                      wordBreak: "break-word" }}>
          {cell.providerError.length > 90 ? cell.providerError.slice(0, 90) + "…" : cell.providerError}
        </div>
      )}
      {cell.reactivationReason && (
        <div style={{ fontSize: 10, color: "#1e40af", marginTop: 2, fontStyle: "italic" }}>
          reactivate: {cell.reactivationReason}
        </div>
      )}
      {!cell.walkerAvailable && (
        <div style={{ fontSize: 10, color: "var(--nex-neutral-500)", fontStyle: "italic", marginTop: 2 }}>
          {cell.note ?? "not city-configurable"}
        </div>
      )}
    </div>
  );
  if (cell.drillHref) {
    return <Link href={cell.drillHref} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{inner}</Link>;
  }
  return inner;
}

function SectionLabel({ children, emoji }: { children: React.ReactNode; emoji?: string }): React.JSX.Element {
  return (
    <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700, marginBottom: 8 }}>
      {emoji ? `${emoji} ` : ""}{children}
    </div>
  );
}

function MetricsBox({ label, m }: { label: string; m: WorkforceMetrics }): React.JSX.Element {
  const failTone = m.failureRatePct > 5 ? "#991b1b" : m.failureRatePct > 1 ? "#92400e" : "#047857";
  const failBadge = m.failureRatePct > 5 ? "🟠" : m.failureRatePct > 1 ? "🟡" : "🟢";
  return (
    <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)" }}>
      <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11.5 }}>
        <MetricRow label="Cycles completed" value={m.cyclesCompleted.toLocaleString("en-GB")} />
        <MetricRow label="Cycles failed"    value={`${m.cyclesFailed.toLocaleString("en-GB")}`} />
        <MetricRow label="Failure rate"     value={`${failBadge} ${m.failureRatePct}%`} valueColor={failTone} />
        <MetricRow label="Running now"      value={m.cyclesRunning.toLocaleString("en-GB")} />
        <MetricRow label="Records new"      value={m.recordsNew.toLocaleString("en-GB")} />
        <MetricRow label="Records/hour"     value={m.recordsNewPerHour.toLocaleString("en-GB")} />
        <MetricRow label="Records processed" value={m.recordsProcessed.toLocaleString("en-GB")} />
        <MetricRow label="Avg cycle duration" value={m.avgCycleDurationMs != null ? `${(m.avgCycleDurationMs / 1000).toFixed(1)}s` : "—"} />
        <MetricRow label="Avg new / cycle"  value={m.avgRecordsNewPerCycle != null ? m.avgRecordsNewPerCycle.toFixed(2) : "—"} />
        <MetricRow label="Nominatim leases" value={m.nominatimLeases.toLocaleString("en-GB")} />
        <MetricRow label="Overpass leases"  value={m.overpassLeases.toLocaleString("en-GB")} />
        <MetricRow label="Active provider leases" value={m.activeLeases.toLocaleString("en-GB")} />
        <MetricRow label="Orchestrator picks" value={m.orchestratorPicks.toLocaleString("en-GB")} />
        <MetricRow label="Distinct combos picked" value={m.distinctPickedCombos.toLocaleString("en-GB")} />
      </div>
    </div>
  );
}

function MetricRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }): React.JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px dashed rgba(0,0,0,0.06)", paddingBottom: 3 }}>
      <span style={{ color: "var(--nex-neutral-500)" }}>{label}</span>
      <span style={{ fontWeight: 700, fontFamily: "monospace", color: valueColor ?? "var(--nex-neutral-900)" }}>{value}</span>
    </div>
  );
}

function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }): React.JSX.Element {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--nex-neutral-700)" }}>
      <span style={{ fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", fontSize: 10, color: "var(--nex-neutral-500)" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--nex-neutral-200)", fontSize: 12, background: "var(--nex-neutral-0)", cursor: "pointer" }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function hollowPanel(): React.CSSProperties {
  return {
    padding: "18px 16px", borderRadius: 10,
    background: "rgba(0,0,0,0.02)", border: "1px dashed rgba(0,0,0,0.14)",
    fontSize: 12, color: "var(--nex-neutral-500)", fontStyle: "italic",
  };
}
