// Referral opportunities — surfaces contacts who are RIPE for a
// referral ask. Signals we lean on today:
//   • Recent reviewer who hasn't heard from you in 60+ days
//   • Repeat customer (2+ signed-off jobs) — high referral value
//
// Both queries live in Phase 8 CX. This module thin-wraps + reframes
// them so NET callers get referral-specific reasoning.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type ReferralOpportunity } from "./types";

const DAY_MS = 86_400_000;

export type FindReferralsInput = {
  merchantId: string;
  now?:       Date;
  limit?:     number;
};

export async function findReferralOpportunities(opts: FindReferralsInput): Promise<ReferralOpportunity[]> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 8;
  const evidence = evidenceFor(
    "app_crm_contacts + app_reviews_reviews + app_job_diary_jobs",
    ["app_crm_contacts", "app_reviews_reviews", "app_job_diary_jobs"]
  );

  const out: ReferralOpportunity[] = [];

  // Signal 1: reviewers who've gone quiet ≥60 days.
  const reviewers = await supabaseAdmin
    .from("app_reviews_reviews")
    .select("rating, homeowner_party_id, created_at")
    .eq("merchant_id", opts.merchantId)
    .order("created_at", { ascending: false })
    .limit(50);
  const partyIds = Array.from(new Set((reviewers.data ?? []).map((r) => r.homeowner_party_id).filter((x): x is string => !!x)));
  if (partyIds.length > 0) {
    const contacts = await supabaseAdmin
      .from("app_crm_contacts")
      .select("id, display_name, party_id, last_touch_at, last_activity_at")
      .eq("merchant_id", opts.merchantId)
      .in("party_id", partyIds);
    const contactByParty = new Map<string, { id: string; name: string; last: string | null }>();
    for (const c of contacts.data ?? []) {
      contactByParty.set(String(c.party_id), {
        id:   String(c.id),
        name: String(c.display_name),
        last: (c.last_touch_at ?? c.last_activity_at) as string | null
      });
    }
    for (const r of reviewers.data ?? []) {
      const partyId = r.homeowner_party_id as string | null;
      if (!partyId) continue;
      const c = contactByParty.get(partyId);
      if (!c || !c.last) continue;
      const days = Math.floor((now.getTime() - new Date(c.last).getTime()) / DAY_MS);
      if (days < 60) continue;
      out.push({
        contact_id:   c.id,
        display_name: c.name,
        reason:       `Left a ${Number(r.rating).toFixed(0)}★ review and hasn't heard from you in ${days} days.`,
        action:       "Send a thank-you and ask for a referral",
        evidence
      });
      if (out.length >= limit) break;
    }
  }

  // Signal 2: repeat customers with 2+ signed-off jobs.
  if (out.length < limit) {
    const jobs = await supabaseAdmin
      .from("app_job_diary_jobs")
      .select("homeowner_party_id, status")
      .eq("merchant_id", opts.merchantId)
      .eq("status", "signed_off");
    const byParty = new Map<string, number>();
    for (const j of jobs.data ?? []) {
      const p = j.homeowner_party_id as string | null;
      if (!p) continue;
      byParty.set(p, (byParty.get(p) ?? 0) + 1);
    }
    const repeatIds = Array.from(byParty.entries()).filter(([, n]) => n >= 2).map(([id]) => id);
    if (repeatIds.length > 0) {
      const contacts = await supabaseAdmin
        .from("app_crm_contacts")
        .select("id, display_name, party_id")
        .eq("merchant_id", opts.merchantId)
        .in("party_id", repeatIds);
      const already = new Set(out.map((r) => r.contact_id));
      for (const c of contacts.data ?? []) {
        const id = String(c.id);
        if (already.has(id)) continue;
        out.push({
          contact_id:   id,
          display_name: String(c.display_name),
          reason:       `Repeat customer — ${byParty.get(String(c.party_id)) ?? 0} jobs completed together.`,
          action:       "They've hired you before — ask if any friends or family need work",
          evidence
        });
        if (out.length >= limit) break;
      }
    }
  }

  return out;
}
