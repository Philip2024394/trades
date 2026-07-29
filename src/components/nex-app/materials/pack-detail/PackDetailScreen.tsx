"use client";
// PackDetailScreen — the Individual Boards mobile screen.
// Mobile-first · portrait · one-handed workshop use.
//
// Composes: PackHeader · SummaryCards · SearchBar (with active
// FilterChips) · sort row · single-column BoardCard list · sticky
// bottom nav shared with the rest of the Materials sub-app.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCcw, LayoutDashboard, FolderKanban, Layers, Boxes, MoreHorizontal, PackageOpen } from "lucide-react";
import { MT } from "../_tokens";
import { PackHeader } from "../_shared/PackHeader";
import { SummaryCards, type SummaryMetric } from "../_shared/SummaryCards";
import { SearchBar } from "../_shared/SearchBar";
import { FilterChip } from "../_shared/FilterChip";
import { OfflineIndicator } from "../_shared/OfflineIndicator";
import { BoardCard } from "../_shared/BoardCard";
import { boardStatusToKind, kindLabel } from "../_shared/StatusBadge";
import type {
  PackWithBoards,
  BoardWithCurrentMeasurement,
  BoardStatus,
} from "@/apps/materials/_schema/types";

type Props = {
  pack: PackWithBoards;
  overview: {
    totalBoards: number;
    totalVolumeM3: number;
    availableM3: number;
    reservedM3: number;
    measuredPct: number;
  };
  speciesShort: string;
};

type StatusFilter = "all" | BoardStatus;
type SortKey = "board_no_asc" | "board_no_desc" | "volume_desc" | "recently_measured";

export function PackDetailScreen({ pack, overview, speciesShort }: Props) {
  const router = useRouter();
  const [query, setQuery]           = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey]       = useState<SortKey>("board_no_asc");
  const [isRefreshing, startRefresh] = useTransition();

  const filtered = useMemo(() => {
    let list = pack.boards;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(b =>
        b.board_ref.toLowerCase().includes(q) ||
        String(b.position_in_pack).includes(q) ||
        `${speciesShort}-${b.board_ref}`.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      list = list.filter(b => b.status === statusFilter);
    }
    return sortBoards(list, sortKey);
  }, [pack.boards, query, statusFilter, sortKey, speciesShort]);

  const metrics: SummaryMetric[] = [
    { key: "boards",      icon: "boards",       value: overview.totalBoards.toString(),        label: "Total Boards"    },
    { key: "vol_total",   icon: "volume",       value: `${overview.totalVolumeM3.toFixed(2)} m³`, label: "Total Volume"  },
    { key: "vol_avail",   icon: "available",    value: `${overview.availableM3.toFixed(2)} m³`,   label: "Available"     },
    { key: "vol_res",     icon: "reserved",     value: `${overview.reservedM3.toFixed(2)} m³`,    label: "Reserved"      },
    { key: "measured",    icon: "measured_pct", value: `${overview.measuredPct.toFixed(0)}%`,     label: "Measured %"    },
  ];

  const activeFilters: { key: string; label: string; onRemove: () => void }[] = [];
  if (statusFilter !== "all") {
    activeFilters.push({
      key: `status-${statusFilter}`,
      label: `Status: ${kindLabel(boardStatusToKind(statusFilter))}`,
      onRemove: () => setStatusFilter("all"),
    });
  }
  if (query.trim()) {
    activeFilters.push({
      key: "q",
      label: `“${query.trim()}”`,
      onRemove: () => setQuery(""),
    });
  }

  const refresh = () => {
    startRefresh(() => {
      router.refresh();
    });
  };

  return (
    <div
      className="relative mx-auto flex min-h-screen w-full flex-col"
      style={{ background: MT.bg, color: MT.darkGrey, maxWidth: 440, fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
    >
      <OfflineIndicator />
      <PackHeader
        backHref="/nex-app/materials/packs"
        packRef={pack.pack_ref}
        speciesName={pack.species.display_name}
        packStatus={pack.status}
        supplierName={pack.supplier?.name ?? null}
        purchaseDate={pack.purchase_date}
        boardCount={pack.boards.length}
      />

      <main className="flex-1 pb-28">
        {/* Summary cards */}
        <section className="mt-3">
          <SummaryCards metrics={metrics} />
        </section>

        {/* Search bar */}
        <section className="mt-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            filterCount={activeFilters.length}
            onFilterClick={cycleStatusFilter(statusFilter, setStatusFilter)}
          />
        </section>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <section className="mt-2 flex flex-wrap items-center gap-2 px-4">
            {activeFilters.map((f) => (
              <FilterChip key={f.key} label={f.label} onRemove={f.onRemove} />
            ))}
          </section>
        )}

        {/* Sort row */}
        <section className="mt-3 flex items-center justify-between px-4">
          <button
            type="button"
            onClick={cycleSort(sortKey, setSortKey)}
            className="inline-flex items-center gap-1 text-[13px] font-semibold"
            style={{ color: MT.darkGrey }}
          >
            <span style={{ color: MT.secondaryGrey }}>Sort:</span>
            <span>{sortLabel(sortKey)}</span>
            <span aria-hidden style={{ color: MT.secondaryGrey }}>▾</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              aria-label="Refresh"
              className="grid h-8 w-8 place-items-center rounded-full transition-transform active:scale-95"
              style={{ color: MT.secondaryGrey }}
            >
              <RefreshCcw
                size={14}
                strokeWidth={2}
                style={{ animation: isRefreshing ? "spin 0.8s linear infinite" : undefined }}
              />
            </button>
            <span className="text-[13px] font-semibold" style={{ color: MT.secondaryGrey }}>
              {filtered.length} {filtered.length === 1 ? "Board" : "Boards"}
            </span>
          </div>
        </section>

        {/* Board list */}
        <section className="mt-3 flex flex-col gap-3 px-4">
          {filtered.length === 0 ? (
            <EmptyState hasQuery={query.length > 0 || statusFilter !== "all"} />
          ) : (
            filtered.map(b => (
              <BoardCard
                key={b.id}
                board={b}
                packSlug={pack.pack_ref}
                packSpeciesShort={speciesShort}
                packGrade={pack.grade}
              />
            ))
          )}
        </section>
      </main>

      <BottomTabBar />
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Sort ─────────────────────────────────────────────────────────

function sortBoards(list: BoardWithCurrentMeasurement[], key: SortKey): BoardWithCurrentMeasurement[] {
  const copy = list.slice();
  switch (key) {
    case "board_no_asc":
      return copy.sort((a, b) => a.position_in_pack - b.position_in_pack);
    case "board_no_desc":
      return copy.sort((a, b) => b.position_in_pack - a.position_in_pack);
    case "volume_desc":
      return copy.sort((a, b) => boardVolumeMm3(b) - boardVolumeMm3(a));
    case "recently_measured":
      return copy.sort((a, b) => {
        const at = a.current_measurement?.measured_at ?? "";
        const bt = b.current_measurement?.measured_at ?? "";
        return bt.localeCompare(at);
      });
  }
}

function boardVolumeMm3(b: BoardWithCurrentMeasurement): number {
  const m = b.current_measurement;
  if (!m) return 0;
  const avgW = (m.width_end_a_mm + m.width_centre_mm + m.width_end_b_mm) / 3;
  const avgT = (m.thickness_end_a_mm + m.thickness_centre_mm + m.thickness_end_b_mm) / 3;
  return m.length_mm * avgW * avgT;
}

function sortLabel(k: SortKey): string {
  return {
    board_no_asc:      "Board No. (A–Z)",
    board_no_desc:     "Board No. (Z–A)",
    volume_desc:       "Volume (largest first)",
    recently_measured: "Recently measured",
  }[k];
}

const SORT_CYCLE: SortKey[] = ["board_no_asc", "board_no_desc", "volume_desc", "recently_measured"];
function cycleSort(current: SortKey, set: (k: SortKey) => void) {
  return () => {
    const i = SORT_CYCLE.indexOf(current);
    set(SORT_CYCLE[(i + 1) % SORT_CYCLE.length]);
  };
}

// ── Filter cycle ─────────────────────────────────────────────────

const FILTER_CYCLE: StatusFilter[] = ["all", "awaiting_measurement", "measured", "allocated", "machined", "installed", "offcut", "disposed"];
function cycleStatusFilter(current: StatusFilter, set: (s: StatusFilter) => void) {
  return () => {
    const i = FILTER_CYCLE.indexOf(current);
    set(FILTER_CYCLE[(i + 1) % FILTER_CYCLE.length]);
  };
}

// ── Empty state ──────────────────────────────────────────────────

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div
      className="mt-4 flex flex-col items-center px-6 py-10 text-center"
      style={{
        background: MT.card,
        border: `1px dashed ${MT.border}`,
        borderRadius: MT.radiusLg,
      }}
    >
      <div
        className="grid h-14 w-14 place-items-center rounded-2xl"
        style={{ background: MT.primarySoft, color: MT.primary, border: `1px solid ${MT.primaryBorder}` }}
      >
        <PackageOpen size={26} strokeWidth={1.85} />
      </div>
      <h2 className="mt-4 text-[16px] font-extrabold" style={{ color: MT.darkGrey }}>
        {hasQuery ? "No boards match your filters" : "No boards in this pack yet"}
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: MT.secondaryGrey }}>
        {hasQuery
          ? "Clear the search or filter to see the full pack."
          : "Register boards from the admin surface to start measuring."}
      </p>
    </div>
  );
}

// ── Bottom tab bar ───────────────────────────────────────────────

function BottomTabBar() {
  const items = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/admin/materials",     active: false },
    { label: "Projects",  icon: FolderKanban,    href: "#",                     active: false },
    { label: "Materials", icon: Layers,          href: "/nex-app/materials",    active: true  },
    { label: "Stock",     icon: Boxes,           href: "/nex-app/materials/stock", active: false },
    { label: "More",      icon: MoreHorizontal,  href: "#",                     active: false },
  ];
  return (
    <nav
      className="sticky bottom-0 z-40 flex items-stretch justify-around px-2 pt-2 pb-3"
      style={{ background: MT.card, borderTop: `1px solid ${MT.borderLight}`, boxShadow: "0 -10px 24px -14px rgba(15,17,21,0.10)" }}
      aria-label="Materials navigation"
    >
      {items.map((it) => {
        const color = it.active ? MT.primary : MT.secondaryGrey;
        return (
          <Link
            key={it.label}
            href={it.href}
            aria-current={it.active ? "page" : undefined}
            className="relative flex flex-1 flex-col items-center gap-1 py-1.5 transition-transform active:scale-95"
          >
            <span style={{ color }}>
              <it.icon size={22} strokeWidth={it.active ? 2.1 : 1.85} />
            </span>
            <span className="text-[10.5px] font-semibold leading-none" style={{ color }}>
              {it.label}
            </span>
            {it.active && (
              <span aria-hidden className="absolute -bottom-0.5 h-[3px] w-8 rounded-full" style={{ background: MT.primary }} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
