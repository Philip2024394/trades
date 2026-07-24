// Loader — turn completed-project rows in Supabase into anonymised
// fingerprints. Consent-gated per project (default opt_out).
//
// This is where the CONTRIBUTION FLOW lives. A merchant explicitly
// opts in (per project) and the loader passes their completed
// project's aggregate stats through anonymiseProject() into the
// fingerprint set. Anything without consent stays out.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { anonymiseProject } from "./anonymise";
import { resolveConsent } from "./consent";
import type { ProjectFingerprint } from "./types";

const DAY_MS = 86_400_000;

export type LoadFingerprintsInput = {
  /** How far back to consider completed projects. Default 730 days. */
  lookbackDays?: number;
  /** Merchants/projects that have explicitly opted in this call
   *  (persistence isn't wired yet so callers pass overrides). */
  optInProjectIds?: string[];
  now?:            Date;
};

export async function loadFingerprints(opts: LoadFingerprintsInput = {}): Promise<ProjectFingerprint[]> {
  const now      = opts.now ?? new Date();
  const window   = opts.lookbackDays ?? 730;
  const fromIso  = new Date(now.getTime() - window * DAY_MS).toISOString();

  const projects = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title, description, status, address_postcode, started_at, completed_at, homeowner_id")
    .not("completed_at", "is", null)
    .gte("completed_at", fromIso)
    .limit(2000);

  const projectRows = projects.data ?? [];
  if (projectRows.length === 0) return [];

  const optIn = new Set((opts.optInProjectIds ?? []).map((s) => String(s)));
  const consenting = projectRows.filter((p) => {
    const consent = resolveConsent({
      projectId:    String(p.id),
      merchantSlug: "",           // merchant slug not needed for the default-out gate
      override:     optIn.has(String(p.id)) ? "opt_in" : undefined
    });
    return consent.status === "opt_in";
  });
  if (consenting.length === 0) return [];

  const projectIds = consenting.map((p) => String(p.id));

  const [members, costs] = await Promise.all([
    supabaseAdmin
      .from("hammerex_sitebook_members")
      .select("project_id, trade_type, status")
      .in("project_id", projectIds)
      .neq("status", "declined"),
    supabaseAdmin
      .from("hammerex_sitebook_costs")
      .select("project_id, kind, paid_pence, agreed_pence")
      .in("project_id", projectIds)
      .neq("status", "cancelled")
  ]);

  const membersByProject = new Map<string, { count: number; primary_trade: string | null }>();
  for (const m of members.data ?? []) {
    const pid = String(m.project_id);
    const cur = membersByProject.get(pid) ?? { count: 0, primary_trade: null };
    cur.count += 1;
    if (!cur.primary_trade && m.trade_type) cur.primary_trade = String(m.trade_type);
    membersByProject.set(pid, cur);
  }

  const costsByProject = new Map<string, { materials: number; labour: number }>();
  for (const c of costs.data ?? []) {
    const pid = String(c.project_id);
    const cur = costsByProject.get(pid) ?? { materials: 0, labour: 0 };
    const spend = Number(c.paid_pence ?? 0) > 0 ? Number(c.paid_pence) : Number(c.agreed_pence ?? 0);
    if (c.kind === "materials")      cur.materials += spend;
    else if (c.kind === "labour")    cur.labour    += spend;
    costsByProject.set(pid, cur);
  }

  const fingerprints: ProjectFingerprint[] = [];
  for (const p of consenting) {
    const meta = membersByProject.get(String(p.id)) ?? { count: 0, primary_trade: null };
    const csts = costsByProject.get(String(p.id)) ?? { materials: 0, labour: 0 };
    const fp = anonymiseProject(
      {
        id:               String(p.id),
        title:            String(p.title),
        description:      (p.description as string | null) ?? null,
        status:           String(p.status),
        address_postcode: (p.address_postcode as string | null) ?? null,
        started_at:       (p.started_at as string | null) ?? null,
        completed_at:     (p.completed_at as string | null) ?? null
      },
      meta.primary_trade ?? "unknown",
      {
        members_count:         meta.count > 0 ? meta.count : null,
        labour_hours:          null,                   // not sourced yet (job_diary_entries is per-merchant)
        materials_spend_pence: csts.materials > 0 ? csts.materials : null,
        labour_spend_pence:    csts.labour    > 0 ? csts.labour    : null
      }
    );
    if (fp) fingerprints.push(fp);
  }
  return fingerprints;
}
