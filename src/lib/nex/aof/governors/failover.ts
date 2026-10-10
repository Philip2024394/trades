// src/lib/nex/aof/governors/failover.ts
//
// NEX Autonomous Operations Framework · Source failover selection
// Founder-authorised programme · 2026-09-22.
//
// Given a set of Founder-signed candidate sources and current cooldown
// state, pick the next source to attempt. Never bypasses cooldown. Never
// returns a source that isn't Founder-signed. If all sources are on
// cooldown, returns null with a machine-readable reason so the orbiting
// agent can pause the cycle honestly (rather than force a fetch).

import type { PgClient, AofSourceCooldown } from "../types";
import { listActiveCooldowns } from "./source-cooldown";

export interface SourceCandidate {
  readonly source_slug: string;
  readonly priority: number;              // higher = try first
  readonly founder_signed: boolean;
  readonly enabled: boolean;
  readonly capabilities?: ReadonlyArray<string>;
  readonly country_scope?: ReadonlyArray<string> | null;   // ['*'] or country_iso codes
  readonly term_scope?: ReadonlyArray<string> | null;      // e.g. ['scaffolding']
}

export interface SelectSourceInput {
  readonly candidates: ReadonlyArray<SourceCandidate>;
  readonly country_iso: string;
  readonly term: string;
  readonly now?: Date;
}

export interface SelectSourceResult {
  readonly selected: SourceCandidate | null;
  readonly reason: string;
  readonly considered: ReadonlyArray<{ source_slug: string; skipped_reason: string | null }>;
  readonly cooldowns_active: ReadonlyArray<AofSourceCooldown>;
}

export async function selectNextSource(client: PgClient, input: SelectSourceInput): Promise<SelectSourceResult> {
  const now = input.now ?? new Date();
  const cds = await listActiveCooldowns(client, now);
  const cdMap = new Map(cds.map(c => [c.source_slug, c]));
  const considered: Array<{ source_slug: string; skipped_reason: string | null }> = [];

  // Sort by priority desc
  const sorted = [...input.candidates].sort((a, b) => b.priority - a.priority);
  for (const c of sorted) {
    if (!c.founder_signed) { considered.push({ source_slug: c.source_slug, skipped_reason: "not_founder_signed" }); continue; }
    if (!c.enabled) { considered.push({ source_slug: c.source_slug, skipped_reason: "disabled" }); continue; }
    if (cdMap.has(c.source_slug)) { considered.push({ source_slug: c.source_slug, skipped_reason: "cooldown_active" }); continue; }
    if (c.country_scope && c.country_scope.length > 0 && !c.country_scope.includes("*") && !c.country_scope.includes(input.country_iso)) {
      considered.push({ source_slug: c.source_slug, skipped_reason: `country_out_of_scope:${input.country_iso}` }); continue;
    }
    if (c.term_scope && c.term_scope.length > 0 && !c.term_scope.includes(input.term) && !c.term_scope.includes("*")) {
      considered.push({ source_slug: c.source_slug, skipped_reason: `term_out_of_scope:${input.term}` }); continue;
    }
    considered.push({ source_slug: c.source_slug, skipped_reason: null });
    return { selected: c, reason: "priority_top_uncooled_signed_in_scope", considered, cooldowns_active: cds };
  }
  return {
    selected: null,
    reason: cds.length > 0 ? "all_candidates_cooled_or_out_of_scope" : "no_founder_signed_in_scope_candidates",
    considered,
    cooldowns_active: cds,
  };
}

export const _FAILOVER_NEVER_BYPASSES_COOLDOWN =
  "selectNextSource_skips_sources_with_active_cooldown_row_never_uses_them";
export const _FAILOVER_NEVER_USES_UNSIGNED_SOURCE =
  "candidate_with_founder_signed_false_always_skipped_with_not_founder_signed_reason";
