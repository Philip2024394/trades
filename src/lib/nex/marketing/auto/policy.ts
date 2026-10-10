// src/lib/nex/marketing/auto/policy.ts
//
// NEX Managed Email Marketing · Stage 5.5 · AUTO campaign policy enforcement
// Founder-authorised programme (§12).
//
// Smallest durable enforcement primitive · pure decision plus persisted row.
// Not a generic policy engine · not another authorization framework.
//
// A policy row answers seven questions about an AUTO campaign intent:
//   1. Is AUTO permitted for this policy? (is_active)
//   2. Is target audience permitted? (country + category + language)
//   3. Is jurisdiction permitted? (via eligibility rule set · re-checked per contact)
//   4. Is sender lane permitted? ('auto' only)
//   5. Is cadence permitted? (max_daily_sends + last_activated_at gate)
//   6. Is content/purpose permitted? (approved_content_hash present · empty = deferred)
//   7. Are suppression rules respected? (delegated to eligibility engine · not this module)
//
// The policy row is `nex.marketing_auto_policy` (Stage 5 migration).
// This module is the read/enforce layer.

import type { PoolClient } from "pg";
import type { AutoCampaignPolicy, EligibilityRefusalReason } from "./types";
import { DEFAULT_JURISDICTION_RULES } from "./eligibility";

// ─── Types ──────────────────────────────────────────────────────────
export type PolicyDecision =
  | { kind: "permitted"; policy: AutoCampaignPolicy; reason: string }
  | { kind: "denied"; policy: AutoCampaignPolicy | null; reason: PolicyDenialReason; detail: string };

export type PolicyDenialReason =
  | "policy_not_found"
  | "policy_inactive"
  | "sender_lane_mismatch"
  | "jurisdiction_restricted"
  | "cadence_exhausted"
  | "content_not_approved"
  | "audience_mismatch"
  | "budget_missing";

export interface PolicyCheckInput {
  readonly policy_id: string;
  readonly proposed_country: string;
  readonly proposed_category: string | null;
  readonly proposed_language: string | null;
  readonly proposed_sender_lane: string;
  readonly recent_daily_sends?: number;              // observed sends for the policy today (optional · caller-supplied)
  readonly content_approved?: boolean;                // true only when policy row has approved_content_hash
}

// ─── Loader ─────────────────────────────────────────────────────────
export async function loadPolicyById(client: PoolClient, policy_id: string): Promise<AutoCampaignPolicy | null> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_auto_policy WHERE policy_id = $1`,
    [policy_id],
  );
  if (res.rows.length === 0) return null;
  return rowToPolicy(res.rows[0]);
}

export async function listActivePolicies(client: PoolClient): Promise<ReadonlyArray<AutoCampaignPolicy>> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_auto_policy WHERE is_active = true ORDER BY display_name ASC`,
  );
  return res.rows.map(rowToPolicy);
}

// ─── Pure decision ──────────────────────────────────────────────────
export async function checkPolicy(client: PoolClient, input: PolicyCheckInput): Promise<PolicyDecision> {
  const policy = await loadPolicyById(client, input.policy_id);
  if (!policy) return { kind: "denied", policy: null, reason: "policy_not_found", detail: input.policy_id };
  if (!policy.is_active) return { kind: "denied", policy, reason: "policy_inactive", detail: policy.policy_id };

  // Sender lane
  if (input.proposed_sender_lane !== "auto") {
    return { kind: "denied", policy, reason: "sender_lane_mismatch", detail: `proposed=${input.proposed_sender_lane} required=auto` };
  }

  // Jurisdiction — policy's country must be recognised by the eligibility rule set
  const country = input.proposed_country.trim().toUpperCase();
  const rule = DEFAULT_JURISDICTION_RULES.get(country);
  if (!rule || rule.regime === "restricted") {
    return { kind: "denied", policy, reason: "jurisdiction_restricted", detail: `country=${country} · no permissive rule` };
  }

  // Audience alignment — policy's country/category/language must match
  if (policy.country && policy.country.toUpperCase() !== country) {
    return { kind: "denied", policy, reason: "audience_mismatch", detail: `policy.country=${policy.country} proposed=${country}` };
  }
  if (policy.category && input.proposed_category && policy.category !== input.proposed_category) {
    return { kind: "denied", policy, reason: "audience_mismatch", detail: `policy.category=${policy.category} proposed=${input.proposed_category}` };
  }
  if (policy.language && input.proposed_language && policy.language !== input.proposed_language) {
    return { kind: "denied", policy, reason: "audience_mismatch", detail: `policy.language=${policy.language} proposed=${input.proposed_language}` };
  }

  // Cadence — recent_daily_sends provided by caller (auto-service knows the current window)
  if (input.recent_daily_sends !== undefined && input.recent_daily_sends >= policy.max_daily_sends) {
    return { kind: "denied", policy, reason: "cadence_exhausted", detail: `recent_daily=${input.recent_daily_sends} max=${policy.max_daily_sends}` };
  }

  // Content — approved when caller confirms hashed/reviewed content is on record
  if (input.content_approved === false) {
    return { kind: "denied", policy, reason: "content_not_approved", detail: "policy requires approved content · caller reported not approved" };
  }

  // Budget must exist (AUTO cannot proceed without an operating budget)
  if (!policy.budget_id) {
    return { kind: "denied", policy, reason: "budget_missing", detail: "policy has no budget_id · AUTO cannot proceed" };
  }

  return {
    kind: "permitted",
    policy,
    reason: `policy=${policy.policy_id} country=${country} regime=${rule.regime} audience_ok cadence_ok content_ok budget=${policy.budget_id}`,
  };
}

// ─── Also runnable as pure function (no db) for tests ──────────────
export function checkPolicyPure(policy: AutoCampaignPolicy | null, input: PolicyCheckInput): PolicyDecision {
  if (!policy) return { kind: "denied", policy: null, reason: "policy_not_found", detail: input.policy_id };
  if (!policy.is_active) return { kind: "denied", policy, reason: "policy_inactive", detail: policy.policy_id };
  if (input.proposed_sender_lane !== "auto") {
    return { kind: "denied", policy, reason: "sender_lane_mismatch", detail: `proposed=${input.proposed_sender_lane}` };
  }
  const country = input.proposed_country.trim().toUpperCase();
  const rule = DEFAULT_JURISDICTION_RULES.get(country);
  if (!rule || rule.regime === "restricted") {
    return { kind: "denied", policy, reason: "jurisdiction_restricted", detail: `country=${country}` };
  }
  if (policy.country && policy.country.toUpperCase() !== country) {
    return { kind: "denied", policy, reason: "audience_mismatch", detail: `country policy=${policy.country} proposed=${country}` };
  }
  if (policy.category && input.proposed_category && policy.category !== input.proposed_category) {
    return { kind: "denied", policy, reason: "audience_mismatch", detail: `category policy=${policy.category} proposed=${input.proposed_category}` };
  }
  if (input.recent_daily_sends !== undefined && input.recent_daily_sends >= policy.max_daily_sends) {
    return { kind: "denied", policy, reason: "cadence_exhausted", detail: `recent=${input.recent_daily_sends} max=${policy.max_daily_sends}` };
  }
  if (input.content_approved === false) {
    return { kind: "denied", policy, reason: "content_not_approved", detail: "content not approved" };
  }
  if (!policy.budget_id) {
    return { kind: "denied", policy, reason: "budget_missing", detail: "no budget_id" };
  }
  return { kind: "permitted", policy, reason: `policy=${policy.policy_id}` };
}

// ─── Row mapping ────────────────────────────────────────────────────
function rowToPolicy(r: any): AutoCampaignPolicy {
  return {
    policy_id: r.policy_id,
    display_name: r.display_name,
    country: r.country,
    category: r.category,
    language: r.language,
    min_contact_confidence: Number(r.min_contact_confidence ?? 0),
    max_daily_sends: Number(r.max_daily_sends ?? 0),
    budget_id: r.budget_id,
    is_active: !!r.is_active,
  };
}

/** For tests that need to build a policy row without a database. */
export function mkPolicyRow(overrides: Partial<AutoCampaignPolicy> = {}): AutoCampaignPolicy {
  return {
    policy_id: overrides.policy_id ?? `pol-${Math.random().toString(36).slice(2, 10)}`,
    display_name: overrides.display_name ?? "Test Policy",
    country: overrides.country ?? "US",
    category: overrides.category ?? null,
    language: overrides.language ?? null,
    min_contact_confidence: overrides.min_contact_confidence ?? 0.5,
    max_daily_sends: overrides.max_daily_sends ?? 100,
    budget_id: overrides.budget_id ?? `budget-1`,
    is_active: overrides.is_active ?? true,
  };
}

/** Refusal reasons that overlap with eligibility · re-exported for callers. */
export type CombinedRefusal = PolicyDenialReason | EligibilityRefusalReason;
