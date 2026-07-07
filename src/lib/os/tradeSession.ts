// Trade-side session resolution.
//
// Reuses the party-cookie session that homeowners use. If the signed-in
// party owns any os_business_listings row (party_id = them), they are
// a trade and we can serve them the trade dashboard. Multiple business
// listings per party is rare but supported.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import type { PartyRecord } from "@/lib/os/parties";

export type TradeSession = {
  party: PartyRecord;
  primaryListingId: string;
  primaryListingSlug: string;
  primaryListingDisplayName: string;
};

export async function loadTradeSession(): Promise<TradeSession | null> {
  const party = await loadHomeownerSession();
  if (!party) return null;

  const { data } = await supabaseAdmin
    .from("os_business_listings")
    .select("id, slug, display_name")
    .eq("party_id", party.id)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    party,
    primaryListingId: data.id,
    primaryListingSlug: data.slug,
    primaryListingDisplayName: data.display_name
  };
}

export async function requireTradeSession(): Promise<TradeSession> {
  const t = await loadTradeSession();
  if (!t) throw new Error("Not authenticated as trade");
  return t;
}
