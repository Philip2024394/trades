"use client";

// StudioAnalyticsModal — per-section performance dashboard.
//
// Merchants open this from the command palette (Module 13). Shows:
//   • Overall page totals for the current window (views / clicks /
//     converts)
//   • Per-section table sorted by views: section key, instance, views,
//     clicks, CTR, converts, tiny 30-day sparkline
//   • Window switcher (7d / 30d / 90d)
//   • Jump-to-section button per row (scrolls the iframe, sets
//     selection — mirrors the Score modal drill-down UX)
//
// Fetches on open + when window changes. No client-side scoring —
// server does the aggregation.

import { useCallback, useEffect, useState } from "react";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#DC2626";
const BLUE = "#3B82F6";

type WindowKey = "7d" | "30d" | "90d";

type SectionRow = {
  section_key: string | null;
  instance_id: string | null;
  views: number;
  clicks: number;
  converts: number;
  ctr: number;
  conversion_rate: number;
  daily: { day: string; views: number; clicks: number }[];
};

type AnalyticsResponse = {
  ok: true;
  pageId: string;
  window: WindowKey;
  since: string;
  totals: { views: number; clicks: number; converts: number };
  sections: SectionRow[];
};

type Props = {
  pageId: string;
  onClose: () => void;
  onJumpToSection?: (instanceId: string) => void;
};

export function StudioAnalyticsModal({ pageId, onClose, onJumpToSection }: Props) {
  const [windowKey, setWindowKey] = useState<WindowKey>("30d");
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "loaded"; data: AnalyticsResponse }
  >({ kind: "loading" });

  const load = useCallback(
    async (w: WindowKey) => {
      setState({ kind: "loading" });
      try {
        const res = await fetch(
          `/api/studio/analytics/page?pageId=${encodeURIComponent(pageId)}&window=${w}`
        );
        const json = (await res.json()) as
          | AnalyticsResponse
          | { ok: false; error: string };
        if (!res.ok || !json.ok) {
          setState({
            kind: "error",
            message: "error" in json ? json.error : `HTTP ${res.status}`
          });
          return;
        }
        setState({ kind: "loaded", data: json });
      } catch (err) {
        setState({ kind: "error", message: (err as Error)?.message ?? "network" });
      }
    },
    [pageId]
  );

  useEffect(() => {
    void load(windowKey);
  }, [load, windowKey]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Analytics"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-200 p-5">
          <div>
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              ◇ Analytics
            </p>
            <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
              How this page is performing
            </h2>
            <p className="mt-1 text-[12px] text-neutral-500">
              Page <span className="font-mono">{pageId}</span> · {windowKey} window
            </p>
          </div>
          <WindowSwitcher current={windowKey} onChange={setWindowKey} />
        </header>

        <div className="p-5">
          {state.kind === "loading" && (
            <p className="text-[13px] font-bold text-neutral-500">Loading…</p>
          )}

          {state.kind === "error" && (
            <p
              role="alert"
              className="rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(220,38,38,0.08)", color: RED }}
            >
              Failed to load · {state.message}
            </p>
          )}

          {state.kind === "loaded" && (
            <AnalyticsBody
              data={state.data}
              onJumpToSection={(id) => {
                if (onJumpToSection) {
                  onJumpToSection(id);
                  onClose();
                }
              }}
            />
          )}
        </div>

        <footer className="flex items-center justify-end border-t border-neutral-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Body ───────────────────────────────────────────────────

function AnalyticsBody({
  data,
  onJumpToSection
}: {
  data: AnalyticsResponse;
  onJumpToSection: (instanceId: string) => void;
}) {
  const { totals, sections } = data;

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          label="Views"
          value={totals.views}
          colour={BLUE}
        />
        <StatTile
          label="Clicks"
          value={totals.clicks}
          colour={YELLOW}
        />
        <StatTile
          label="Conversions"
          value={totals.converts}
          colour={GREEN}
        />
      </div>

      {sections.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-6 text-center">
          <p className="text-[13px] font-extrabold text-neutral-700">
            No traffic yet
          </p>
          <p className="mt-1 text-[12px] text-neutral-500">
            Once customers land on this page, per-section metrics will
            appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Sections by views
          </p>
          <ul className="mt-2 space-y-2">
            {sections.map((s) => (
              <li key={`${s.section_key}::${s.instance_id}`}>
                <SectionRowView
                  row={s}
                  onJump={
                    s.instance_id
                      ? () => onJumpToSection(s.instance_id!)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function WindowSwitcher({
  current,
  onChange
}: {
  current: WindowKey;
  onChange: (w: WindowKey) => void;
}) {
  const options: WindowKey[] = ["7d", "30d", "90d"];
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-neutral-300 bg-white">
      {options.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          className="h-8 px-3 text-[11px] font-extrabold uppercase tracking-widest transition"
          style={{
            background: w === current ? "#0A0A0A" : "#FFFFFF",
            color: w === current ? "#FFFFFF" : "#404040"
          }}
        >
          {w}
        </button>
      ))}
    </div>
  );
}

function StatTile({
  label,
  value,
  colour
}: {
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p
        className="mt-1 text-[22px] font-extrabold"
        style={{ color: colour }}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}

function SectionRowView({
  row,
  onJump
}: {
  row: SectionRow;
  onJump?: () => void;
}) {
  const ctrColour = row.ctr >= 5 ? GREEN : row.ctr >= 1 ? AMBER : RED;
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-extrabold text-neutral-900">
            {row.section_key ?? "(unknown section)"}
          </p>
          <p className="truncate font-mono text-[10px] text-neutral-400">
            {row.instance_id ?? "-"}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-3 text-right">
          <NumberBlock label="Views" value={row.views} />
          <NumberBlock label="Clicks" value={row.clicks} />
          <NumberBlock
            label="CTR"
            value={`${row.ctr}%`}
            colour={ctrColour}
          />
          <NumberBlock
            label="Conv"
            value={row.converts}
            colour={row.converts > 0 ? GREEN : "#404040"}
          />
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <Sparkline daily={row.daily} />
        {onJump && (
          <button
            type="button"
            onClick={onJump}
            className="inline-flex h-8 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
            style={{ background: YELLOW }}
          >
            Jump to section →
          </button>
        )}
      </div>
    </div>
  );
}

function NumberBlock({
  label,
  value,
  colour = "#0A0A0A"
}: {
  label: string;
  value: number | string;
  colour?: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
        {label}
      </p>
      <p className="text-[13px] font-extrabold" style={{ color: colour }}>
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  );
}

function Sparkline({
  daily
}: {
  daily: { day: string; views: number; clicks: number }[];
}) {
  if (daily.length === 0) {
    return (
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
        No daily data
      </p>
    );
  }
  const max = Math.max(...daily.map((d) => d.views), 1);
  const width = 180;
  const height = 32;
  const dx = daily.length === 1 ? 0 : width / (daily.length - 1);
  const points = daily
    .map((d, i) => {
      const x = i * dx;
      const y = height - (d.views / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke={BLUE}
        strokeWidth={2}
        points={points}
      />
    </svg>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
