// SiteBook Things to fix — server-side loader for the snagging card.
//
// Rule 1: answers "What still needs fixing?"
// Rule 2: replaces the paper snagging list + "did I tell the plumber
//         about the drip?" mental load
// Rule 3: unresolved items surface on the card; fixed items disappear
//         from the primary view (still queryable in the ledger later)
//
// See migration 20260719160000_hammerex_sitebook_things_to_fix.sql.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ThingStatus =
  | "open"
  | "in_progress"
  | "fixed"
  | "confirmed"
  | "dismissed";

export type ThingToFix = {
  id:                    string;
  homeowner_id:          string;
  project_id:            string | null;
  title:                 string;
  photo_url:             string | null;
  assignee_listing_id:   string | null;
  assignee_name:         string | null;
  status:                ThingStatus;
  post_id:               string | null;
  fixed_photo_url:       string | null;
  fixed_at:              string | null;
  confirmed_at:          string | null;
  dismissed_at:          string | null;
  created_at:            string;
  updated_at:            string;
};

/** Top N open / in-progress / fixed items for the right-rail card.
 *  Confirmed + dismissed items skipped by default. */
export async function loadOpenThingsToFix(homeownerId: string, limit = 4): Promise<ThingToFix[]> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_things_to_fix")
    .select("*")
    .eq("homeowner_id", homeownerId)
    .in("status", ["open", "in_progress", "fixed"])
    .order("created_at", { ascending: false })
    .limit(limit);
  return (res.data as ThingToFix[]) ?? [];
}

/** Create a new Thing to fix. Homeowner-scoped. */
export async function createThingToFix(input: {
  homeownerId:          string;
  title:                string;
  projectId?:           string | null;
  photoUrl?:            string | null;
  assigneeListingId?:   string | null;
  assigneeName?:        string | null;
  postId?:              string | null;
}): Promise<{ ok: true; thing: ThingToFix } | { ok: false; error: string }> {
  if (!input.title.trim()) return { ok: false, error: "missing-title" };
  const ins = await supabaseAdmin
    .from("hammerex_sitebook_things_to_fix")
    .insert({
      homeowner_id:         input.homeownerId,
      title:                input.title.trim().slice(0, 240),
      project_id:           input.projectId          ?? null,
      photo_url:            input.photoUrl           ?? null,
      assignee_listing_id:  input.assigneeListingId  ?? null,
      assignee_name:        input.assigneeName       ?? null,
      post_id:              input.postId             ?? null,
      status:               "open"
    })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) return { ok: false, error: "insert-failed" };
  return { ok: true, thing: ins.data as ThingToFix };
}
