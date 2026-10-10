// NEX Code Brain · Deterministic path-to-lane router
// Every path resolves to at most ONE lane via longest-prefix match.
// This is the invariant that makes "two agents cannot code the same file"
// mathematically impossible: given a path, the routing is a pure function.

import * as path from "node:path";
import type { AgentLane, LaneRoutingResult } from "./types";
import { loadLanes } from "./lane-registry";

const REPO_ROOT = process.cwd();

export function normaliseRel(rel_or_abs: string): string {
  const clean = rel_or_abs.replace(/\\/g, "/");
  if (path.isAbsolute(clean)) {
    return path.relative(REPO_ROOT, clean).replace(/\\/g, "/");
  }
  return clean;
}

/**
 * Return the single lane that owns a path via longest-prefix match.
 * Returns null (with no matched_prefix) if no active lane claims the path.
 */
export function routePath(path_in: string, lanes?: readonly AgentLane[]): LaneRoutingResult {
  const rel = normaliseRel(path_in);
  const source = lanes ?? loadLanes();

  let best: { lane: AgentLane; prefix: string } | null = null;
  for (const lane of source) {
    // Inactive lanes cannot be resolved to (prevents accidental routing to Twin NEX before it exists).
    if (lane.status !== "active") continue;
    for (const prefix of lane.path_prefixes) {
      const p = prefix.replace(/\\/g, "/");
      // A prefix that ends with "/" is a directory prefix; otherwise it's an exact-file claim.
      const matches = p.endsWith("/") ? rel === p.slice(0, -1) || rel.startsWith(p) : rel === p;
      if (!matches) continue;
      if (!best || p.length > best.prefix.length) {
        best = { lane, prefix: p };
      }
    }
  }
  return {
    path: rel,
    resolved_lane: best ? best.lane.lane_id : null,
    matched_prefix: best ? best.prefix : null,
  };
}

/** Batch route · returns per-path mapping and the distinct set of lanes touched. */
export function routePaths(paths: readonly string[]): {
  readonly per_path: Readonly<Record<string, string | null>>;
  readonly distinct_lanes: readonly string[];
  readonly unresolved: readonly string[];
} {
  const lanes = loadLanes();
  const per_path: Record<string, string | null> = {};
  const distinctSet = new Set<string>();
  const unresolved: string[] = [];
  for (const p of paths) {
    const r = routePath(p, lanes);
    per_path[r.path] = r.resolved_lane;
    if (r.resolved_lane === null) unresolved.push(r.path);
    else distinctSet.add(r.resolved_lane);
  }
  return {
    per_path,
    distinct_lanes: Array.from(distinctSet),
    unresolved,
  };
}
