// src/lib/nex/master-ai/source-federation.ts
//
// NEX Master AI Engineer · Source Federation Engine · §7 §38.3
// Philip 2026-09-07 · AUTHORIZE (Wave 2 · continuous mission)
//
// Given an ordered list of legitimate source candidates, pick the
// best one to use RIGHT NOW based on real signals:
//   · authorization state (M5)
//   · latest health (this module)
//   · quota (cost-intelligence.ts · fail-closed)
//
// SOURCE A healthy · use A.
// SOURCE A approaching limit · use B.
// SOURCE B unavailable · use C.
// ALL live sources unavailable · caller falls back to offline reservoir.
//
// NEVER silently exceeds a source's authorized limits.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { sourceHealthPath } from "./paths";
import { getSource } from "./research-engine";
import { checkQuota } from "./cost-intelligence";
import type {
  SourceHealthRecord,
  SourceHealthState,
  SourceSelectionResult,
  UsageMetric,
} from "./types";

const HEALTH_FRESH_WINDOW_MS = 10 * 60_000;      // health record considered fresh for 10 min

// ─── Health tracking ───────────────────────────────────────────────

export function recordSourceHealth(input: Omit<SourceHealthRecord, "record_id" | "observed_at_iso">): SourceHealthRecord {
  const record: SourceHealthRecord = {
    ...input,
    record_id: randomUUID(),
    observed_at_iso: new Date().toISOString(),
  };
  appendJsonLine(sourceHealthPath(), record);
  return record;
}

export function readAllHealth(): SourceHealthRecord[] {
  return readJsonlAll<SourceHealthRecord>(sourceHealthPath());
}

export function latestHealth(source_slug: string, nowMs = Date.now()): SourceHealthRecord | null {
  let latest: SourceHealthRecord | null = null;
  for (const r of readAllHealth()) if (r.source_slug === source_slug) latest = r;
  if (!latest) return null;
  const t = Date.parse(latest.observed_at_iso);
  if (!Number.isFinite(t) || (nowMs - t) > HEALTH_FRESH_WINDOW_MS) {
    // Stale — return the record but caller should treat as UNKNOWN.
    return { ...latest, health: "UNKNOWN" };
  }
  return latest;
}

// ─── Source selection (A → B → C → offline) ────────────────────────

function isSelectable(health: SourceHealthState): boolean {
  return health === "HEALTHY" || health === "APPROACHING_LIMIT";
}

export function selectSource(input: {
  candidate_slugs: string[];       // ordered preference · try in order
  metric: UsageMetric;
  units_required: number;
  now?: number;
}): SourceSelectionResult {
  const alternatives_skipped: Array<{ source_slug: string; reason: string }> = [];
  for (const slug of input.candidate_slugs) {
    const source = getSource(slug);
    if (!source) {
      alternatives_skipped.push({ source_slug: slug, reason: "unregistered_source" });
      continue;
    }
    if (source.authorization_state !== "AUTHORIZED") {
      alternatives_skipped.push({ source_slug: slug, reason: `unauthorized:${source.authorization_state}` });
      continue;
    }
    const health = latestHealth(slug, input.now);
    if (health && !isSelectable(health.health)) {
      alternatives_skipped.push({ source_slug: slug, reason: `health:${health.health}` });
      continue;
    }
    // Quota fail-closed
    const quota = checkQuota({ source_slug: slug, metric: input.metric, units: input.units_required, now: input.now });
    if (!quota.allowed) {
      alternatives_skipped.push({ source_slug: slug, reason: `quota:${quota.reason}` });
      continue;
    }
    return {
      chosen: slug,
      reason: health
        ? `selected:${slug}:health=${health.health}`
        : `selected:${slug}:health=unknown_but_quota_ok`,
      alternatives_skipped,
    };
  }
  return {
    chosen: null,
    reason: "no_candidate_selectable_fallback_to_offline_reservoir",
    alternatives_skipped,
  };
}

export function _resetSourceFederationForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(sourceHealthPath())) fs.unlinkSync(sourceHealthPath()); } catch { /* ignore */ }
}
