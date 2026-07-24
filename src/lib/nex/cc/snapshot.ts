// Property snapshot builder — the full picture of a property.
//
// Unions projects + photos + documents + costs + assets + forecast +
// timeline. Cash figures are homeowner-only.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildAssets } from "./assets";
import { buildMaintenanceForecast } from "./forecast";
import { resolveProperty, type PropertyRefHint } from "./resolver";
import type { PropertySnapshot, PropertyTimelineEntry, ViewerType } from "./types";
import { evidenceFor } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { snapshot: PropertySnapshot; expiresAt: number }>();
export function _clearCcCache(): void { cache.clear(); }

export type BuildPropertySnapshotInput = {
  hint:      PropertyRefHint;
  viewer:    ViewerType;
  viewerId:  string;
  now?:      Date;
  refresh?:  boolean;
};

export type BuildPropertySnapshotResult =
  | { ok: true;  snapshot: PropertySnapshot }
  | { ok: false; reason: "not_found" | "ambiguous" | "not_yours"; matches?: unknown };

export async function buildPropertySnapshot(input: BuildPropertySnapshotInput): Promise<BuildPropertySnapshotResult> {
  const now = input.now ?? new Date();

  const resolved = await resolveProperty({ hint: input.hint, viewer: input.viewer, viewerId: input.viewerId });
  if (!resolved.ok) return { ok: false, reason: resolved.reason, matches: resolved.matches };

  const cacheKey = `${resolved.property.property_id}|${input.viewer}|${input.viewerId}|${now.toISOString().slice(0, 13)}`;
  if (!input.refresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now.getTime()) return { ok: true, snapshot: hit.snapshot };
  }

  const errors: PropertySnapshot["errors"] = [];
  const evidence = evidenceFor(
    "hammerex_sitebook_projects + photos + costs + documents + home_care_items",
    ["hammerex_sitebook_projects", "hammerex_sitebook_photos", "hammerex_sitebook_costs", "hammerex_sitebook_cost_documents", "hammerex_sitebook_home_care_items"]
  );

  const projectIds = resolved.project_ids;

  type ProjectRowShape = { id: string; title: string; status: string; started_at: string | null; completed_at: string | null };
  type PhotoRowShape   = { created_at: string; caption: string | null; project_id: string | null };

  const [projectRes, photoRes, docRes, costList, assetList] = await Promise.all([
    tryRun("projects", async (): Promise<{ data: ProjectRowShape[] }> => {
      const r = await supabaseAdmin
        .from("hammerex_sitebook_projects")
        .select("id, title, status, started_at, completed_at")
        .in("id", projectIds);
      return { data: (r.data ?? []) as ProjectRowShape[] };
    }, errors),
    tryRun("photos", async (): Promise<{ data: PhotoRowShape[]; count: number | null }> => {
      const r = await supabaseAdmin
        .from("hammerex_sitebook_photos")
        .select("id, created_at, caption, uploaded_by_name, project_id", { count: "exact" })
        .in("project_id", projectIds);
      return { data: (r.data ?? []) as PhotoRowShape[], count: r.count ?? null };
    }, errors),
    tryRun("documents", async (): Promise<{ count: number | null }> => {
      const r = await supabaseAdmin
        .from("hammerex_sitebook_cost_documents")
        .select("id, kind, file_name, created_at, project_id", { count: "exact" })
        .in("project_id", projectIds);
      return { count: r.count ?? null };
    }, errors),
    tryRun("costs",  () => merchantOrHomeownerCosts(projectIds, input.viewer, input.viewerId), errors),
    tryRun("assets", () => buildAssets({ homeownerId: resolved.property.homeowner_id, projectIds, now }), errors)
  ]);

  const projectList = (projectRes?.data ?? []).map((p) => ({
    project_id:   String(p.id),
    title:        String(p.title),
    status:       String(p.status),
    started_at:   p.started_at   ?? null,
    completed_at: p.completed_at ?? null
  }));

  const photoCount = photoRes?.count ?? 0;
  const docCount   = docRes?.count   ?? 0;

  const costs = costList ?? [];
  const agreed = costs.reduce((s, r) => s + Number(r.agreed_pence ?? 0), 0);
  const paid   = costs.reduce((s, r) => s + Number(r.paid_pence   ?? 0), 0);
  const outstanding = Math.max(0, agreed - paid);

  const assets   = assetList ?? [];
  const forecast = buildMaintenanceForecast(assets, now);

  // Timeline — one entry per project event + top photos.
  const timeline: PropertyTimelineEntry[] = [];
  for (const p of projectList) {
    if (p.started_at) {
      timeline.push({
        at:         p.started_at,
        event_type: "project_started",
        headline:   `${p.title} — started`,
        project_id: p.project_id,
        evidence
      });
    }
    if (p.completed_at) {
      timeline.push({
        at:         p.completed_at,
        event_type: "project_completed",
        headline:   `${p.title} — completed`,
        project_id: p.project_id,
        evidence
      });
    }
  }
  const photoRows = photoRes?.data ?? [];
  for (const ph of photoRows.slice(0, 20)) {
    timeline.push({
      at:         ph.created_at,
      event_type: "photo",
      headline:   ph.caption ? String(ph.caption) : "Photo uploaded",
      project_id: ph.project_id ?? undefined,
      evidence
    });
  }
  timeline.sort((a, b) => b.at.localeCompare(a.at));

  const snapshot: PropertySnapshot = {
    property:                resolved.property,
    viewer:                  input.viewer,
    projects_count:          projectList.length,
    projects:                projectList,
    photos_count:            photoCount ?? 0,
    documents_count:         docCount   ?? 0,
    costs_total_pence:       agreed,
    costs_paid_pence:        paid,
    costs_outstanding_pence: outstanding,
    assets,
    forecast,
    timeline:                timeline.slice(0, 50),
    computed_at:             now.toISOString(),
    errors
  };

  cache.set(cacheKey, { snapshot, expiresAt: now.getTime() + CACHE_TTL_MS });
  return { ok: true, snapshot };
}

async function tryRun<T>(name: string, fn: () => Promise<T>, errors: PropertySnapshot["errors"]): Promise<T | null> {
  try { return await fn(); }
  catch (err) {
    errors.push({ module: name, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function merchantOrHomeownerCosts(projectIds: string[], viewer: ViewerType, viewerId: string) {
  if (projectIds.length === 0) return [];
  const q = supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("agreed_pence, paid_pence, trade_listing_id")
    .in("project_id", projectIds);
  if (viewer === "merchant") {
    const r = await q.eq("trade_listing_id", viewerId);
    return (r.data ?? []) as Array<{ agreed_pence: number; paid_pence: number }>;
  }
  const r = await q;
  return (r.data ?? []) as Array<{ agreed_pence: number; paid_pence: number }>;
}
