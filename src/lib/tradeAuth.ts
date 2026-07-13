// Trade auth — Supabase session read on the server.
//
// The Trade Center trade signs in via `/tc/sign-in` (WhatsApp OTP now,
// email magic link + Google SSO coming). Once authenticated their
// `auth.users.id` becomes their canonical trade id, and their extended
// profile lives in `app_trade_profiles`.

import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Build a Supabase client that reads + writes the auth cookies. */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          for (const c of list) {
            cookieStore.set(c.name, c.value, c.options);
          }
        } catch {
          // Called from a Server Component — read-only cookies. Ignored.
        }
      }
    }
  });
}

export type ViewerRole = "trade" | "diy";

export type TradeProfile = {
  id: string;
  phoneE164: string | null;
  email: string | null;
  displayName: string;
  tradeDiscipline: string | null;
  homePostcode: string | null;
  homeCity: string | null;
  identityComplete: boolean;
  /** trade = professional tradesperson; diy = homeowner. Set at signup.
   *  Every trade-only surface must gate on this === "trade". */
  viewerRole: ViewerRole;
};

/**
 * Return the currently signed-in trade's profile, or null if not
 * authenticated. Never throws — a null return means "not logged in".
 */
export async function getCurrentTrade(): Promise<TradeProfile | null> {
  const supabase = await getSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  let row: {
    id: string;
    phone_e164: string | null;
    email: string | null;
    display_name: string;
    trade_discipline: string | null;
    home_postcode: string | null;
    home_city: string | null;
    identity_complete: boolean;
    viewer_role: string | null;
  } | null = null;
  try {
    const { data } = await supabase
      .from("app_trade_profiles")
      .select("id, phone_e164, email, display_name, trade_discipline, home_postcode, home_city, identity_complete, viewer_role")
      .eq("id", user.id)
      .maybeSingle();
    row = data ?? null;
  } catch {
    // Migrations may not be applied yet in dev — fall through to the
    // auth-only shape so the app still works.
    row = null;
  }

  if (!row) {
    // Auth row exists but no profile yet — this trade is mid-signup.
    return {
      id:               user.id,
      phoneE164:        user.phone ?? null,
      email:            user.email ?? null,
      displayName:      user.user_metadata?.display_name ?? user.phone ?? user.email ?? "New Trade",
      tradeDiscipline:  null,
      homePostcode:     null,
      homeCity:         null,
      // If no profiles table exists, we can't check identity_complete
      // so treat auth-only sessions as complete to skip the
      // complete-identity nag in dev.
      identityComplete: true,
      // Legacy fallback for accounts predating the viewer_role
      // migration. See feedback_trade_features_trade_only.md — trade
      // is the historical default so the gate stays permissive for
      // existing users.
      viewerRole:       "trade"
    };
  }

  return {
    id:               row.id,
    phoneE164:        row.phone_e164,
    email:            row.email,
    displayName:      row.display_name,
    tradeDiscipline:  row.trade_discipline,
    homePostcode:     row.home_postcode,
    homeCity:         row.home_city,
    identityComplete: row.identity_complete,
    viewerRole:       row.viewer_role === "diy" ? "diy" : "trade"
  };
}

/**
 * Redirect-friendly assertion: returns the trade or null. Callers push
 * to `/tc/sign-in` on null.
 */
export async function requireTrade(): Promise<TradeProfile | null> {
  return getCurrentTrade();
}
