// SimpleBudgetCard — one card, one bar per project.
//
// Answers ONE question: "How much has each project cost, and what's
// left?" — no line items, no charts, no filters. Plain English.
//
// Rules:
//   1 · Questions not features
//   2 · Replaces the "am I over budget?" mental load + spreadsheet
//   3 · Line-item power view is a Pro-tier upgrade (hidden until earned)
//
// Blueprint: docs/SITEBOOK_BLUEPRINT_v2_2_FINAL.md · Phase 1 · Slot 2.

import Link from "next/link";
import { Wallet, ChevronRight } from "lucide-react";
import type { ProjectBudget } from "@/lib/homeowners/budget";
import { formatGbp } from "@/lib/homeowners/budget";

const TONE_STYLE = {
  healthy: { bar: "#22C55E", chipBg: "#DCFCE7", chipFg: "#166534" },
  watch:   { bar: "#F59E0B", chipBg: "#FEF3C7", chipFg: "#92400E" },
  over:    { bar: "#DC2626", chipBg: "#FEE2E2", chipFg: "#991B1B" }
} as const;

export function SimpleBudgetCard({ budgets }: { budgets: ProjectBudget[] }) {
  return (
    <div
      className="rounded-2xl border-2 bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Budgets
        </p>
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
          {budgets.length} project{budgets.length === 1 ? "" : "s"}
        </span>
      </div>

      {budgets.length === 0 ? (
        <div className="rounded-xl bg-neutral-50 px-3 py-4 text-center">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500"
            style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
          >
            <Wallet size={16} strokeWidth={2.4}/>
          </span>
          <p className="mt-2 text-[12.5px] font-black text-neutral-900">
            No budget set
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">
            Add a budget to any project and we&rsquo;ll track spend against it, quietly.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {budgets.map((b) => {
            const t   = TONE_STYLE[b.tone];
            const pct = Math.min(100, b.percent);
            return (
              <li key={b.projectId}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-black text-neutral-900">{b.title}</p>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider tabular-nums"
                    style={{ backgroundColor: t.chipBg, color: t.chipFg }}
                  >
                    {b.percent}%
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-neutral-600 tabular-nums">
                  <span className="font-black text-neutral-900">{formatGbp(b.spentPence)}</span>
                  <span className="text-neutral-500"> of {formatGbp(b.targetPence)}</span>
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100" aria-hidden>
                  <div
                    className="h-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: t.bar }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pro-tier upgrade link — line-item power view lives here later.
          Kept as a discreet "See detail" link, never a full paywall. */}
      {budgets.length > 0 && (
        <Link
          href="/sitebook/budgets"
          className="mt-3 inline-flex w-full items-center justify-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          See detail
          <ChevronRight size={11} strokeWidth={2.5}/>
        </Link>
      )}
    </div>
  );
}
