// Past-collaboration graph — pairs of merchants who have been
// members on the same SiteBook project.
//
// Query flow:
//   1. Get every project this merchant has been a member of.
//   2. Get every OTHER member on those same projects.
//   3. Aggregate: partner_slug → { count, most_recent }.
//   4. Hydrate partner display_name + trade from the listings table.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type CollaborationRow } from "./types";

export type FindCollaboratorsInput = {
  merchantListingId: string;
  limit?:            number;   // default 10
};

export async function findCollaborators(opts: FindCollaboratorsInput): Promise<CollaborationRow[]> {
  const evidence = evidenceFor(
    "hammerex_sitebook_members (co-membership on the same project)",
    ["hammerex_sitebook_members", "hammerex_trade_off_listings"]
  );

  // 1. My project memberships.
  const mine = await supabaseAdmin
    .from("hammerex_sitebook_members")
    .select("project_id, invited_at, hired_at, completed_at")
    .eq("listing_id", opts.merchantListingId)
    .neq("status", "declined");
  const projectIds = Array.from(new Set((mine.data ?? []).map((r) => String(r.project_id))));
  if (projectIds.length === 0) return [];

  // 2. All OTHER members on those projects.
  const others = await supabaseAdmin
    .from("hammerex_sitebook_members")
    .select("project_id, listing_id, merchant_slug, merchant_name, trade_type, invited_at, hired_at, completed_at")
    .in("project_id", projectIds)
    .neq("listing_id", opts.merchantListingId)
    .neq("status", "declined");

  // 3. Aggregate.
  type Agg = { count: number; most_recent: string | null; name: string; trade: string | null };
  const byPartner = new Map<string, Agg>();
  for (const o of others.data ?? []) {
    const key = String(o.merchant_slug ?? o.listing_id);
    if (!key || key === "null") continue;
    const cur = byPartner.get(key) ?? {
      count: 0,
      most_recent: null,
      name: String(o.merchant_name ?? key),
      trade: (o.trade_type as string | null) ?? null
    };
    cur.count += 1;
    const latestOnThisRow = pickLatestIso(o.completed_at as string | null, o.hired_at as string | null, o.invited_at as string | null);
    if (latestOnThisRow && (!cur.most_recent || latestOnThisRow > cur.most_recent)) cur.most_recent = latestOnThisRow;
    byPartner.set(key, cur);
  }

  const rows: CollaborationRow[] = Array.from(byPartner.entries())
    .map(([slug, agg]) => ({
      partner_slug:      slug,
      partner_name:      agg.name,
      partner_trade:     agg.trade,
      projects_together: agg.count,
      most_recent_at:    agg.most_recent,
      evidence
    }))
    .sort((a, b) => b.projects_together - a.projects_together);

  return rows.slice(0, opts.limit ?? 10);
}

function pickLatestIso(...vals: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of vals) if (v && (!best || v > best)) best = v;
  return best;
}
