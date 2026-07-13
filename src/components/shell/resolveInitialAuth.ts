// Server-side auth resolver for AppShell.
//
// Reads the HMAC-signed trade session cookie and returns the fields
// AppShell needs to render the signed-in header on FIRST paint — no
// client-side round-trip to /api/trade-off/session, no flash of
// "Join Free / Sign In" while the fetch resolves.
//
// Called from layouts (server components) that wrap AppShell. See
// src/app/trade-off/yard/layout.tsx and edit/layout.tsx.

import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  TRADE_SESSION_COOKIE_NAME,
  verifyTradeSession
} from "@/lib/tradeSession";

export type InitialAuth = {
  slug: string;
  token: string | null;
  avatarUrl?: string | null;
  displayName?: string | null;
};

export async function resolveInitialAuth(): Promise<InitialAuth | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
    const session = verifyTradeSession(raw);
    if (!session?.slug) return null;

    // Fetch the merchant's display fields so the signed-in header can
    // render the avatar + name on first paint. Best-effort — the header
    // degrades to the initials circle if the row is missing.
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name, avatar_url")
      .eq("id", session.listing_id)
      .maybeSingle();

    return {
      slug: session.slug,
      token: null,
      avatarUrl: data?.avatar_url ?? null,
      displayName: data?.display_name ?? null
    };
  } catch {
    return null;
  }
}
