// src/lib/nex/master-ai/reconciliation.ts
//
// NEX Master AI Engineer · Source Reconciliation · §9
// Philip 2026-09-07 · AUTHORIZE (Wave 2 · continuous mission)
//
// When legitimate sources disagree, DO NOT arbitrarily overwrite one.
// Classify claims into AGREED / MOST_LIKELY / CONFLICTED / UNVERIFIED /
// UNKNOWN. Preserve important conflicts. Never convert uncertainty
// into certainty.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { reconciliationsPath } from "./paths";
import type {
  ReconciliationRecord,
  ReconciliationVerdict,
  ClaimUnderTest,
  AuthorityTier,
} from "./types";

const TIER_WEIGHT: Record<AuthorityTier, number> = {
  TIER_1: 100,   // authoritative regulator/dataset
  TIER_2: 60,
  TIER_3: 30,
  TIER_4: 15,
  TIER_5: 5,
};

function normalize(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Reconcile a set of claims about the same subject.
 *  Rules:
 *    · All claims normalized-equal → AGREED · canonical = first normalized value
 *    · Any strict superiority by authority-tier → MOST_LIKELY · canonical = winner
 *    · Multiple competing claims at same top authority → CONFLICTED · canonical = null
 *    · Single claim only → UNVERIFIED · canonical = that claim
 *    · No claims → UNKNOWN · canonical = null */
export function reconcile(input: {
  subject_key: string;
  claims: ClaimUnderTest[];
}): ReconciliationRecord {
  const performed_at_iso = new Date().toISOString();

  if (input.claims.length === 0) {
    return persist({
      subject_key: input.subject_key,
      claims: [], verdict: "UNKNOWN", canonical_value: null,
      reasoning: "no_claims_provided",
      preserved_conflicts: [],
      performed_at_iso,
    });
  }

  if (input.claims.length === 1) {
    return persist({
      subject_key: input.subject_key,
      claims: input.claims,
      verdict: "UNVERIFIED",
      canonical_value: input.claims[0].normalized_value,
      reasoning: "single_source_no_cross_verification",
      preserved_conflicts: [],
      performed_at_iso,
    });
  }

  const normalized = input.claims.map((c) => ({ ...c, key: normalize(c.normalized_value) }));
  const uniqueValues = new Set(normalized.map((c) => c.key));
  if (uniqueValues.size === 1) {
    return persist({
      subject_key: input.subject_key,
      claims: input.claims,
      verdict: "AGREED",
      canonical_value: input.claims[0].normalized_value,
      reasoning: `all_${input.claims.length}_sources_agree`,
      preserved_conflicts: [],
      performed_at_iso,
    });
  }

  // Weight groups by authority tier
  const buckets = new Map<string, { total_weight: number; claims: ClaimUnderTest[] }>();
  for (const c of normalized) {
    const w = TIER_WEIGHT[c.authority_tier] ?? 0;
    const b = buckets.get(c.key) ?? { total_weight: 0, claims: [] };
    b.total_weight += w;
    b.claims.push({ source_slug: c.source_slug, authority_tier: c.authority_tier,
                    raw_value: c.raw_value, normalized_value: c.normalized_value,
                    observed_at_iso: c.observed_at_iso });
    buckets.set(c.key, b);
  }
  const ranked = Array.from(buckets.entries()).sort((a, b) => b[1].total_weight - a[1].total_weight);
  const [winnerKey, winner] = ranked[0];
  const runnerUp = ranked[1];

  if (winner.total_weight > runnerUp[1].total_weight) {
    const canonical = winner.claims[0].normalized_value;
    const preserved: ClaimUnderTest[] = [];
    for (const [key, b] of buckets) if (key !== winnerKey) preserved.push(...b.claims);
    return persist({
      subject_key: input.subject_key,
      claims: input.claims,
      verdict: "MOST_LIKELY",
      canonical_value: canonical,
      reasoning: `authority_weight_leader:${winnerKey}:${winner.total_weight}_vs_${runnerUp[0]}:${runnerUp[1].total_weight}`,
      preserved_conflicts: preserved,
      performed_at_iso,
    });
  }

  // Tie at top → CONFLICTED · canonical null · preserve everything
  const preservedTied: ClaimUnderTest[] = [];
  for (const [, b] of buckets) preservedTied.push(...b.claims);
  return persist({
    subject_key: input.subject_key,
    claims: input.claims,
    verdict: "CONFLICTED",
    canonical_value: null,
    reasoning: `authority_tie:${ranked.slice(0, 2).map(([k, b]) => `${k}=${b.total_weight}`).join(",")}`,
    preserved_conflicts: preservedTied,
    performed_at_iso,
  });
}

function persist(rec: Omit<ReconciliationRecord, "reconciliation_id">): ReconciliationRecord {
  const full: ReconciliationRecord = { ...rec, reconciliation_id: randomUUID() };
  appendJsonLine(reconciliationsPath(), full);
  return full;
}

export function readAllReconciliations(): ReconciliationRecord[] {
  return readJsonlAll<ReconciliationRecord>(reconciliationsPath());
}

export function _resetReconciliationForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(reconciliationsPath())) fs.unlinkSync(reconciliationsPath()); } catch { /* ignore */ }
}
