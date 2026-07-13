// DashboardRail — persistent right-edge access to the user's backend on
// every page. Facebook/LinkedIn pattern: never more than one tap away
// from your identity, your stats, your inbox, your orders.
//
// Two states:
//   1. Collapsed (default) — narrow vertical rail on the right edge,
//      icon-only. Small enough not to eat main content width.
//   2. Expanded (tap to open) — slide-in drawer with identity summary
//      + key stats + quick-jump nav grid + "Full dashboard" CTA.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronLeft,
  X,
  ShieldCheck,
  Briefcase,
  ShoppingBag,
  MessageSquare,
  Notebook as NotebookIcon,
  PoundSterling,
  Route as RouteIcon,
  Store,
  User,
  LayoutDashboard
} from "lucide-react";
import { currentViewerTrade, countVerifiedLayers } from "@/apps/identity/data/tradeIdentities";
import { computeMerchantStats } from "@/apps/merchant/lib/merchantStats";
import { MESSAGE_THREAD_FIXTURES } from "@/apps/messages/data/threads";
import { JOB_FIXTURES } from "@/apps/jobs/data/jobs";
import { ORDER_FIXTURES } from "@/apps/orders/data/orders";

const QUICK_NAV = [
  { href: "/tc/hub",           label: "Hub",         Icon: LayoutDashboard, colour: "#166534" },
  { href: "/tc/identity",      label: "Identity",    Icon: ShieldCheck,     colour: "#166534" },
  { href: "/tc/messages",      label: "Messages",    Icon: MessageSquare,   colour: "#166534" },
  { href: "/tc/jobs",          label: "Jobs",        Icon: Briefcase,       colour: "#1E40AF" },
  { href: "/tc/orders",        label: "Orders",      Icon: ShoppingBag,     colour: "#F59E0B" },
  { href: "/tc/notebook",      label: "Notebook",    Icon: NotebookIcon,    colour: "#B45309" },
  { href: "/tc/rates",         label: "Rate Card",   Icon: PoundSterling,   colour: "#B45309" },
  { href: "/tc/routes",        label: "Routes",      Icon: RouteIcon,       colour: "#0A0A0A" }
];

export function DashboardRail() {
  const [open, setOpen] = useState(false);
  const identity = currentViewerTrade();
  const verified = countVerifiedLayers(identity);

  // Derive quick stats (works whether user is trade, merchant, or both).
  const unreadMessages = MESSAGE_THREAD_FIXTURES.filter((t) =>
    t.participants.some((p) => p.slug === identity.slug)
  ).reduce((s, t) => s + t.unreadCountForViewer, 0);
  const jobsInProgress = JOB_FIXTURES.filter(
    (j) => j.ownerTradeSlug === identity.slug && j.status === "in-progress"
  ).length;
  const orderCount = ORDER_FIXTURES.length;
  const merchantStats = computeMerchantStats("manchester-tools-direct");
  const followerCount = merchantStats.followerCount;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // ─── Collapsed rail ───────────────────────────────────────────────
  return (
    <>
      {/* Fixed right-edge rail — small enough to not eat main content. */}
      <aside
        className="fixed right-0 top-1/2 z-20 -translate-y-1/2"
        aria-label="Dashboard access"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="group flex items-center gap-1 rounded-l-2xl border py-3 pl-2 pr-1.5 shadow-lg backdrop-blur transition-transform hover:-translate-x-0.5"
          style={{
            backgroundColor: "#0A0A0A",
            color: "#FFB300",
            borderColor: "rgba(255,179,0,0.3)"
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              aria-hidden
            >
              {identity.headshotInitials}
            </div>
            <div
              className="rotate-180 text-[9px] font-black uppercase tracking-[0.16em]"
              style={{ writingMode: "vertical-rl", color: "#FFB300" }}
            >
              Dashboard
            </div>
          </div>
          <ChevronLeft size={12} className="opacity-60 group-hover:opacity-100"/>
        </button>
      </aside>

      {/* ─── Expanded drawer ───────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Your dashboard"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close dashboard"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
          >
            {/* Header */}
            <header
              className="flex items-center justify-between border-b p-4"
              style={{
                backgroundColor: "#0A0A0A",
                color: "#FFFFFF",
                borderColor: "rgba(255,179,0,0.3)"
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-black"
                  style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                  aria-hidden
                >
                  {identity.headshotInitials}
                </div>
                <div>
                  <div className="text-[13px] font-black">{identity.displayName}</div>
                  <div className="mt-0.5 text-[10.5px]" style={{ color: "rgba(255,179,0,0.85)" }}>
                    {identity.tradeType}
                  </div>
                  <div
                    className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                    style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
                  >
                    <ShieldCheck size={9} strokeWidth={2.5}/>
                    Verified {verified}/8
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
                aria-label="Close"
              >
                <X size={16}/>
              </button>
            </header>

            {/* Stat tiles */}
            <section className="grid grid-cols-2 gap-3 p-4">
              <StatTile label="Unread messages" value={unreadMessages.toString()} href="/tc/messages" colour="#166534"/>
              <StatTile label="Jobs in progress" value={jobsInProgress.toString()} href="/tc/jobs" colour="#1E40AF"/>
              <StatTile label="Orders live"     value={orderCount.toString()}     href="/tc/orders" colour="#F59E0B"/>
              <StatTile label="Followers"       value={followerCount.toLocaleString()} href={`/tc/trade/${identity.slug}`} colour="#B45309"/>
            </section>

            {/* Full dashboard CTAs */}
            <section className="px-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Full dashboards
              </div>
              <div className="grid grid-cols-2 gap-2">
                <DashboardCta
                  href="/tc/hub"
                  Icon={LayoutDashboard}
                  label="Trade Hub"
                  detail="Composer + activity + feed"
                  onClose={() => setOpen(false)}
                />
                <DashboardCta
                  href="/tc/merchant-admin"
                  Icon={Store}
                  label="Merchant Admin"
                  detail="Revenue + orders + insights"
                  onClose={() => setOpen(false)}
                />
              </div>
            </section>

            {/* Quick nav */}
            <section className="px-4 pt-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Jump to
              </div>
              <ul className="grid grid-cols-3 gap-2">
                {QUICK_NAV.map((n) => (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border bg-white p-2 shadow-sm transition hover:shadow-md"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    >
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${n.colour}18`, color: n.colour }}
                      >
                        <n.Icon size={14} strokeWidth={2}/>
                      </div>
                      <div className="text-[9.5px] font-black text-center text-neutral-900">
                        {n.label}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* Public profile + sign out row */}
            <section className="mt-auto border-t p-4" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
              <Link
                href={`/tc/trade/${identity.slug}`}
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border bg-white text-[11.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <User size={13}/>
                View public profile
                <ChevronRight size={12}/>
              </Link>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}

function StatTile({
  label,
  value,
  href,
  colour
}: {
  label: string;
  value: string;
  href: string;
  colour: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl border p-3 shadow-sm transition hover:shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="text-[9.5px] font-black uppercase tracking-wider" style={{ color: colour }}>
        {label}
      </div>
      <div className="text-[22px] font-black text-neutral-900">{value}</div>
    </Link>
  );
}

function DashboardCta({
  href,
  Icon,
  label,
  detail,
  onClose
}: {
  href: string;
  Icon: typeof LayoutDashboard;
  label: string;
  detail: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-start gap-3 rounded-xl border p-3 shadow-sm transition hover:shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
      >
        <Icon size={16} strokeWidth={2}/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-black text-neutral-900">{label}</div>
        <div className="mt-0.5 text-[10px] leading-snug text-neutral-500">{detail}</div>
      </div>
    </Link>
  );
}
