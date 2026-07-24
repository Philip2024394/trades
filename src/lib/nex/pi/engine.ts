// Project snapshot builder — one call, one snapshot.
//
// 1. Verifies the viewer can access the project (permission gate).
// 2. Loads the project identity row.
// 3. Runs every aspect adapter in parallel, catches errors.
// 4. Filters visible_to fields against the viewer as a last-mile
//    guard (adapter errors mustn't leak data).
// 5. Aggregates health + timeline + observations.
//
// Cached per (project, viewer, hour) — snapshots don't change enough
// within an hour to justify re-querying and viewers can't accidentally
// hit each other's cache because viewer is in the key.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeProjectHealth } from "./health";
import { assertAccess } from "./permissions";
import { ADAPTERS } from "./registry";
import {
  filterVisible,
  type AspectMetrics,
  type Observation,
  type ProjectAspect,
  type ProjectIdentity,
  type ProjectSnapshot,
  type TimelineEvent,
  type ViewerType
} from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { snapshot: ProjectSnapshot; expiresAt: number }>();

export function _clearPiCache(): void { cache.clear(); }

export type BuildProjectOptions = {
  projectId:    string;
  viewer:       ViewerType;
  viewerId:     string;
  lookbackDays?: number;
  now?:         Date;
  refresh?:     boolean;
};

export type BuildResult =
  | { ok: true;  snapshot: ProjectSnapshot }
  | { ok: false; reason: "not_owner" | "not_member" | "project_missing" | "load_failed" };

export async function buildProjectSnapshot(opts: BuildProjectOptions): Promise<BuildResult> {
  const now      = opts.now ?? new Date();
  const hourKey  = now.toISOString().slice(0, 13);
  const cacheKey = `${opts.projectId}|${opts.viewer}|${opts.viewerId}|${hourKey}`;

  if (!opts.refresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now.getTime()) return { ok: true, snapshot: hit.snapshot };
  }

  // Permission gate first — bails before any adapter runs.
  const access = await assertAccess(opts.projectId, opts.viewer, opts.viewerId);
  if (!access.ok) return { ok: false, reason: access.reason };

  // Project identity — small row every snapshot embeds.
  const projRow = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title, status, address_city, cover_photo_url, started_at, completed_at, budget_min_gbp, budget_max_gbp, total_spent_gbp")
    .eq("id", opts.projectId)
    .maybeSingle();
  if (!projRow.data) return { ok: false, reason: "project_missing" };
  const project = projRow.data as ProjectIdentity;

  const results = await Promise.all(
    ADAPTERS.map(async (adapter) => {
      try {
        return await adapter.run({
          projectId:    opts.projectId,
          viewer:       opts.viewer,
          viewerId:     opts.viewerId,
          lookbackDays: opts.lookbackDays,
          now
        });
      } catch (err) {
        return errorAspect(adapter, err);
      }
    })
  );

  // Last-mile permission filter. Adapters SHOULD filter themselves;
  // this defends against forgotten flags.
  const aspects: AspectMetrics[] = results.map((a) => ({
    ...a,
    metrics:      filterVisible(a.metrics,      opts.viewer),
    observations: filterVisible(a.observations, opts.viewer),
    timeline:     filterVisible(a.timeline,     opts.viewer)
  }));

  const errors: ProjectSnapshot["errors"] = [];
  for (const a of aspects) if (a.error) errors.push({ aspect: a.aspect, error: a.error });

  const observations: Observation[] = aspects
    .flatMap((a) => a.observations)
    .sort(bySeverity);

  const timeline: TimelineEvent[] = aspects
    .flatMap((a) => a.timeline)
    .sort((a, b) => b.at.localeCompare(a.at));

  const health = computeProjectHealth(aspects);

  const snapshot: ProjectSnapshot = {
    project,
    viewer:       opts.viewer,
    health,
    aspects:      aspects.sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label)),
    observations,
    timeline,
    computed_at:  now.toISOString(),
    errors
  };

  cache.set(cacheKey, { snapshot, expiresAt: now.getTime() + CACHE_TTL_MS });
  return { ok: true, snapshot };
}

function errorAspect(adapter: { aspect: ProjectAspect; label: string; weight: number }, err: unknown): AspectMetrics {
  return {
    aspect:       adapter.aspect,
    label:        adapter.label,
    sub_score:    null,
    weight:       adapter.weight,
    metrics:      [],
    observations: [],
    timeline:     [],
    error:        err instanceof Error ? err.message : String(err)
  };
}

const SEV_RANK: Record<Observation["severity"], number> = { alert: 0, warning: 1, notice: 2, info: 3 };
function bySeverity(a: Observation, b: Observation): number { return SEV_RANK[a.severity] - SEV_RANK[b.severity]; }
