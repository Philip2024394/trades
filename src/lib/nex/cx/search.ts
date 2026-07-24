// Cross-customer search.
//
// Answers list-questions like "who owes me money?", "who should I
// contact today?", "show kitchen customers", "who leaves the best
// reviews?". Every predicate joins the CRM contacts with a source
// table + returns a small result set with a "why this one" note.
//
// Every query is merchant-scoped — a merchant never sees another
// merchant's contacts.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CustomerListEntry } from "./types";

const DAY_MS = 86_400_000;
const MAX_RESULTS = 20;

/** "Who owes me money?" — costs with outstanding balance where this
 *  merchant is the trade. Aggregates per homeowner. */
export async function findCustomersOwingMoney(merchantListingId: string, merchantId: string): Promise<CustomerListEntry[]> {
  const rows = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("agreed_pence, paid_pence, due_at, hammerex_sitebook_projects!inner(homeowner_id)")
    .eq("trade_listing_id", merchantListingId)
    .neq("status", "cancelled");

  const byHomeowner = new Map<string, { outstanding: number; overdue: boolean }>();
  for (const r of rows.data ?? []) {
    const agreed = Number(r.agreed_pence ?? 0);
    const paid   = Number(r.paid_pence ?? 0);
    const outstanding = Math.max(0, agreed - paid);
    if (outstanding === 0) continue;
    const parent = (r as { hammerex_sitebook_projects?: { homeowner_id?: string | null } | null }).hammerex_sitebook_projects ?? null;
    const homeownerId = parent?.homeowner_id;
    if (!homeownerId) continue;
    const overdue = !!(r.due_at && new Date(r.due_at as string).getTime() < Date.now());
    const cur = byHomeowner.get(homeownerId) ?? { outstanding: 0, overdue: false };
    cur.outstanding += outstanding;
    cur.overdue = cur.overdue || overdue;
    byHomeowner.set(homeownerId, cur);
  }
  if (byHomeowner.size === 0) return [];

  return await hydrateHomeownersToContacts(Array.from(byHomeowner.entries()).map(([homeownerId, agg]) => ({
    homeownerId,
    note:  `£${(agg.outstanding / 100).toLocaleString("en-GB")} outstanding${agg.overdue ? " (overdue)" : ""}.`,
    metric: agg.outstanding,
    metric_unit: "gbp" as const
  })), merchantId, MAX_RESULTS);
}

/** "Who should I contact today?" — quietest contacts first, capped. */
export async function findCustomersToContact(merchantId: string, minDays = 30): Promise<CustomerListEntry[]> {
  const cutoff = new Date(Date.now() - minDays * DAY_MS).toISOString();
  const rows = await supabaseAdmin
    .from("app_crm_contacts")
    .select("id, display_name, lifecycle_stage, last_touch_at, last_activity_at, quiet_since")
    .eq("merchant_id", merchantId)
    .neq("lifecycle_stage", "archived")
    .neq("lifecycle_stage", "lost")
    .lt("last_touch_at", cutoff)
    .order("last_touch_at", { ascending: true, nullsFirst: true })
    .limit(MAX_RESULTS);

  const now = Date.now();
  return (rows.data ?? []).map((r) => {
    const last = (r.last_touch_at ?? r.last_activity_at) as string | null;
    const days = last ? Math.floor((now - new Date(last).getTime()) / DAY_MS) : null;
    return {
      contactId:      String(r.id),
      displayName:    String(r.display_name),
      lifecycleStage: String(r.lifecycle_stage),
      lastActivityAt: (r.last_activity_at ?? null) as string | null,
      note:           days === null ? "Never had a recorded touch." : `Quiet ${days} days.`,
      metric:         days ?? undefined,
      metric_unit:    "days" as const
    };
  });
}

/** "Show <tag> customers" — matches on the CRM contacts.tags[] array. */
export async function findCustomersByTag(merchantId: string, tag: string): Promise<CustomerListEntry[]> {
  const rows = await supabaseAdmin
    .from("app_crm_contacts")
    .select("id, display_name, lifecycle_stage, last_activity_at, tags")
    .eq("merchant_id", merchantId)
    .contains("tags", [tag])
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(MAX_RESULTS);
  return (rows.data ?? []).map((r) => ({
    contactId:      String(r.id),
    displayName:    String(r.display_name),
    lifecycleStage: String(r.lifecycle_stage),
    lastActivityAt: (r.last_activity_at ?? null) as string | null,
    note:           `Tagged "${tag}".`
  }));
}

/** "Who's had repeat work?" — contacts with 2+ signed-off jobs. */
export async function findRepeatCustomers(merchantId: string): Promise<CustomerListEntry[]> {
  const rows = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select("homeowner_party_id, status")
    .eq("merchant_id", merchantId)
    .eq("status", "signed_off");

  const byParty = new Map<string, number>();
  for (const r of rows.data ?? []) {
    const p = r.homeowner_party_id as string | null;
    if (!p) continue;
    byParty.set(p, (byParty.get(p) ?? 0) + 1);
  }
  const repeats = Array.from(byParty.entries()).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, MAX_RESULTS);
  if (repeats.length === 0) return [];

  // Hydrate to contact rows.
  const partyIds = repeats.map(([p]) => p);
  const contacts = await supabaseAdmin
    .from("app_crm_contacts")
    .select("id, display_name, lifecycle_stage, last_activity_at, party_id")
    .eq("merchant_id", merchantId)
    .in("party_id", partyIds);
  const byId = new Map<string, { contactId: string; displayName: string; lifecycleStage: string; lastActivityAt: string | null }>();
  for (const c of contacts.data ?? []) {
    byId.set(String(c.party_id), {
      contactId:      String(c.id),
      displayName:    String(c.display_name),
      lifecycleStage: String(c.lifecycle_stage),
      lastActivityAt: (c.last_activity_at ?? null) as string | null
    });
  }
  return repeats
    .map(([partyId, count]) => {
      const c = byId.get(partyId);
      if (!c) return null;
      return { ...c, note: `${count} jobs signed off.`, metric: count, metric_unit: "count" as const } as CustomerListEntry;
    })
    .filter((x): x is CustomerListEntry => x !== null);
}

/** "Who leaves the best reviews?" — sort contacts by average review star. */
export async function findBestReviewers(merchantId: string): Promise<CustomerListEntry[]> {
  const rows = await supabaseAdmin
    .from("app_reviews_reviews")
    .select("rating, homeowner_party_id")
    .eq("merchant_id", merchantId);
  const byParty = new Map<string, { sum: number; count: number }>();
  for (const r of rows.data ?? []) {
    const p = r.homeowner_party_id as string | null;
    if (!p || r.rating === null || r.rating === undefined) continue;
    const cur = byParty.get(p) ?? { sum: 0, count: 0 };
    cur.sum   += Number(r.rating);
    cur.count += 1;
    byParty.set(p, cur);
  }
  const ranked = Array.from(byParty.entries())
    .map(([p, a]) => ({ partyId: p, avg: Number((a.sum / a.count).toFixed(2)), count: a.count }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, MAX_RESULTS);
  if (ranked.length === 0) return [];

  const contacts = await supabaseAdmin
    .from("app_crm_contacts")
    .select("id, display_name, lifecycle_stage, last_activity_at, party_id")
    .eq("merchant_id", merchantId)
    .in("party_id", ranked.map((r) => r.partyId));
  const byPartyToContact = new Map<string, { contactId: string; displayName: string; lifecycleStage: string; lastActivityAt: string | null }>();
  for (const c of contacts.data ?? []) {
    byPartyToContact.set(String(c.party_id), {
      contactId:      String(c.id),
      displayName:    String(c.display_name),
      lifecycleStage: String(c.lifecycle_stage),
      lastActivityAt: (c.last_activity_at ?? null) as string | null
    });
  }
  return ranked
    .map((r) => {
      const c = byPartyToContact.get(r.partyId);
      if (!c) return null;
      return { ...c, note: `${r.avg.toFixed(1)}★ average over ${r.count} review${r.count === 1 ? "" : "s"}.`, metric: r.avg, metric_unit: "stars" as const } as CustomerListEntry;
    })
    .filter((x): x is CustomerListEntry => x !== null);
}

// ─── Helper: hydrate a homeowner-id list to CRM contacts ───────────

async function hydrateHomeownersToContacts(
  items: Array<{ homeownerId: string; note: string; metric?: number; metric_unit?: "gbp" | "days" | "count" | "stars" }>,
  merchantId: string,
  limit: number
): Promise<CustomerListEntry[]> {
  const homeownerIds = items.map((i) => i.homeownerId);
  const homeowners = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("id, supabase_user_id, email_hash, whatsapp_hash")
    .in("id", homeownerIds);

  // Map homeowner → party id via os_parties.
  const partyRows = await supabaseAdmin
    .from("os_parties")
    .select("id, supabase_user_id, email_hash, whatsapp_hash");
  const partyByKey = new Map<string, string>();
  for (const p of partyRows.data ?? []) {
    if (p.supabase_user_id) partyByKey.set(`u:${p.supabase_user_id}`, String(p.id));
    if (p.email_hash)       partyByKey.set(`e:${p.email_hash}`,       String(p.id));
    if (p.whatsapp_hash)    partyByKey.set(`w:${p.whatsapp_hash}`,    String(p.id));
  }
  const homeownerToParty = new Map<string, string>();
  for (const h of homeowners.data ?? []) {
    const key = h.supabase_user_id ? `u:${h.supabase_user_id}`
              : h.email_hash       ? `e:${h.email_hash}`
              : h.whatsapp_hash    ? `w:${h.whatsapp_hash}` : null;
    const pid = key ? partyByKey.get(key) : null;
    if (pid) homeownerToParty.set(String(h.id), pid);
  }

  const partyIds = Array.from(homeownerToParty.values());
  if (partyIds.length === 0) return [];
  const contacts = await supabaseAdmin
    .from("app_crm_contacts")
    .select("id, display_name, lifecycle_stage, last_activity_at, party_id")
    .eq("merchant_id", merchantId)
    .in("party_id", partyIds);

  const contactByParty = new Map<string, { contactId: string; displayName: string; lifecycleStage: string; lastActivityAt: string | null }>();
  for (const c of contacts.data ?? []) {
    contactByParty.set(String(c.party_id), {
      contactId:      String(c.id),
      displayName:    String(c.display_name),
      lifecycleStage: String(c.lifecycle_stage),
      lastActivityAt: (c.last_activity_at ?? null) as string | null
    });
  }
  const out: CustomerListEntry[] = [];
  for (const item of items) {
    const partyId = homeownerToParty.get(item.homeownerId);
    if (!partyId) continue;
    const c = contactByParty.get(partyId);
    if (!c) continue;
    out.push({ ...c, note: item.note, metric: item.metric, metric_unit: item.metric_unit });
    if (out.length >= limit) break;
  }
  return out;
}
