// SiteBook Home Care — server-side loader for the reminders card.
//
// One card. One question ("what needs looking after?"). Top 1-2
// upcoming items rendered on the /sitebook RIGHT panel above the
// RevealUsageCard.
//
// See migration 20260719120000_hammerex_sitebook_home_care.sql.
// Blueprint: docs/SITEBOOK_BLUEPRINT_v2_2_FINAL.md · Phase 1 · Slot 1.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type HomeCareKind =
  | "boiler_service"
  | "gutter_clean"
  | "chimney_sweep"
  | "smoke_alarm_battery"
  | "gas_safety"
  | "eicr"
  | "roof_inspection"
  | "drain_rod"
  | "window_clean"
  | "septic_empty"
  | "pat_test"
  | "alarm_service"
  | "other";

export type HomeCareItem = {
  id:                          string;
  homeowner_id:                string;
  kind:                        HomeCareKind;
  title:                       string;
  description:                 string | null;
  cadence_days:                number | null;
  last_done_at:                string | null;
  next_due_at:                 string;
  previous_trade_listing_id:   string | null;
  previous_trade_slug:         string | null;
  previous_trade_name:         string | null;
  snoozed_until:               string | null;
  dismissed_at:                string | null;
  created_at:                  string;
  updated_at:                  string;
};

/** Top N Home Care items for the reminders card. Skips dismissed +
 *  snoozed-in-the-future. Ordered by next_due_at (soonest first). */
export async function loadUpcomingHomeCare(homeownerId: string, limit = 3): Promise<HomeCareItem[]> {
  const now = new Date().toISOString();
  const res = await supabaseAdmin
    .from("hammerex_sitebook_home_care_items")
    .select("*")
    .eq("homeowner_id", homeownerId)
    .is("dismissed_at", null)
    .or(`snoozed_until.is.null,snoozed_until.lt.${now}`)
    .order("next_due_at", { ascending: true })
    .limit(limit);
  return (res.data as HomeCareItem[]) ?? [];
}

/** Create a Home Care reminder. `cadenceDays` sets both the recurrence
 *  hint AND the initial next_due_at (today + cadence). Homeowner-scoped. */
export async function createHomeCareItem(input: {
  homeownerId:  string;
  title:        string;
  kind?:        HomeCareKind;
  cadenceDays?: number;
  description?: string | null;
}): Promise<{ ok: true; item: HomeCareItem } | { ok: false; error: string }> {
  if (!input.title.trim()) return { ok: false, error: "missing-title" };
  const cadence = input.cadenceDays && input.cadenceDays > 0 ? input.cadenceDays : 365;
  const nextDue = new Date(Date.now() + cadence * 24 * 60 * 60 * 1000).toISOString();
  const ins = await supabaseAdmin
    .from("hammerex_sitebook_home_care_items")
    .insert({
      homeowner_id:  input.homeownerId,
      kind:          input.kind        ?? "other",
      title:         input.title.trim().slice(0, 240),
      description:   input.description ?? null,
      cadence_days:  cadence,
      next_due_at:   nextDue
    })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) return { ok: false, error: "insert-failed" };
  return { ok: true, item: ins.data as HomeCareItem };
}

/** Human-friendly "3 weeks" / "next Tue" / "overdue" string. */
export function dueLabel(nextDueAtIso: string, now: Date = new Date()): { label: string; tone: "overdue" | "soon" | "later" } {
  const due = new Date(nextDueAtIso).getTime();
  const diff = due - now.getTime();
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  if (days < 0)   return { label: days === -1 ? "1 day overdue" : `${-days} days overdue`, tone: "overdue" };
  if (days === 0) return { label: "Due today",  tone: "soon" };
  if (days === 1) return { label: "Due tomorrow", tone: "soon" };
  if (days <= 7)  return { label: `Due in ${days} days`, tone: "soon" };
  if (days <= 30) return { label: `Due in ${Math.round(days / 7)} weeks`, tone: "later" };
  const months = Math.round(days / 30);
  return { label: months === 1 ? "Due in 1 month" : `Due in ${months} months`, tone: "later" };
}
