// Campaign helpers used by the Stripe webhook + admin UI.
//
// resolveActiveCampaign() returns the most recently-started ACTIVE
// bonus/seasonal campaign whose [starts_at, ends_at] window contains
// "now". Competitions are not used to reprice commissions — they
// generate prize payouts when ended.
//
// priceCommissionWithCampaign() takes a campaign row (or null) and
// returns { amount_pence, campaign_id } using the formula:
//   amount = (1000 * multiplier) + bonus_pence
import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

export type CampaignRow = {
  id: string;
  kind: "competition" | "bonus" | "seasonal";
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  bonus_pence: number;
  multiplier: number;
  prize_pence: number;
  prize_count: number;
  status: "active" | "ended" | "cancelled";
};

export const BASE_COMMISSION_PENCE = 1000;

export async function resolveActiveCampaign(): Promise<CampaignRow | null> {
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("hammerex_affiliate_campaigns")
    .select("*")
    .eq("status", "active")
    .in("kind", ["bonus", "seasonal"])
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CampaignRow | null) ?? null;
}

export async function listActiveCampaigns(): Promise<CampaignRow[]> {
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("hammerex_affiliate_campaigns")
    .select("*")
    .eq("status", "active")
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("starts_at", { ascending: false });
  return (data as CampaignRow[] | null) ?? [];
}

export function priceCommissionWithCampaign(
  campaign: CampaignRow | null
): { amount_pence: number; campaign_id: string | null } {
  if (!campaign) {
    return { amount_pence: BASE_COMMISSION_PENCE, campaign_id: null };
  }
  const multiplier = Number(campaign.multiplier ?? 1);
  const bonus = Math.max(0, Number(campaign.bonus_pence ?? 0));
  const base = Math.round(BASE_COMMISSION_PENCE * multiplier) + bonus;
  return {
    amount_pence: Math.max(BASE_COMMISSION_PENCE, base),
    campaign_id: campaign.id
  };
}
