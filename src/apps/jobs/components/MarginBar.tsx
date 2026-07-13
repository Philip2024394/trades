// Live Margin Bar — the "am I making money?" pulse indicator.
//
// One glance answers the question. Colour is the signal, number is the
// evidence. When the trade adds a new cost line, this bar re-renders
// instantly — reinforcing that costs eat margin in real time.

import { TrendingDown, TrendingUp, AlertTriangle, PoundSterling } from "lucide-react";
import { colourForStatus, formatGbp, type MarginSnapshot } from "../lib/margin";

type Props = {
  snapshot: MarginSnapshot;
  /** Compact = one-line variant used inside job list rows. */
  compact?: boolean;
};

export function MarginBar({ snapshot, compact }: Props) {
  const c = colourForStatus(snapshot.status);
  const spentPct = Math.min(
    100,
    Math.max(0, (snapshot.incurredCostsGbp / snapshot.quoteGbp) * 100)
  );
  const Icon =
    snapshot.status === "loss" || snapshot.status === "risk"
      ? TrendingDown
      : snapshot.status === "thin"
        ? AlertTriangle
        : TrendingUp;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full"
          style={{ backgroundColor: "#F5F0E4" }}
        >
          <div
            className="h-full transition-all"
            style={{ width: `${spentPct}%`, backgroundColor: c.bg }}
          />
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
          style={{ backgroundColor: c.bg, color: c.fg }}
        >
          <Icon size={10} strokeWidth={2.5}/>
          {c.label} · {snapshot.netMarginPct.toFixed(0)}%
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFFFF" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Live margin
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[28px] font-black leading-none text-neutral-900">
              {formatGbp(snapshot.netMarginGbp)}
            </span>
            <span className="text-[13px] font-bold text-neutral-500">
              {snapshot.netMarginPct.toFixed(1)}%
            </span>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider"
          style={{ backgroundColor: c.bg, color: c.fg }}
        >
          <Icon size={12} strokeWidth={2.5}/>
          {c.label}
        </span>
      </div>

      {/* Progress bar — spent as % of quote */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[10.5px] font-bold text-neutral-500">
          <span>
            Spent {formatGbp(snapshot.incurredCostsGbp)} of {formatGbp(snapshot.quoteGbp)}
          </span>
          <span>{spentPct.toFixed(0)}%</span>
        </div>
        <div
          className="mt-1 h-3 overflow-hidden rounded-full"
          style={{ backgroundColor: "#F5F0E4" }}
        >
          <div
            className="h-full transition-all"
            style={{ width: `${spentPct}%`, backgroundColor: c.bg }}
          />
        </div>
      </div>

      {/* Two sub-meters — materials and labour */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SubMeter
          label="Materials budget"
          spent={snapshot.materialsSpentGbp}
          budget={snapshot.materialsBudgetGbp}
          pct={snapshot.materialsUsedPct}
          warn={snapshot.materialsWarn}
        />
        <SubMeter
          label="Labour budget"
          spent={snapshot.labourSpentGbp}
          budget={snapshot.labourBudgetGbp}
          pct={snapshot.labourUsedPct}
          warn={snapshot.labourUsedPct > 100}
        />
      </div>

      {/* Rock-solid warning band. Materials over 85% of budget is the
          single strongest predictor of an unprofitable job — surface it
          before the trade quotes another one. */}
      {snapshot.materialsWarn && (
        <div
          className="mt-4 flex items-start gap-2 rounded-md p-2.5 text-[11px] leading-snug"
          style={{ backgroundColor: "#FEF3C7", color: "#78350F" }}
        >
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0"/>
          <span>
            Materials are at {snapshot.materialsUsedPct.toFixed(0)}% of the budgeted
            {" "}{formatGbp(snapshot.materialsBudgetGbp)}. Check your remaining
            quote covers labour and overhead before ordering more.
          </span>
        </div>
      )}
    </div>
  );
}

function SubMeter({
  label,
  spent,
  budget,
  pct,
  warn
}: {
  label: string;
  spent: number;
  budget: number;
  pct: number;
  warn?: boolean;
}) {
  const barColour = pct > 100 ? "#DC2626" : pct > 85 ? "#F59E0B" : "#166534";
  const bounded = Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div className="flex items-baseline justify-between text-[10.5px] font-bold text-neutral-500">
        <span>{label}</span>
        <span className={warn ? "text-amber-600" : ""}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "#F5F0E4" }}
      >
        <div
          className="h-full transition-all"
          style={{ width: `${bounded}%`, backgroundColor: barColour }}
        />
      </div>
      <div className="mt-1 flex items-center gap-1 text-[10px] text-neutral-600">
        <PoundSterling size={9}/>
        {formatGbp(spent)} of {formatGbp(budget)}
      </div>
    </div>
  );
}
