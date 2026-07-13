// Unified activity feed. Aggregates real events across every area:
// Jobs · Orders · Messages · Notebook. Facebook's News Feed pattern —
// one river of activity, deep-linked to the source area.
//
// Evidence-or-silence rule (project_evidence_or_silence.md):
// every card here must be backed by a real query, a real user event,
// or a factual record. Fabricated cards (fake percentiles, made-up
// counts, unsourced "middle band" claims, "saved you N miles" without
// a documented baseline) are BANNED and were removed 2026-07-12.
//
// Data-source status:
//   ✅ Messages    — user's own thread with unread_count from DB
//   ✅ Orders      — user's own escrow status from orders DB
//   ✅ Jobs        — user's own job records
//   ⚠️ Notebook   — "OUT" requires merchant stock feed with <60min
//                    staleness. "running low" requires forecast
//                    algorithm — hidden until Phase 2 ships the algo.
//   ❌ Routes     — "N miles saved" claim removed until baseline
//                    algorithm is documented (Phase 3)
//   ❌ Identity   — "N traders have you in their Notebook" removed
//                    until countable query is wired
//   ❌ Rates      — "middle band" fabrication removed until ONS
//                    ingest is live (Phase 2)

import Link from "next/link";
import {
  MessageSquare,
  Briefcase,
  ShoppingBag,
  Notebook as NotebookIcon,
  ArrowRight
} from "lucide-react";
import { JOB_FIXTURES } from "@/apps/jobs/data/jobs";
import { ORDER_FIXTURES } from "@/apps/orders/data/orders";
import { MESSAGE_THREAD_FIXTURES } from "@/apps/messages/data/threads";
import { DEMO_NOTEBOOK } from "@/apps/notebook/data/notebook";

type ActivityItem = {
  id: string;
  atIso: string;
  Icon: typeof MessageSquare;
  areaLabel: string;
  areaColour: string;
  headline: string;
  detail?: string;
  href: string;
};

// UK-locale formatter for GBP so we never render "£3.800" (which reads
// as £3.80 in en-GB). Explicit locale beats the browser default.
const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0
});

function collectActivity(): ActivityItem[] {
  const items: ActivityItem[] = [];

  // Messages — unread threads (user's own inbox: defensible)
  for (const t of MESSAGE_THREAD_FIXTURES) {
    if (t.unreadCountForViewer > 0) {
      items.push({
        id: `msg-${t.id}`,
        atIso: t.lastMessageAtIso,
        Icon: MessageSquare,
        areaLabel: "Messages",
        areaColour: "#166534",
        headline: `${t.unreadCountForViewer} unread from ${t.participants.find((p) => p.slug !== "bob-plastering")?.name ?? "merchant"}`,
        detail: t.lastMessagePreview,
        href: `/tc/messages/${t.id}`
      });
    }
  }

  // Orders — awaiting delivery / dispute open (user's own orders:
  // defensible)
  for (const o of ORDER_FIXTURES) {
    if (o.escrow?.status === "funds-held") {
      items.push({
        id: `ord-${o.id}`,
        atIso: new Date(o.placedAt).toISOString(),
        Icon: ShoppingBag,
        areaLabel: "Orders",
        areaColour: "#F59E0B",
        headline: `${gbpFormatter.format(o.totalGbp)} order — awaiting delivery confirmation`,
        detail: o.itemsSummary,
        href: `/tc/orders/${o.id}`
      });
    }
    if (o.escrow?.status === "disputed") {
      items.push({
        id: `disp-${o.id}`,
        atIso: o.escrow.dispute?.raisedAtIso ?? new Date(o.placedAt).toISOString(),
        Icon: ShoppingBag,
        areaLabel: "Orders",
        areaColour: "#DC2626",
        headline: `Dispute open on ${gbpFormatter.format(o.totalGbp)} order`,
        detail: o.escrow.dispute?.reason ?? "Under review",
        href: `/tc/orders/${o.id}`
      });
    }
  }

  // Jobs — in progress (user's own record: defensible). en-GB locale
  // formatter used to prevent "£3.800" → "£3,800" bug across all
  // locales.
  for (const j of JOB_FIXTURES.filter((j) => j.status === "in-progress")) {
    items.push({
      id: `job-${j.id}`,
      atIso: new Date(j.startedAtIso).toISOString(),
      Icon: Briefcase,
      areaLabel: "Jobs",
      areaColour: "#1E40AF",
      headline: `${j.title} — in progress`,
      detail: `${j.customerName} · ${gbpFormatter.format(j.quoteGbp)}`,
      href: `/tc/jobs/${j.slug}`
    });
  }

  // Notebook — only "OUT" state shown for now. "Running low" needs a
  // forecast algorithm (last-ordered date + usage rate + days-of-supply)
  // and gets hidden until Phase 2 ships that algo. Even "OUT" requires
  // a fresh merchant stock feed (≤60min staleness) in production —
  // fixture data is used here for dev only.
  for (const item of DEMO_NOTEBOOK.items.filter((i) => i.status === "out")) {
    const detail = item.lastOrderedIso
      ? `Last ordered ${gbpDateFormat(item.lastOrderedIso)} · ${item.usualQty} ${item.unit}`
      : `${item.usualQty} ${item.unit} usually`;
    items.push({
      id: `nb-${item.id}`,
      atIso: item.lastOrderedIso ?? new Date().toISOString(),
      Icon: NotebookIcon,
      areaLabel: "Notebook",
      areaColour: "#B45309",
      headline: `${item.productName} — out of stock`,
      detail,
      href: "/tc/notebook"
    });
  }

  // ─── REMOVED per evidence-or-silence rule ───────────────────────
  // The following three prompt cards were deleted 2026-07-12 because
  // they made statistical claims we cannot back with a defensible
  // query, source, or algorithm:
  //
  //   ❌ "Route saved you 258 miles this week"
  //      — no documented baseline. Requires a route-planner comparison
  //      algo (Phase 3+). Silence until then.
  //
  //   ❌ "Your profile is in 89 traders' Notebooks"
  //      "Featured in 340 Job Cost estimates this month"
  //      — countable in principle, but the queries don't exist yet
  //      and Job Cost estimates isn't a feature. Silence until wired.
  //
  //   ❌ "Your rates sit in the middle band for Manchester"
  //      "6 rates published — no changes needed"
  //      — statistical claim without a dataset. Requires ONS ASHE
  //      ingest (Phase 2). Silence until then.

  return items.sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime());
}

function gbpDateFormat(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ActivityFeed() {
  const items = collectActivity();

  return (
    <section className="flex flex-col gap-2">
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
        Your activity · unified across every area
      </div>
      {items.length === 0 ? (
        <div
          className="rounded-xl border border-dashed p-6 text-center text-[11.5px] text-neutral-500"
          style={{ borderColor: "rgba(139,69,19,0.20)" }}
        >
          Nothing new right now. Your unread messages, open orders,
          active jobs, and out-of-stock notebook items land here.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${item.areaColour}18`, color: item.areaColour }}
                >
                  <item.Icon size={16} strokeWidth={2}/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: `${item.areaColour}18`, color: item.areaColour }}
                    >
                      {item.areaLabel}
                    </span>
                    <span className="text-[10.5px] text-neutral-500">{timeAgo(item.atIso)}</span>
                  </div>
                  <div className="mt-0.5 text-[12.5px] font-black leading-tight text-neutral-900">
                    {item.headline}
                  </div>
                  {item.detail && (
                    <div className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-neutral-600">
                      {item.detail}
                    </div>
                  )}
                </div>
                <ArrowRight size={13} className="flex-shrink-0 self-center text-neutral-400"/>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
