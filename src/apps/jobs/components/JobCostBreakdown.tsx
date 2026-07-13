// Job cost breakdown — per-category totals + the individual cost line
// list. Trade Center is the trade's ledger for this job. Nothing here
// is published anywhere.

import Link from "next/link";
import {
  Hammer,
  ShoppingBag,
  Truck,
  Trash2,
  Users,
  Cog,
  Circle,
  PoundSterling
} from "lucide-react";
import { formatGbp } from "../lib/margin";
import type { CostCategory, JobCostLine } from "../data/jobs";

type Props = {
  costLines: JobCostLine[];
  perCategory: Record<CostCategory, number>;
  overheadAllocationGbp?: number;
};

function categoryLabel(cat: CostCategory): string {
  switch (cat) {
    case "materials":     return "Materials";
    case "labour":        return "Labour";
    case "subcontractor": return "Subcontractor";
    case "transport":     return "Transport";
    case "waste":         return "Waste";
    case "hire":          return "Plant hire";
    case "overhead":      return "Overhead";
    case "other":         return "Other";
  }
}

function iconForCategory(cat: CostCategory) {
  switch (cat) {
    case "materials":     return ShoppingBag;
    case "labour":        return Hammer;
    case "subcontractor": return Users;
    case "transport":     return Truck;
    case "waste":         return Trash2;
    case "hire":          return Cog;
    case "overhead":      return PoundSterling;
    case "other":         return Circle;
  }
}

export function JobCostBreakdown({ costLines, perCategory, overheadAllocationGbp }: Props) {
  const categoriesInPlay = (Object.entries(perCategory) as Array<[CostCategory, number]>)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div
      className="rounded-xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
        Cost breakdown
      </div>

      {/* Category summary */}
      <ul className="mt-2 flex flex-col divide-y" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        {categoriesInPlay.map(([cat, total]) => {
          const Icon = iconForCategory(cat);
          return (
            <li key={cat} className="flex items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-2 text-[12px] font-bold text-neutral-800">
                <Icon size={13} className="text-neutral-500"/>
                {categoryLabel(cat)}
              </div>
              <div className="text-[13px] font-black text-neutral-900">
                {formatGbp(total)}
              </div>
            </li>
          );
        })}
        {overheadAllocationGbp !== undefined && overheadAllocationGbp > 0 && (
          <li className="flex items-center justify-between gap-3 py-2">
            <div className="flex items-center gap-2 text-[12px] font-bold text-neutral-800">
              <PoundSterling size={13} className="text-neutral-500"/>
              Overhead allocation
              <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-600">
                Auto
              </span>
            </div>
            <div className="text-[13px] font-black text-neutral-900">
              {formatGbp(overheadAllocationGbp)}
            </div>
          </li>
        )}
      </ul>

      {/* Line-item detail */}
      <div className="mt-4 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
        Cost lines ({costLines.length})
      </div>
      <ul className="mt-2 flex flex-col divide-y" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        {costLines.length === 0 && (
          <li className="py-3 text-center text-[11.5px] text-neutral-500">
            No cost lines yet. Add materials, labour, or subs to see live margin.
          </li>
        )}
        {costLines.map((line) => {
          const Icon = iconForCategory(line.category);
          return (
            <li key={line.id} className="flex items-start gap-2 py-2">
              <Icon size={12} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0 truncate text-[12px] font-bold text-neutral-800">
                    {line.description}
                  </div>
                  <div className="flex-shrink-0 text-[12px] font-black text-neutral-900">
                    {formatGbp(line.totalGbp)}
                  </div>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[10.5px] text-neutral-500">
                  {line.quantity !== undefined && line.unit && (
                    <span>
                      {line.quantity} {line.unit}
                      {line.unitCostGbp && ` × ${formatGbp(line.unitCostGbp)}`}
                    </span>
                  )}
                  {line.supplier && line.merchantSlug ? (
                    <Link
                      href={`/tc/trade-center/merchant/${line.merchantSlug}`}
                      className="hover:underline"
                    >
                      {line.supplier}
                    </Link>
                  ) : line.supplier ? (
                    <span>{line.supplier}</span>
                  ) : null}
                  <span>{new Date(line.incurredAtIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
