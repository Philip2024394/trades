// src/lib/nex/authorization/policy.ts
//
// Founder 2026-09-10 · Authorization Policy enforcer.
//
// The ONE gate every autonomous NEX action passes through.
//
// Contract:
//   1. Agent proposes an action (subsystem + action_kind + target)
//   2. `authorizeAction()` finds an active, non-expired, non-revoked
//      policy matching (subsystem, agent_class, action_kind)
//   3. Policy conditions checked against provided evidence
//   4. Rate limits (per-hour, per-day, total) checked & decremented atomically
//   5. Action recorded immutably in nex.authorized_action
//   6. Returns { authorized: true, policy_id } or { authorized: false, reason }
//
// If NO policy exists → returns { authorized: false, reason: "no_policy" }.
// Agents must never bypass this gate. If an action is Level 3 and no
// policy authorizes it, use `proposeLevel3Action()` to queue for founder.

import { createHmac } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../db";

export type Subsystem =
  | "marketing_email"
  | "lab_promotion"
  | "programmer"
  | "external_api"
  | "spending"
  | "account_creation"
  | "database_destructive";

export type ActionLevel = 1 | 2 | 3;

export interface PolicyRecord {
  policy_id: string;
  slug: string;
  subsystem: string;
  agent_class: string;
  action_kind: string;
  action_level: ActionLevel;
  conditions: Record<string, unknown>;
  max_actions_per_hour: number | null;
  max_actions_per_day: number | null;
  max_actions_total: number | null;
  active: boolean;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface AuthorizeActionInput {
  subsystem: Subsystem | string;
  agent_class: string;
  action_kind: string;
  agent_id: string;
  target_ref?: string;
  target_summary?: string;
  evidence?: Record<string, unknown>;
  request_id?: string;
}

export type AuthorizeActionResult =
  | { authorized: true; policy_id: string; policy_slug: string }
  | { authorized: false; reason: string; detail?: string };

// ─── Signature primitive (policy-scoped, not per-record) ──────────
export function signPolicy(input: {
  slug: string;
  subsystem: string;
  agent_class: string;
  action_kind: string;
  action_level: number;
  conditions: Record<string, unknown>;
  authorized_by_user_id: string;
  authorized_at: string;
}): string {
  const secret = process.env.NEX_LAB_PROMOTION_SECRET ?? "";
  if (secret.length < 32) throw new Error("policy_secret_not_configured");
  // Deterministic payload — sort keys for stable HMAC
  const payload = JSON.stringify({
    slug: input.slug,
    subsystem: input.subsystem,
    agent_class: input.agent_class,
    action_kind: input.action_kind,
    action_level: input.action_level,
    conditions: sortKeys(input.conditions),
    authorized_by_user_id: input.authorized_by_user_id,
    authorized_at: input.authorized_at,
  });
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function sortKeys<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(sortKeys) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as Record<string, unknown>).sort()) {
    out[k] = sortKeys((v as Record<string, unknown>)[k]);
  }
  return out as T;
}

// ─── Main gate ────────────────────────────────────────────────────
/**
 * The one gate every autonomous NEX action passes through.
 * Fail-closed: any error path returns { authorized: false }.
 */
export async function authorizeAction(input: AuthorizeActionInput): Promise<AuthorizeActionResult> {
  const pool = await getPool();
  if (!pool) return { authorized: false, reason: "postgres_unavailable" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 1. Find the most-permissive active policy matching this request
    const policyR = await client.query<PolicyRecord & { hourly_bucket: Date; daily_bucket: Date; action_count_last_hour: number; action_count_last_day: number; action_count: string | number }>(
      `SELECT policy_id, slug, subsystem, agent_class, action_kind, action_level,
              conditions, max_actions_per_hour, max_actions_per_day, max_actions_total,
              active, expires_at, revoked_at,
              hourly_bucket, daily_bucket, action_count_last_hour, action_count_last_day, action_count
       FROM nex.authorization_policy
       WHERE subsystem = $1 AND agent_class = $2 AND action_kind = $3
         AND active = TRUE AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY authorized_at DESC LIMIT 1
       FOR UPDATE`,
      [input.subsystem, input.agent_class, input.action_kind],
    );
    if (policyR.rowCount === 0) {
      await client.query("ROLLBACK");
      return { authorized: false, reason: "no_policy",
        detail: `no active policy for ${input.subsystem}/${input.agent_class}/${input.action_kind}` };
    }
    const policy = policyR.rows[0];
    // 2. Check policy conditions against provided evidence
    const condCheck = checkConditions(policy.conditions, input.evidence ?? {});
    if (!condCheck.ok) {
      await client.query("ROLLBACK");
      return { authorized: false, reason: "conditions_not_met", detail: condCheck.reason };
    }
    // 3. Rate limits (per-hour, per-day, lifetime) · reset buckets on hour/day boundary
    const now = new Date();
    const currentHourly = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
    const currentDaily = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let hourCount = policy.action_count_last_hour;
    let dayCount = policy.action_count_last_day;
    if (new Date(policy.hourly_bucket).getTime() !== currentHourly.getTime()) hourCount = 0;
    if (new Date(policy.daily_bucket).toISOString().slice(0, 10) !== currentDaily.toISOString().slice(0, 10)) dayCount = 0;

    if (policy.max_actions_per_hour !== null && hourCount >= policy.max_actions_per_hour) {
      await client.query("ROLLBACK");
      return { authorized: false, reason: "rate_limit_hour", detail: `${hourCount}/${policy.max_actions_per_hour} used this hour` };
    }
    if (policy.max_actions_per_day !== null && dayCount >= policy.max_actions_per_day) {
      await client.query("ROLLBACK");
      return { authorized: false, reason: "rate_limit_day", detail: `${dayCount}/${policy.max_actions_per_day} used today` };
    }
    if (policy.max_actions_total !== null && Number(policy.action_count) >= policy.max_actions_total) {
      await client.query("ROLLBACK");
      return { authorized: false, reason: "rate_limit_total", detail: `${policy.action_count}/${policy.max_actions_total} lifetime` };
    }
    // 4. Atomically bump counters
    await client.query(
      `UPDATE nex.authorization_policy
       SET action_count = action_count + 1,
           action_count_last_hour = $1,
           action_count_last_day = $2,
           hourly_bucket = $3,
           daily_bucket = $4,
           last_action_at = now()
       WHERE policy_id = $5`,
      [hourCount + 1, dayCount + 1, currentHourly, currentDaily, policy.policy_id]
    );
    // 5. Record the action
    await client.query(
      `INSERT INTO nex.authorized_action
         (policy_id, agent_id, action_kind, target_ref, target_summary, evidence, result, request_id)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'ok', $7::uuid)`,
      [policy.policy_id, input.agent_id, input.action_kind, input.target_ref ?? null, input.target_summary ?? null,
       JSON.stringify(input.evidence ?? {}), input.request_id ?? null],
    );
    await client.query("COMMIT");
    return { authorized: true, policy_id: policy.policy_id, policy_slug: policy.slug };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    return { authorized: false, reason: "internal_error", detail: String(err).slice(0, 200) };
  } finally { client.release(); }
}

// ─── Condition checker ────────────────────────────────────────────
// Policy conditions are a whitelist of keys the agent must satisfy.
// Currently supported (extend as needed):
//   {"consent_required": "opt_in" | "discovered_or_stronger"}
//   {"quality_score_min": 0.7}
//   {"segment_filter": { country, category_group, category_slug, city }}
//   {"template_slug": "welcome-invite-2026-09"}
//   {"country_whitelist": ["ID","MY"]}
//   {"business_hours_only": true}  · limits sends 08:00-20:00 local
function checkConditions(conditions: Record<string, unknown>, evidence: Record<string, unknown>): { ok: true } | { ok: false; reason: string } {
  if (typeof conditions.consent_required === "string") {
    const level = String(evidence.consent_basis ?? "");
    const need = conditions.consent_required;
    const rank = (l: string) => l === "explicit_opt_in" ? 3 : l === "implicit" ? 2 : l === "discovered" ? 1 : 0;
    const needRank = need === "opt_in" ? 3 : need === "implicit_or_stronger" ? 2 : need === "discovered_or_stronger" ? 1 : 0;
    if (rank(level) < needRank) return { ok: false, reason: `consent_${level || "missing"}_below_${need}` };
  }
  if (typeof conditions.quality_score_min === "number") {
    const q = Number(evidence.quality_score);
    if (!Number.isFinite(q) || q < conditions.quality_score_min) {
      return { ok: false, reason: `quality_${q}_below_${conditions.quality_score_min}` };
    }
  }
  if (Array.isArray(conditions.country_whitelist)) {
    const country = String(evidence.country ?? "");
    if (!conditions.country_whitelist.includes(country)) {
      return { ok: false, reason: `country_${country}_not_in_whitelist` };
    }
  }
  if (typeof conditions.segment_filter === "object" && conditions.segment_filter) {
    const sf = conditions.segment_filter as Record<string, unknown>;
    for (const k of ["country", "category_group", "category_slug", "city", "language"]) {
      if (sf[k] && String(evidence[k]) !== String(sf[k])) {
        return { ok: false, reason: `segment_mismatch_${k}` };
      }
    }
  }
  if (conditions.business_hours_only === true) {
    const h = new Date().getHours();
    if (h < 8 || h >= 20) return { ok: false, reason: "outside_business_hours" };
  }
  return { ok: true };
}

// ─── Level 3 proposal ─────────────────────────────────────────────
export async function proposeLevel3Action(input: {
  agent_id: string;
  subsystem: Subsystem | string;
  action_kind: string;
  target_ref?: string;
  justification: string;
  evidence?: Record<string, unknown>;
  proposed_by?: string;
}): Promise<{ pending_id: string }> {
  const pool = await getPool();
  if (!pool) throw new Error("postgres_unavailable");
  const c = await pool.connect();
  try {
    const r = await c.query(
      `INSERT INTO nex.pending_level3_action
         (agent_id, subsystem, action_kind, target_ref, proposed_by, justification, evidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING pending_id`,
      [input.agent_id, input.subsystem, input.action_kind, input.target_ref ?? null,
       input.proposed_by ?? input.agent_id, input.justification, JSON.stringify(input.evidence ?? {})]
    );
    return { pending_id: r.rows[0].pending_id };
  } finally { c.release(); }
}

// ─── Introspection helper for the Lab UI ───────────────────────────
export async function listActivePolicies(subsystem?: string): Promise<PolicyRecord[]> {
  const pool = await getPool();
  if (!pool) return [];
  const c = await pool.connect();
  try {
    const where = subsystem ? "WHERE subsystem = $1 AND active = TRUE AND revoked_at IS NULL" : "WHERE active = TRUE AND revoked_at IS NULL";
    const params = subsystem ? [subsystem] : [];
    const r = await c.query(
      `SELECT policy_id, slug, subsystem, agent_class, action_kind, action_level,
              conditions, max_actions_per_hour, max_actions_per_day, max_actions_total,
              active, expires_at, revoked_at, action_count, last_action_at
       FROM nex.authorization_policy ${where} ORDER BY authorized_at DESC`,
      params
    );
    return r.rows as PolicyRecord[];
  } finally { c.release(); }
}
