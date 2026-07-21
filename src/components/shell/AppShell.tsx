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
import { NotificationsPopover } from "./NotificationsPopover";
import { WalletChip } from "./WalletChip";
import { GlobalHeader } from "./GlobalHeader";
import {
  Search,
  Bell,
  User,
  Users,
  X,
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
  Wrench,
  Circle
} from "lucide-react";

// `token` is `null` when the session came from the signed cookie
// (edit_tokens are never leaked to the client). Every preserveAuth /
// URL-token consumer checks for a non-null token before appending.
// avatarUrl + displayName are fetched from /api/trade-off/session so
// the drawer button and profile chips render the signed-in merchant's
// real face, not a hardcoded placeholder.
type Auth = {
  slug: string;
  token: string | null;
  avatarUrl?: string | null;
  displayName?: string | null;
};

// Fallback placeholder image kept as an ultimate last-resort, only
// used when we also can't compute initials (no display name AND no
// slug). In practice the InitialsAvatar below covers every signed-in
// merchant.
const CHAT_AVATAR_IMAGE =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2002_57_40%20PM.png";

// Deterministic colour picker for the initials-circle fallback. Same
// slug → same colour, so Mike's initial always sits on the same brand
// hue instead of a random placeholder face. Pulled from platform
// tokens (yellow, amber, dark green, dark red, blue-grey, warm ink).
const INITIALS_COLOURS = ["#FFB300", "#F59E0B", "#166534", "#B91C1C", "#7A5300", "#1B1A17"];
function pickInitialsColour(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return INITIALS_COLOURS[Math.abs(hash) % INITIALS_COLOURS.length];
}
function initialsFor(auth: Auth | null): string {
  const source = auth?.displayName ?? auth?.slug ?? "";
  if (!source) return "";
  // Take the first letter of the first two space/dash-separated words.
  const parts = source.replace(/^demo-/, "").split(/[\s-]+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const second = parts[1]?.charAt(0) ?? "";
  return (first + second).toUpperCase().slice(0, 2);
}

/** Compact avatar for the header. Renders the merchant's real photo
 *  when we have it; otherwise a colored initial circle (Gmail-style).
 *  Never falls back to the ChatGPT placeholder for signed-in merchants
 *  — that pattern was too easily mistaken for "someone else's face". */
function ShellAvatar({ auth, size }: { auth: Auth | null; size: 36 | 44 }) {
  const initials = initialsFor(auth);
  const bg = pickInitialsColour(auth?.slug ?? "anon");
  if (auth?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={auth.avatarUrl}
        alt={auth.displayName ?? ""}
        className="h-full w-full object-cover"
      />
    );
  }
  if (initials) {
    return (
      <span
        aria-hidden
        className="flex h-full w-full items-center justify-center font-black text-white"
        style={{
          backgroundColor: bg,
          fontSize: size === 44 ? "16px" : "13px",
          letterSpacing: "0.02em"
        }}
      >
        {initials}
      </span>
    );
  }
  return (
    // Ultimate fallback — only reached when there's no name AND no
    // slug to derive initials from (essentially never for a signed-in
    // merchant). Kept so we don't render a broken box.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={CHAT_AVATAR_IMAGE} alt="" className="h-full w-full object-cover"/>
  );
}

export function AppShell({
  children,
  initialAuth = null
}: {
  children: React.ReactNode;
  /** Server-resolved auth from the trade session cookie. When present,
   *  the header renders the signed-in variant on first paint — no
   *  client-side flash of "Join free / Sign in" while /api/trade-off/
   *  session round-trips. Layouts read the cookie in their server
   *  component + pass it in. */
  initialAuth?: Auth | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [auth, setAuth] = useState<Auth | null>(initialAuth);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Notebook pending actions (review-to-respond, quote-to-send, etc.).
  // Drives the red-dot badge on both bell icons + updates the PWA app
  // icon badge on the merchant's home screen via setAppBadge() when
  // available. One fetch, one source of truth for every surface.
  const [pendingCount, setPendingCount] = useState(0);
  // Edit-mode state mirrored from the canteen page. When the merchant
  // is on their canteen page, we render an "Edit mode" pill beside the
  // bell (per Philip's rule). Toggling the pill dispatches a
  // `canteen:toggle-edit` CustomEvent — the canteen page's shell
  // listens for it + owns the actual edit-state (host-guarded there).
  // We also listen for `canteen:edit-mode-changed` so the pill label
  // stays in sync when Edit mode is toggled from anywhere.
  const [canteenEditActive, setCanteenEditActive] = useState(false);
  useEffect(() => {
    function onChange(e: Event) {
      const detail = (e as CustomEvent).detail as { active?: boolean } | undefined;
      if (typeof detail?.active === "boolean") setCanteenEditActive(detail.active);
    }
    window.addEventListener("canteen:edit-mode-changed", onChange as EventListener);
    return () => window.removeEventListener("canteen:edit-mode-changed", onChange as EventListener);
  }, []);
  function toggleCanteenEdit() {
    window.dispatchEvent(new CustomEvent("canteen:toggle-edit"));
  }
  // Show the pill only on a canteen detail page — path pattern
  // `/trade-off/yard/canteens/{slug}` where slug isn't the reserved
  // "new" (creation flow) and isn't the plain index route. Non-hosts
  // still see the button briefly but the canteen page guards the
  // toggle downstream; the button label + state simply won't flip.
  const isOnCanteenDetail = !!auth && !!pathname &&
    pathname.startsWith("/trade-off/yard/canteens/") &&
    pathname !== "/trade-off/yard/canteens/" &&
    !pathname.endsWith("/new") &&
    !pathname.includes("/new/") &&
    !pathname.endsWith("/canteens");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Precedence:
    //   1. URL magic-link params (?slug=&token=) — overrides everything
    //   2. Server-resolved initialAuth (already applied via useState)
    //   3. Client fetch fallback to /api/trade-off/session
    //
    // When initialAuth was passed by the server layout, we already
    // have the signed-in state on first paint — no client fetch needed
    // and no "Sign in" flash before Mike's avatar loads.
    const sp = new URLSearchParams(window.location.search);
    const urlSlug = sp.get("slug");
    const urlToken = sp.get("token");
    if (urlSlug && urlToken) {
      setAuth({ slug: urlSlug, token: urlToken });
      return;
    }
    if (initialAuth) return; // Server already resolved it.
    let cancelled = false;
    fetch("/api/trade-off/session", { credentials: "include", cache: "no-store" })
      .then((res) => res.ok ? res.json() : { ok: false })
      .then((body: {
        ok?: boolean;
        slug?: string;
        avatarUrl?: string | null;
        displayName?: string | null;
      }) => {
        if (cancelled) return;
        if (body?.ok && body.slug) {
          setAuth({
            slug: body.slug,
            token: null,
            avatarUrl: body.avatarUrl ?? null,
            displayName: body.displayName ?? null
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initialAuth]);

  // Fetch pending notebook actions once the merchant is signed in.
  // Only signed-in merchants have actions; skipped for public visitors.
  // Refetches every 60s so newly-arrived actions (review, comment,
  // lead) light up the bell without a manual refresh.
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notebook/actions", { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const count = Array.isArray(data?.actions) ? data.actions.length : 0;
        setPendingCount(count);
        // Update the PWA/home-screen app icon badge so Mike sees the
        // pending action count on his phone without opening the app.
        // Feature-detected — Safari/Chrome/Edge on modern OSes support
        // this; browsers without it silently no-op.
        if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
          if (count > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (navigator as any).setAppBadge(count).catch(() => {});
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (navigator as any).clearAppBadge?.().catch(() => {});
          }
        }
      } catch { /* offline — bell stays quiet */ }
    }
    load();
    const int = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(int); };
  }, [auth]);

  // Rebuild links preserving magic-link params so the shell stays
  // authenticated across navigations. Cookie-authenticated sessions
  // (no token) skip URL param appending entirely — the cookie carries
  // the auth across navigations, and appending a bare `?slug=` alone
  // would be misleading.
  function preserveAuth(href: string): string {
    if (!auth || !auth.token) return href;
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
      {/* Keyframes for the red-dot bell pulse. Same 2.2s cadence used
          by the "live session" dot in the burger profile card so
          notification signals feel consistent across the app. */}
      <style>{`
        @keyframes shell-bell-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(185,28,28,0.55); }
          70%  { box-shadow: 0 0 0 6px rgba(185,28,28,0); }
          100% { box-shadow: 0 0 0 0 rgba(185,28,28,0); }
        }
        @keyframes editmode-glow {
          0%   { box-shadow: 0 0 0 0 rgba(22,101,52,0.65), 0 2px 6px rgba(0,0,0,0.15); }
          50%  { box-shadow: 0 0 0 6px rgba(22,101,52,0), 0 2px 6px rgba(0,0,0,0.15); }
          100% { box-shadow: 0 0 0 0 rgba(22,101,52,0), 0 2px 6px rgba(0,0,0,0.15); }
        }
      `}</style>
      {/* Top bar — persistent on every shell page. Desktop rendering
          only (hidden md:block inside the component). */}
      <AppTopBar
        auth={auth}
        onOpenDrawer={() => setDrawerOpen(true)}
        preserveAuth={preserveAuth}
        pendingCount={pendingCount}
        showEditModeButton={isOnCanteenDetail}
        editModeActive={canteenEditActive}
        onToggleEditMode={toggleCanteenEdit}
      />

      {/* No mobile chrome cluster. The mobile view is the merchant's
          public app surface — visitor navigation happens via the main
          app entry (thenetworkers.app) and the bottom nav below. No
          bell / no burger / no Edit chip on mobile. See the memory
          note on desktop + iPad as the source of truth for editing. */}

      {/* Main content. No top padding on mobile: the top-right icon
          cluster is fixed-position (chrome-only), so page heroes render
          at the true top of the viewport. Bottom mobile nav removed
          per the "no footers on app surfaces" rule — navigation lives
          in the top-right avatar drawer. */}
      <main>{children}</main>

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
  preserveAuth,
  pendingCount,
  showEditModeButton,
  editModeActive,
  onToggleEditMode
}: {
  auth: Auth | null;
  onOpenDrawer: () => void;
  preserveAuth: (h: string) => string;
  pendingCount: number;
  showEditModeButton: boolean;
  editModeActive: boolean;
  onToggleEditMode: () => void;
}) {
  const [notifsOpen, setNotifsOpen] = useState(false);
  // AppShell delegates its header chrome to the shared GlobalHeader
  // (brand + 4 primary nav links + search icon) and injects the
  // auth-aware right-side content (edit pill / bell / avatar OR
  // join/sign-in) via the rightSlot prop. This keeps AppShell and
  // every other surface (TradeCenterHeader, landing, legal pages)
  // rendering the same top strip so navigation is consistent.
  return (
    <GlobalHeader
      rightSlot={
        auth ? (
          <>
            {showEditModeButton && (
              <button
                type="button"
                onClick={onToggleEditMode}
                aria-pressed={editModeActive}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm transition active:scale-[0.97]"
                style={{
                  backgroundColor: editModeActive ? "#166534" : "#FFB300",
                  color: editModeActive ? "#FFFFFF" : "#0A0A0A",
                  animation: editModeActive ? "editmode-glow 2.2s ease-out infinite" : undefined
                }}
              >
                {editModeActive ? "Exit edit" : "Edit mode"}
              </button>
            )}
            {/* Washer wallet chip — always visible for signed-in
                merchants. Click reveals balance hero + recent activity
                popover (Philip 2026-07-20 unified-wallet UX). */}
            <WalletChip
              ownerSlug={auth.slug}
              fullWalletHref={preserveAuth(`/trade-off/edit/${auth.slug}/washers`)}
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifsOpen((v) => !v)}
                aria-label={pendingCount > 0 ? `Notifications · ${pendingCount} pending` : "Notifications"}
                aria-expanded={notifsOpen}
                className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#1B1A17]/70 hover:bg-black/[0.04] hover:text-[#1B1A17]"
              >
                <Bell className="h-4 w-4" aria-hidden />
                {pendingCount > 0 && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-[#FBF6EC] px-1 text-[9px] font-black text-white shadow"
                    style={{
                      backgroundColor: "#B91C1C",
                      animation: "shell-bell-pulse 2.2s ease-out infinite"
                    }}
                  >
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </button>
              <NotificationsPopover
                open={notifsOpen}
                onClose={() => setNotifsOpen(false)}
                viewAllHref={preserveAuth(`/trade-off/edit/${auth.slug}/notifications`)}
                mode="desktop"
              />
            </div>
            <button
              type="button"
              onClick={onOpenDrawer}
              aria-label="Open menu"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-amber-400 shadow-sm"
            >
              <ShellAvatar auth={auth} size={36}/>
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
        )
      }
    />
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
          href: preserveAuth(`/trade-off/edit/${auth.slug}/washers`),
          icon: Circle,
          label: "Washer bag",
          hint: "Verified WhatsApp leads · buy packs · auto top-up"
        },
        {
          href: preserveAuth(`/trade-off/edit/${auth.slug}/templates`),
          icon: Sparkles,
          label: "Edit look",
          hint: "Palette, shade and feed image for your canteen"
        },
        {
          // Site Editor — the crown banner + template composer.
          // Previously unreachable from the merchant drawer; the
          // audit flagged it as one of the two entire product
          // families invisible from the dashboard.
          href: "/site/editor",
          icon: Sparkles,
          label: "Site Editor",
          hint: "Crown banners · templates · cutout · schedule posts"
        },
        {
          // Scheduled posts dashboard — where merchants manage the
          // queue built via the Site Editor's Schedule button.
          href: preserveAuth(`/trade-off/edit/${auth.slug}/scheduled`),
          icon: Bell,
          label: "Scheduled posts",
          hint: "Upcoming · posted · failed — reschedule or cancel"
        },
        {
          // Reviews inbox — was orphan pre-audit; merchant had a
          // respond API but no way to reach it from the drawer.
          href: "/site-office/apps/reviews",
          icon: MessageCircle,
          label: "Reviews inbox",
          hint: "See + reply to customer reviews"
        },
        {
          // Verification badges — merchants literally couldn't find
          // how to level up before this link.
          href: "/trade-off/verified",
          icon: User,
          label: "Verification & badges",
          hint: "ID · insurance · trade body — grow your trust score"
        },
        {
          // Tips library — 10 tip pages that existed as pure orphans.
          href: "/trade-off/tips",
          icon: Sparkles,
          label: "Tips & growth guides",
          hint: "How to win more work with your Networkers profile"
        },
        {
          // Help centre — was only reachable via a small in-page
          // HelpInfoButton before this link.
          href: "/trade-off/help",
          icon: Bell,
          label: "Help centre",
          hint: "Search articles · quick answers · walkthroughs"
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
        },
        {
          href: "/report-an-issue",
          icon: Bell,
          label: "Report an issue",
          hint: "Bug, broken link, or feature request — feeds the ops queue"
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
              <ShellAvatar auth={auth} size={36}/>
            </span>
            <div>
              <p className="text-[13px] font-black text-[#1B1A17]">
                {auth?.displayName ?? (auth ? "Your Network" : "Menu")}
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
