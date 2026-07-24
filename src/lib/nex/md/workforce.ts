// Workforce utilisation — reads job_diary_entries + sitebook_members.
//
// Signals available today:
//   • Active projects — count of hammerex_sitebook_members rows where
//     this merchant is a member with status in (hired, in-progress)
//   • Hours in last 30d — sum of job_diary_entries.hours_worked
//   • Upcoming bookings — count of app_job_diary_jobs with scheduled_start_date
//     in next 14 days
//
// Utilisation score is derived: fewer active projects + low hours =
// under-utilised (opportunity to sell more work). Many active + many
// bookings = tight (may need to add crew). Neutral = healthy.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type WorkforceSnapshot } from "./types";

const DAY_MS = 86_400_000;

export type BuildWorkforceInput = {
  merchantId:        string;
  merchantListingId: string;
  now?:              Date;
};

export async function buildWorkforce(opts: BuildWorkforceInput): Promise<WorkforceSnapshot> {
  const now = opts.now ?? new Date();
  const evidence = evidenceFor(
    "hammerex_sitebook_members + app_job_diary_entries + app_job_diary_jobs",
    ["hammerex_sitebook_members", "app_job_diary_entries", "app_job_diary_jobs"]
  );

  const [active, hours, bookings] = await Promise.all([
    supabaseAdmin
      .from("hammerex_sitebook_members")
      .select("project_id", { count: "exact", head: true })
      .eq("listing_id", opts.merchantListingId)
      .in("status", ["hired", "in-progress"]),
    supabaseAdmin
      .from("app_job_diary_entries")
      .select("hours_worked, created_at")
      .eq("merchant_id", opts.merchantId)
      .gte("created_at", new Date(now.getTime() - 30 * DAY_MS).toISOString()),
    supabaseAdmin
      .from("app_job_diary_jobs")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", opts.merchantId)
      .gte("scheduled_start_date", now.toISOString().slice(0, 10))
      .lte("scheduled_start_date", new Date(now.getTime() + 14 * DAY_MS).toISOString().slice(0, 10))
  ]);

  const activeCount = active.count ?? 0;
  const hoursSum    = (hours.data ?? []).reduce((s, r) => s + Number(r.hours_worked ?? 0), 0);
  const bookingsCount = bookings.count ?? 0;
  // Team size right now = distinct project memberships (proxy — the
  // real staff count would need a users table).
  const teamSize = activeCount;

  let note: string;
  const warnings: string[] = [];
  if (activeCount === 0 && bookingsCount === 0) {
    note = "No active projects and no bookings in the next 14 days — pipeline is quiet.";
    warnings.push("Pipeline is quiet; consider a marketing push or reactivating silent customers.");
  } else if (activeCount >= 5 && bookingsCount >= 5) {
    note = `${activeCount} active project${activeCount === 1 ? "" : "s"} and ${bookingsCount} booking${bookingsCount === 1 ? "" : "s"} scheduled — you're tight.`;
    warnings.push("Consider whether current crew has capacity, or bring in help.");
  } else {
    note = `${activeCount} active project${activeCount === 1 ? "" : "s"}, ${hoursSum.toFixed(0)} hours logged in the last 30 days, ${bookingsCount} booking${bookingsCount === 1 ? "" : "s"} scheduled in the next fortnight.`;
  }

  return {
    computed_at:           now.toISOString(),
    active_projects_count: activeCount,
    hours_last_30d:        Number(hoursSum.toFixed(1)),
    team_size_current:     teamSize,
    utilisation_note:      note,
    bookings_next_14d:     bookingsCount,
    warnings,
    evidence
  };
}
