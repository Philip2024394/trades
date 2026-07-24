// Portfolio overview — one row per project, ranked worst-health first.
//
// Runs Phase 6 PI (buildProjectSnapshot) per project IN PARALLEL,
// pulls the health score + top observations. Never duplicates PI.

import { buildProjectSnapshot } from "../pi";
import { enumerateProjects } from "./enumerate";
import { evidenceFor, type ProjectHealthRow, type ProjectsOverview } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { overview: ProjectsOverview; expiresAt: number }>();
export function _clearPmCache(): void { cache.clear(); }

export type BuildOverviewInput = {
  merchantSlug:      string;
  merchantId:        string;
  merchantListingId: string;
  now?:              Date;
  refresh?:          boolean;
  /** Only surface the N worst projects. Default 10. */
  limit?:            number;
};

export async function buildProjectsOverview(opts: BuildOverviewInput): Promise<ProjectsOverview> {
  const now      = opts.now ?? new Date();
  const hourKey  = now.toISOString().slice(0, 13);
  const cacheKey = `${opts.merchantSlug}|${hourKey}`;
  if (!opts.refresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now.getTime()) return hit.overview;
  }

  const refs = await enumerateProjects({ merchantId: opts.merchantId, merchantListingId: opts.merchantListingId });
  const warnings: string[] = [];
  const errors: ProjectsOverview["errors"] = [];

  if (refs.length === 0) {
    const overview: ProjectsOverview = {
      computed_at:   now.toISOString(),
      merchant_slug: opts.merchantSlug,
      projects:      [],
      warnings:      ["No active projects on file — nothing to rank."],
      errors:        []
    };
    cache.set(cacheKey, { overview, expiresAt: now.getTime() + CACHE_TTL_MS });
    return overview;
  }

  const rows = await Promise.all(refs.map(async (ref): Promise<ProjectHealthRow | null> => {
    try {
      const res = await buildProjectSnapshot({
        projectId: ref.project_id,
        viewer:    "merchant",
        viewerId:  opts.merchantListingId,
        now
      });
      if (!res.ok) {
        errors.push({ project_id: ref.project_id, error: res.reason });
        return null;
      }
      const snap = res.snapshot;
      const top  = snap.observations.slice(0, 3).map((o) => ({ severity: o.severity, headline: o.headline }));
      const summary = summarise(top, snap.health.headline);
      return {
        project:             ref,
        health_score:        snap.health.score,
        band:                snap.health.band,
        observation_summary: summary,
        top_observations:    top,
        evidence:            evidenceFor("Phase 6 PI (project snapshot)", ["hammerex_sitebook_projects"])
      };
    } catch (err) {
      errors.push({ project_id: ref.project_id, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }));

  const projects = rows
    .filter((r): r is ProjectHealthRow => r !== null)
    .sort((a, b) => a.health_score - b.health_score)
    .slice(0, opts.limit ?? 10);

  const overview: ProjectsOverview = {
    computed_at:   now.toISOString(),
    merchant_slug: opts.merchantSlug,
    projects,
    warnings,
    errors
  };
  cache.set(cacheKey, { overview, expiresAt: now.getTime() + CACHE_TTL_MS });
  return overview;
}

function summarise(top: ProjectHealthRow["top_observations"], fallback: string): string {
  if (top.length === 0) return fallback;
  const worst = top[0];
  return worst.headline;
}
