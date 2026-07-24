// Enumerate the merchant's portfolio.
//
// A merchant's "projects" span two data models:
//   • hammerex_sitebook_projects — homeowner-owned; merchant sees ones
//     they've been invited to (hammerex_sitebook_members.listing_id).
//   • app_job_diary_jobs — merchant-owned; jobs may reference a
//     project_id (linking back to the sitebook project) or stand
//     alone. Includes scheduled_start_date / scheduled_end_date /
//     progress_percent / status.
//
// This helper returns the union, deduped by project_id, hydrated with
// the freshest schedule/progress fields from job_diary.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ProjectRef } from "./types";

export type EnumerateInput = {
  merchantId:        string;
  merchantListingId: string;
  /** Include archived / signed-off projects. Default false. */
  includeFinished?:  boolean;
};

export async function enumerateProjects(opts: EnumerateInput): Promise<ProjectRef[]> {
  const [members, jobs] = await Promise.all([
    // SiteBook projects the merchant has been invited to.
    supabaseAdmin
      .from("hammerex_sitebook_members")
      .select("project_id, status")
      .eq("listing_id", opts.merchantListingId)
      .neq("status", "declined"),
    // Merchant-owned job-diary jobs.
    supabaseAdmin
      .from("app_job_diary_jobs")
      .select("project_id, title, status, scheduled_end_date, actual_end_date, actual_start_date, progress_percent")
      .eq("merchant_id", opts.merchantId)
  ]);

  const projectIds = new Set<string>();
  for (const m of members.data ?? []) if (m.project_id) projectIds.add(String(m.project_id));
  for (const j of jobs.data ?? [])    if (j.project_id) projectIds.add(String(j.project_id));

  if (projectIds.size === 0) return [];

  // Hydrate project rows.
  const projects = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title, status, started_at, completed_at")
    .in("id", Array.from(projectIds));

  // Job map for schedule/progress enrichment (freshest job per project).
  const jobByProject = new Map<string, { scheduled_end_date: string | null; progress_percent: number | null }>();
  for (const j of jobs.data ?? []) {
    if (!j.project_id) continue;
    const pid = String(j.project_id);
    const cur = jobByProject.get(pid);
    const sched = (j.scheduled_end_date as string | null) ?? null;
    const prog  = (j.progress_percent as number | null) ?? null;
    if (!cur) jobByProject.set(pid, { scheduled_end_date: sched, progress_percent: prog });
    else {
      // Keep the max progress + earliest scheduled_end (soonest deadline).
      if (prog !== null && (cur.progress_percent === null || prog > cur.progress_percent)) cur.progress_percent = prog;
      if (sched && (!cur.scheduled_end_date || sched < cur.scheduled_end_date)) cur.scheduled_end_date = sched;
    }
  }

  const refs: ProjectRef[] = (projects.data ?? []).map((p) => {
    const j = jobByProject.get(String(p.id));
    return {
      project_id:       String(p.id),
      title:            String(p.title),
      status:           String(p.status),
      started_at:       (p.started_at as string | null) ?? null,
      completed_at:     (p.completed_at as string | null) ?? null,
      scheduled_end:    j?.scheduled_end_date ?? null,
      progress_percent: j?.progress_percent   ?? null
    };
  });

  if (!opts.includeFinished) {
    return refs.filter((r) => r.status !== "archived" && !r.completed_at);
  }
  return refs;
}
