// /tc/hub — Trade Center Hub.
//
// The Facebook-style front door for the whole product. Universal
// Composer at the top (dropdown selects post type, body morphs). Unified
// activity feed below (jobs / orders / messages / notebook / rates
// aggregated as one river).
//
// "Fill once" principle: the composer's identity header reads the shared
// SUI (Single User Identity) — the trade only ever types the tier-3
// content-specific fields.
//
// Trade-only surface per feedback_trade_features_trade_only.md —
// TradeAuthGuard redirects DIY viewers off /tc/hub.

import Link from "next/link";
import {
  ArrowLeft,
  Route as RouteIcon,
  Briefcase,
  PoundSterling,
  ShoppingBag,
  Notebook as NotebookIcon,
  MessageSquare,
  ShieldCheck,
  Users,
  Bell,
  Store,
  ShoppingCart,
  Handshake,
  Newspaper,
  Building2,
  Home
} from "lucide-react";
import { HowItWorksButton } from "@/apps/hub/components/HowItWorksButton";
import { PagePersonaBadge } from "@/apps/hub/components/PagePersonaBadge";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { UniversalComposer } from "@/apps/hub/components/UniversalComposer";
import { ActivityFeed } from "@/apps/hub/components/ActivityFeed";
import { NetworkFeedCard } from "@/apps/social/components/NetworkFeedCard";
import { FEED_POST_FIXTURES } from "@/apps/social/data/socialGraph";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

export const dynamic = "force-dynamic";

type QuickAction = {
  href: string;
  label: string;
  Icon: typeof Store;
  colour: string;
  external?: boolean;
};

// Grouped quick actions — every major area of Thenetworkers reachable
// from Hub in one tap. Groups keep the grid scannable rather than
// dumping 10+ icons in a flat row.
const BUY_ACTIONS: QuickAction[] = [
  { href: "/tc/trade-center", label: "Trade Center", Icon: Store,        colour: "#0A0A0A" },
  { href: "/tc/cart",         label: "Cart",         Icon: ShoppingCart, colour: "#F59E0B" },
  { href: "/tc/notebook",     label: "Notebook",     Icon: NotebookIcon, colour: "#B45309" },
  { href: "/tc/orders",       label: "Orders",       Icon: ShoppingBag,  colour: "#F59E0B" }
];

const WORK_ACTIONS: QuickAction[] = [
  { href: "/tc/jobs",     label: "Jobs",     Icon: Briefcase,     colour: "#1E40AF" },
  { href: "/tc/messages", label: "Messages", Icon: MessageSquare, colour: "#166534" },
  { href: "/tc/rates",    label: "Rates",    Icon: PoundSterling, colour: "#B45309" },
  { href: "/tc/routes",   label: "Routes",   Icon: RouteIcon,     colour: "#525252" }
];

const SOCIAL_ACTIONS: QuickAction[] = [
  { href: "/trade-off/yard",  label: "The Yard",     Icon: Newspaper, colour: "#0A0A0A", external: true },
  { href: "/tc/trade-counter", label: "Trade Counter", Icon: Handshake, colour: "#F59E0B" }
];

const IDENTITY_ACTIONS: QuickAction[] = [
  { href: "/tc/identity",       label: "Trade Identity", Icon: ShieldCheck, colour: "#166534" },
  { href: "/tc/merchant-admin", label: "Studio",         Icon: Building2,   colour: "#EC4899" }
];

export default function HubPage() {
  const identity = currentViewerTrade();

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-5 md:px-6 md:py-8">
        {/* Back navigation — routes to Trade Center browse (the
            canonical landing). Users can also use browser back for
            more specific history. */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/tc/trade-center"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <ArrowLeft size={12}/>
            Back to Trade Center
          </Link>
          <Link
            href="/tc/notebook"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <NotebookIcon size={12}/>
            Notebook
          </Link>
          <Link
            href="/trade-off/yard"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Newspaper size={12}/>
            The Yard
          </Link>
        </div>

        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Trade Center · Hub
            </div>
            <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
              One post box. Every area.
            </h1>
            <p className="mt-1 text-[12.5px] leading-snug text-neutral-600 md:text-[13px]">
              Compose posts for Yard, Trade Counter, or Rates from one box.
              Jump to any area below. Your identity fills every form.
            </p>
          </div>
          <div className="flex-shrink-0">
            <HowItWorksButton topic="hub"/>
          </div>
        </header>
        <PagePersonaBadge persona="trade" label="Hub · Trade"/>

        {/* Universal Composer — the hero */}
        <UniversalComposer identity={identity}/>

        {/* Quick actions — grouped by intent so trades find what they
            want without scanning a flat row of 10 icons. */}
        <section className="flex flex-col gap-5">
          <QuickActionGroup label="Buy"      actions={BUY_ACTIONS}/>
          <QuickActionGroup label="Work"     actions={WORK_ACTIONS}/>
          <QuickActionGroup label="Social"   actions={SOCIAL_ACTIONS}/>
          <QuickActionGroup label="Identity" actions={IDENTITY_ACTIONS}/>
        </section>

        {/* Feed — two columns on desktop: "From your network" primary,
            "Your activity" sidebar */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Users size={13} className="text-neutral-700"/>
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                From your network
              </div>
            </div>
            <ul className="flex flex-col gap-4">
              {FEED_POST_FIXTURES.map((post) => (
                <li key={post.id}>
                  <NetworkFeedCard post={post}/>
                </li>
              ))}
            </ul>
          </section>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <div className="mb-1 flex items-center gap-2">
              <Bell size={12} className="text-neutral-700"/>
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Your activity
              </div>
            </div>
            <ActivityFeed/>
          </aside>
        </div>
      </main>
    </div>
  );
}

function QuickActionGroup({
  label,
  actions
}: {
  label: string;
  actions: QuickAction[];
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
        {label}
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {actions.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
              target={a.external ? "_self" : undefined}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `${a.colour}18`, color: a.colour }}
              >
                <a.Icon size={16} strokeWidth={2}/>
              </div>
              <div className="text-[10.5px] font-black text-neutral-900">{a.label}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
