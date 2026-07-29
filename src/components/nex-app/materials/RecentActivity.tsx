// RecentActivity — day-grouped feed of recent Materials activity.
// Server component reads live data from the audit log via
// loadRecentActivity. Rendered under the Ask NEX hero on the Materials
// landing.

import Link from "next/link";
import { CheckCircle2, Info, AlertTriangle, Truck, ChevronRight } from "lucide-react";
import { MT } from "./_tokens";
import type { ActivityGroup, ActivityItem } from "@/apps/materials/_services/recent_activity";

/** Header row shown above every Recent Activity variant — includes the
 *  "View suppliers" affordance on the right so suppliers stay one tap
 *  away without cluttering the module-card grid. */
function ActivityHeader() {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: MT.secondaryGrey }}>
        Recent activity
      </div>
      <Link
        href="/nex-app/materials/suppliers"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-transform active:scale-95"
        style={{ color: MT.primary, background: MT.primarySoft, border: `1px solid ${MT.primaryBorder}` }}
      >
        <Truck size={12} strokeWidth={2.25} />
        View suppliers
        <ChevronRight size={11} strokeWidth={2.25} />
      </Link>
    </div>
  );
}

export function RecentActivity({ groups }: { groups: ActivityGroup[] }) {
  if (groups.length === 0) {
    return (
      <section className="mt-6">
        <div className="mb-3">
          <ActivityHeader />
        </div>
        <div
          className="px-5 py-6 text-center"
          style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, borderRadius: MT.radiusLg, boxShadow: MT.shadowSoft }}
        >
          <p className="text-[13px]" style={{ color: MT.secondaryGrey }}>
            Nothing to show yet. Tell NEX what you&apos;ve received above and it&apos;ll start showing here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-3">
        <ActivityHeader />
      </div>
      <div
        className="overflow-hidden"
        style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, borderRadius: MT.radiusLg, boxShadow: MT.shadowSoft }}
      >
        {groups.map((g, gi) => (
          <div key={g.label}>
            <div
              className="px-4 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: MT.secondaryGrey, background: gi === 0 ? "transparent" : MT.bg }}
            >
              {g.label}
            </div>
            {g.items.map((it) => (
              <ActivityRow key={it.id} item={it} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const inner = (
    <>
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
        style={{
          background: item.emphasis === "warn" ? "#FBE3E3" : item.emphasis === "info" ? "#E4EEFB" : "#E6F5EA",
          color:      item.emphasis === "warn" ? "#B91C1C" : item.emphasis === "info" ? "#1E5FBF" : "#2E7D3D",
        }}
      >
        {item.emphasis === "warn" ? <AlertTriangle size={16} strokeWidth={2} />
          : item.emphasis === "info" ? <Info size={16} strokeWidth={2} />
          : <CheckCircle2 size={16} strokeWidth={2} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold leading-tight" style={{ color: MT.darkGrey }}>
          {item.headline}
        </div>
        {item.detail && (
          <div className="mt-0.5 truncate text-[12px] italic" style={{ color: MT.secondaryGrey }}>
            {item.detail}
          </div>
        )}
        <div className="mt-1 text-[11px]" style={{ color: MT.secondaryGrey }}>
          {formatTime(item.occurred_at)}
        </div>
      </div>
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="flex items-start gap-3 border-t px-4 py-3 transition-colors hover:bg-black/[0.015]"
        style={{ borderColor: MT.borderLight }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div
      className="flex items-start gap-3 border-t px-4 py-3"
      style={{ borderColor: MT.borderLight }}
    >
      {inner}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
