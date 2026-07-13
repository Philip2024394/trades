"use client";

// Thenetworkers — persistent app shell.
//
// Wraps every "in-network" surface (Yard, prices, discover, dashboards)
// so signed-in trades never feel like they're navigating between
// different products. Same top bar. Same bottom nav on mobile. Same
// avatar drawer for management actions.
//
// The pattern: DASHBOARD SURFACES ARE OVERLAYS, not pages. When a
// trade taps "Prices" from the avatar drawer, the URL changes for
// deep-linkability, but the visual context is a slide-over over the
// current view — not a jump to a different section of the site.
//
// Positioning: this is what makes "the network" feel like one product
// instead of five bolted-on features.

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Bell,
  User,
  Home,
  Radio,
  Users,
  Compass,
  X,
  Menu,
  Settings,
  DollarSign,
  MessageCircle,
  Rocket,
  LogOut,
  ShoppingBag,
  Tag,
  Users2,
  Globe,
  Sparkles,
  ExternalLink,
  BarChart3,
  Wrench
} from "lucide-react";

type Auth = { slug: string; token: string };

const CHAT_AVATAR_IMAGE =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2002_57_40%20PM.png";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [auth, setAuth] = useState<Auth | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug");
    const token = sp.get("token");
    if (slug && token) setAuth({ slug, token });
  }, []);

  // Rebuild links preserving magic-link params so the shell stays
  // authenticated across navigations.
  function preserveAuth(href: string): string {
    if (!auth) return href;
    const [path, query] = href.split("?");
    const params = new URLSearchParams(query ?? "");
    if (!params.has("slug")) params.set("slug", auth.slug);
    if (!params.has("token")) params.set("token", auth.token);
    return `${path}?${params.toString()}`;
  }

  const isActive = (target: string) =>
    pathname === target || pathname.startsWith(target + "/");

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
      {/* Top bar — persistent on every shell page */}
      <AppTopBar
        auth={auth}
        onOpenDrawer={() => setDrawerOpen(true)}
        preserveAuth={preserveAuth}
      />

      {/* Main content — bottom padding on mobile to clear the bottom nav */}
      <main className="pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom nav — thumb-reach primary actions */}
      <AppBottomNav
        isActive={isActive}
        preserveAuth={preserveAuth}
      />

      {/* Avatar drawer — opens from the top-right avatar */}
      <AppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        auth={auth}
        preserveAuth={preserveAuth}
      />

      {/* Preserve searchParams reference so it doesn't get tree-shaken */}
      <input type="hidden" value={searchParams.toString()} readOnly />
    </div>
  );
}

function AppTopBar({
  auth,
  onOpenDrawer,
  preserveAuth
}: {
  auth: Auth | null;
  onOpenDrawer: () => void;
  preserveAuth: (h: string) => string;
}) {
  return (
    <header
      className="sticky top-0 z-40 hidden border-b md:block"
      style={{ backgroundColor: "#FBF6EC", borderColor: "rgba(27,26,23,0.08)" }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-2.5">
        {/* Brand */}
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-1.5"
          aria-label="Thenetworkers"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "#FFB300" }}
          />
          <span className="hidden text-[12px] font-black uppercase tracking-[0.20em] text-[#B8860B] sm:inline">
            Thenetworkers
          </span>
        </Link>

        {/* Canteen + Marketplace — yellow-dot text links, sit inline
            with the brand so both are one tap from any surface. On
            mobile the wordmarks hide so the row fits the viewport;
            the dot alone acts as the tap target with the aria-label
            carrying the accessible name. */}
        {/* Canteen + Marketplace — hidden on mobile (bottom nav +
            drawer cover navigation there); yellow-dot text links
            appear at md+ as inline shortcuts alongside the brand. */}
        <Link
          href="/trade-off/yard/canteens"
          className="hidden shrink-0 items-center gap-1.5 rounded-full px-1.5 py-1 text-neutral-900 hover:bg-black/[0.04] md:inline-flex"
          aria-label="Canteen — live feed of trade + merchant posts"
          title="Canteen"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "#FFB300" }}
          />
          <span className="text-[12px] font-black uppercase tracking-[0.16em]">
            Canteen
          </span>
        </Link>
        <Link
          href="/market"
          className="hidden shrink-0 items-center gap-1.5 rounded-full px-1.5 py-1 text-neutral-900 hover:bg-black/[0.04] md:inline-flex"
          aria-label="Marketplace"
          title="Marketplace"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "#FFB300" }}
          />
          <span className="text-[12px] font-black uppercase tracking-[0.16em]">
            Marketplace
          </span>
        </Link>

        {/* Search — routes to Yard search. `min-w-0` on the flex child
            is required for `truncate` to work; without it the intrinsic
            placeholder width pushes the top bar past the mobile viewport
            (was the cause of "screen cut on right" on canteen pages). */}
        <Link
          href={preserveAuth("/trade-off/yard")}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#1B1A17]/10 bg-white px-3 py-1.5 text-[12px] text-[#1B1A17]/50 hover:border-[#1B1A17]/20"
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          <span className="truncate">Search a trade, town or tool…</span>
        </Link>

        {/* Right-side actions */}
        {auth ? (
          <>
            <Link
              href={preserveAuth(`/trade-off/edit/${auth.slug}/notifications`)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#1B1A17]/70 hover:bg-black/[0.04] hover:text-[#1B1A17]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={onOpenDrawer}
              aria-label="Open menu"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-2 ring-amber-400 shadow-sm overflow-hidden bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CHAT_AVATAR_IMAGE}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          </>
        ) : (
          <>
            <Link
              href="/join/start"
              className="hidden shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black text-neutral-900 sm:inline-flex"
              style={{ background: "#FFB300" }}
            >
              Join free
            </Link>
            <Link
              href="/home/sign-in"
              className="inline-flex shrink-0 items-center rounded-full border border-[#1B1A17]/15 px-3 py-1.5 text-[11px] font-bold text-[#1B1A17] hover:bg-black/[0.04]"
            >
              Sign in
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

function AppBottomNav({
  isActive,
  preserveAuth
}: {
  isActive: (t: string) => boolean;
  preserveAuth: (h: string) => string;
}) {
  const items = [
    {
      href: preserveAuth("/trade-off/yard"),
      label: "Yard",
      icon: Home,
      // Match /trade-off/yard exactly OR any subpath EXCEPT the
      // compose subpath (which has its own visual identity).
      match: "/trade-off/yard"
    },
    {
      href: preserveAuth("/trade-off/prices"),
      label: "Prices",
      icon: DollarSign,
      match: "/trade-off/prices"
    },
    {
      // Beacon is a MODE of the Yard, not a separate route. Anchor
      // to #beacon on the Yard so the composer scrolls into view.
      href: preserveAuth("/trade-off/yard#beacon"),
      label: "Beacon",
      icon: Radio,
      // No dedicated route — active state only on the Yard hash.
      match: "/trade-off/yard"
    },
    {
      href: preserveAuth("/trade-off/following"),
      label: "Following",
      icon: Users,
      match: "/trade-off/following"
    },
    {
      href: preserveAuth("/why/trades"),
      label: "Discover",
      icon: Compass,
      match: "/why/trades"
    }
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-[#FBF6EC]/95 backdrop-blur-md md:hidden"
      style={{ borderColor: "rgba(27,26,23,0.08)" }}
    >
      <ul className="mx-auto flex max-w-[600px] items-stretch justify-around">
        {items.map((it) => {
          const active = isActive(it.match);
          const Icon = it.icon;
          return (
            <li key={it.label} className="flex-1">
              <Link
                href={it.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-black ${
                  active ? "text-[#B8860B]" : "text-[#1B1A17]/55"
                }`}
              >
                <Icon
                  className="h-5 w-5"
                  aria-hidden
                  strokeWidth={active ? 2.5 : 2}
                />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AppDrawer({
  open,
  onClose,
  auth,
  preserveAuth
}: {
  open: boolean;
  onClose: () => void;
  auth: Auth | null;
  preserveAuth: (h: string) => string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Full nav — mirrors what the deprecated DashboardDrawer used to
  // hold plus the shell-native items. Ordered to surface Sell + Profile
  // + Prices + Notifications first (the daily-use surfaces), then the
  // edit + insights + connect surfaces.
  const links = auth
    ? [
        {
          href: preserveAuth("/trade-off/following"),
          icon: Users,
          label: "Following feed",
          hint: "Posts from trades you follow"
        },
        {
          // Consolidated sell entry — routes to the /trade-off/sell hub
          // which detects merchant vs service trade and recommends the
          // right path (Storefront or Yard listing) instead of forcing
          // the user to guess.
          href: preserveAuth("/trade-off/sell"),
          icon: ShoppingBag,
          label: "Sell products or services",
          hint: "Storefront or one-off Yard listing — we'll help you pick"
        },
        {
          href: preserveAuth("/trade-off/yard/manage"),
          icon: Tag,
          label: "Manage your Yard posts",
          hint: "Delete, archive, or boost your listings"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/quick-prices`),
          icon: Sparkles,
          label: "Quick prices",
          hint: "Add 5 fixed prices to join the network"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/services-prices`),
          icon: DollarSign,
          label: "Services & pricing",
          hint: "Priced services, bulk tiers, wholesale"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/prices`),
          icon: DollarSign,
          label: "Live prices",
          hint: "Publish market prices"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/notifications`),
          icon: MessageCircle,
          label: "Notifications",
          hint: "Comments, beacons, leads"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/orders`),
          icon: ShoppingBag,
          label: "Orders & payments",
          hint: "Order history + payment admin"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/install-leads`),
          icon: Wrench,
          label: "Install leads",
          hint: "Nearby-installer leads (in + out)"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}`),
          icon: User,
          label: "Profile",
          hint: "Identity, hours, contact, portfolio"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/team`),
          icon: Users2,
          label: "Team",
          hint: "Team members + roles"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/sharing`),
          icon: Rocket,
          label: "Sharing & boosts",
          hint: "Business card share + boost history"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/insights`),
          icon: BarChart3,
          label: "Insights",
          hint: "Trust score, plan status, rewards"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/app-studio`),
          icon: Settings,
          label: "App Studio",
          hint: "Theme, hero, animation"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/add-ons`),
          icon: Sparkles,
          label: "Add-ons",
          hint: "Custom domain, SMS alerts, more"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/custom-domain`),
          icon: Globe,
          label: "Domain & downloads",
          hint: "Custom domain, downloads, FAQ"
        },
        {
          href: `/api/studio/enter?token=${encodeURIComponent(auth.token)}&next=/studio/apps`,
          icon: Sparkles,
          label: "App Warehouse",
          hint: "Browse + install premium Apps"
        },
        {
          href: `/${auth.slug}`,
          icon: ExternalLink,
          label: "View live profile",
          hint: "See your public page as a customer would"
        }
      ]
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[70] flex justify-end"
      onClick={onClose}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(20,17,10,0.55)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-full max-w-sm flex-col bg-[#FBF6EC] shadow-2xl"
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "rgba(27,26,23,0.10)" }}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-amber-400 shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CHAT_AVATAR_IMAGE}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
            <div>
              <p className="text-[13px] font-black text-[#1B1A17]">
                {auth ? "Your Network" : "Menu"}
              </p>
              <p className="text-[10.5px] text-[#1B1A17]/55">
                {auth ? `@${auth.slug}` : "Sign in to unlock"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white shadow"
            style={{ background: "#8B0F0F" }}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {auth ? (
          <ul className="flex-1 divide-y overflow-y-auto"
            style={{ borderColor: "rgba(27,26,23,0.06)" }}
          >
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-black/[0.03]"
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full"
                      style={{ background: "#FFB300", color: "#0A0A0A" }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-[#1B1A17]">
                        {l.label}
                      </p>
                      <p className="text-[10.5px] text-[#1B1A17]/55">
                        {l.hint}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex-1 px-4 py-6">
            <p className="text-[13px] text-[#1B1A17]/70">
              Sign in from your trade dashboard to unlock the full network.
            </p>
            <Link
              href="/home/sign-in"
              onClick={onClose}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[13px] font-black text-neutral-900"
              style={{ background: "#FFB300" }}
            >
              Sign in
            </Link>
          </div>
        )}

        {auth && (
          <div
            className="border-t px-4 py-3"
            style={{ borderColor: "rgba(27,26,23,0.10)" }}
          >
            <Link
              href="/"
              onClick={onClose}
              className="inline-flex items-center gap-2 text-[11.5px] font-bold text-[#1B1A17]/60 hover:text-[#1B1A17]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out of the network
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
