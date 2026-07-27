// userMenuContext — server-side resolver for the UserMenuDropdown.
//
// Reads the visitor's identity cookies and returns everything the
// dropdown needs to render: name, avatar, home surface, secondary
// links. Returns { kind: "anon" } when no session so the dropdown
// can render Sign-in / Sign-up affordances.
//
// Kept pure (no React) so any server component or layout can call
// this once and pass the context down.
//
// Canteen / yard menu items removed 2026-07-27 with the yard purge.
// Merchant home now points at the NEX Centre.

import { cookies } from "next/headers";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { TRADE_SESSION_COOKIE_NAME, verifyTradeSession } from "@/lib/tradeSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
    const { data: listing } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name, avatar_url")
      .eq("slug", merchant.slug)
      .maybeSingle();
    const name = (listing?.display_name as string | null)?.trim() || merchant.slug;
    return {
      kind:         "merchant",
      displayName:  name,
      initial:      name.charAt(0).toUpperCase(),
      avatarUrl:    (listing?.avatar_url as string | null) ?? null,
      homeHref:     "/nex-app/centre",
      homeLabel:    "NEX Centre",
      logoutAction: "/api/trade-off/logout",
      links: [
        { label: "Settings", href: `/trade-off/edit/${merchant.slug}` }
      ]
    };
  }

  return { kind: "anon" };
}
