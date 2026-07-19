// HomeCareCard — right-panel reminders tile.
//
// Answers ONE question: "What needs looking after?"
// Renders top 1-3 upcoming Home Care items with a one-tap "Rebook"
// or "Find someone" action per item.
//
// Rule 1 (Questions not features): the card asks/answers a single
// intent — no dashboards, no filters, no toggles.
// Rule 2 (Replace work): eliminates the "did I forget about the
// boiler?" mental load. Books the trade in 2 taps.
// Rule 3 (Hide, don't delete): empty state is quiet — no reminders
// yet? we say so gently, no "come and add items!" nagging.
//
// See docs/SITEBOOK_BLUEPRINT_v2_2_FINAL.md · Phase 1 · Slot 1.

import Link from "next/link";
import { Wrench, Flame, Droplets, Wind, Zap, ShieldCheck, ChevronRight, CheckCircle2 } from "lucide-react";
import type { HomeCareItem, HomeCareKind } from "@/lib/homeowners/homeCare";
import { dueLabel } from "@/lib/homeowners/homeCare";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

const KIND_ICON: Record<HomeCareKind, typeof Flame> = {
  boiler_service:       Flame,
  gas_safety:           Flame,
  gutter_clean:         Droplets,
  drain_rod:            Droplets,
  septic_empty:         Droplets,
  chimney_sweep:        Wind,
  window_clean:         Wind,
  smoke_alarm_battery:  ShieldCheck,
  alarm_service:        ShieldCheck,
  eicr:                 Zap,
  pat_test:             Zap,
  roof_inspection:      Wrench,
  other:                Wrench
};

const TONE_STYLE = {
  overdue: { bg: "#FEF2F2", fg: "#991B1B", chip: "#DC2626" },
  soon:    { bg: "#FEF3C7", fg: "#92400E", chip: "#F59E0B" },
  later:   { bg: "#F5F5F5", fg: "#525252", chip: "#737373" }
} as const;

export function HomeCareCard({ items }: { items: HomeCareItem[] }) {
  return (
    <div
      className="rounded-2xl border-2 bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="mb-3">
        <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Home Care
        </p>
      </div>

      {items.length === 0 ? (
        // Empty state — quiet, no nagging
        <div className="rounded-xl bg-neutral-50 px-3 py-4 text-center">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500"
            style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
          >
            <CheckCircle2 size={16} strokeWidth={2.4}/>
          </span>
          <p className="mt-2 text-[12.5px] font-black text-neutral-900">
            Nothing due
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">
            We&rsquo;ll ping you here when boiler services, gutter cleans and other seasonal jobs come round.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind] ?? Wrench;
            const due  = dueLabel(item.next_due_at);
            const tone = TONE_STYLE[due.tone];
            return (
              <li key={item.id}>
                <div className="rounded-xl border p-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: "rgba(255,179,0,0.15)", color: "#B45309" }}
                    >
                      <Icon size={15} strokeWidth={2.4}/>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-neutral-900">{item.title}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className="inline-flex h-5 items-center rounded-full px-1.5 text-[9.5px] font-black uppercase tracking-wider"
                          style={{ backgroundColor: tone.bg, color: tone.fg }}
                        >
                          <span
                            className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: tone.chip }}
                            aria-hidden
                          />
                          {due.label}
                        </span>
                      </div>
                      {item.description && (
                        <p className="mt-1.5 text-[11.5px] leading-snug text-neutral-600">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* One-tap action — rebook previous trade, or find a
                      fresh one via Trade Circle in invite mode. */}
                  <div className="mt-2.5">
                    {item.previous_trade_slug && item.previous_trade_name ? (
                      <Link
                        href={`/trade-off/yard/canteens/${item.previous_trade_slug}`}
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95"
                        style={{ backgroundColor: BRAND_GREEN }}
                      >
                        Rebook {item.previous_trade_name}
                        <ChevronRight size={11} strokeWidth={2.5}/>
                      </Link>
                    ) : (
                      <Link
                        href="/trade-off/yard/canteens"
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95"
                        style={{ backgroundColor: BRAND_YELLOW }}
                      >
                        Find someone
                        <ChevronRight size={11} strokeWidth={2.5}/>
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
