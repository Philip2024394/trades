// userMenuContext — server-side resolver for the UserMenuDropdown.
//
// Reads the visitor's identity cookies and returns everything the
// dropdown needs to render: name, avatar, home surface, secondary
// links. Returns { kind: "anon" } when no session so the dropdown
// can render Sign-in / Sign-up affordances.
//
// Kept pure (no React) so any server component or layout can call
// this once and pass the context down.

import { cookies } from "next/headers";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { TRADE_SESSION_COOKIE_NAME, verifyTradeSession } from "@/lib/tradeSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MOCK_CANTEENS } from "@/lib/canteens";

export type UserMenuLink = {
  label: string;
  href:  string;
  hint?: string;
};

export type UserMenuContext =
  | { kind: "anon" }
  | {
      kind:        "homeowner";
      displayName: string;
      initial:     string;
      avatarUrl:   string | null;
      homeHref:    string;
      homeLabel:   string;
      links:       UserMenuLink[];
      logoutAction: string;   // POST url
    }
  | {
      kind:        "merchant";
      displayName: string;
      initial:     string;
      avatarUrl:   string | null;
      homeHref:    string;
      homeLabel:   string;
      links:       UserMenuLink[];
      logoutAction: string;
    };

export async function resolveUserMenuContext(): Promise<UserMenuContext> {
  // Homeowner first — they're the primary invite-loop user.
  const homeowner = await getHomeownerFromCookie();
  if (homeowner) {
    const name = homeowner.first_name?.trim() || homeowner.house_nickname || "Homeowner";
    return {
      kind:         "homeowner",
      displayName:  name,
      initial:      name.charAt(0).toUpperCase(),
      avatarUrl:    null,
      homeHref:     "/sitebook",
      homeLabel:    "My SiteBook",
      logoutAction: "/api/homeowner/logout",
      links: [
        { label: "Threads",           href: "/sitebook/threads",   hint: "WhatsApp conversations" },
        { label: "Settings",          href: "/sitebook/settings" }
      ]
    };
  }

  // Merchant / trade / supplier
  const jar        = await cookies();
  const sessionRaw = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
  const merchant   = verifyTradeSession(sessionRaw);
  if (merchant?.slug) {
    // Look up display name + canteen slug + avatar
    const [{ data: listing }, ownCanteen] = await Promise.all([
      supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("display_name, avatar_url")
        .eq("slug", merchant.slug)
        .maybeSingle(),
      resolveOwnCanteenSlug(merchant.slug)
    ]);
    const name = (listing?.display_name as string | null)?.trim() || merchant.slug;
    return {
      kind:         "merchant",
      displayName:  name,
      initial:      name.charAt(0).toUpperCase(),
      avatarUrl:    (listing?.avatar_url as string | null) ?? null,
      homeHref:     ownCanteen ? `/trade-off/yard/canteens/${ownCanteen}` : "/trade-off/yard/canteens",
      homeLabel:    ownCanteen ? "My canteen" : "Create my canteen",
      logoutAction: "/api/trade-off/logout",
      links: ownCanteen
        ? [
            { label: "Manage canteen",         href: `/trade-off/yard/canteens/${ownCanteen}/manage` },
            { label: "Trade Center dashboard", href: `/tc/${merchant.slug}` },
            { label: "Settings",               href: `/trade-off/edit/${merchant.slug}` }
          ]
        : [
            { label: "Trade Center dashboard", href: `/tc/${merchant.slug}` },
            { label: "Settings",               href: `/trade-off/edit/${merchant.slug}` }
          ]
    };
  }

  return { kind: "anon" };
}

async function resolveOwnCanteenSlug(hostSlug: string): Promise<string | null> {
  const fixture = MOCK_CANTEENS.find((c) => c.hostSlug === hostSlug);
  if (fixture) return fixture.slug;
  const { data } = await supabaseAdmin
    .from("hammerex_canteens")
    .select("slug")
    .eq("host_slug", hostSlug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.slug as string | null) ?? null;
}
