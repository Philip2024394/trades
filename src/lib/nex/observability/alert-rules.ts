// src/lib/nex/observability/alert-rules.ts
//
// F5 · Alert-rule storage adapter. Reads and writes nex.alert_rules
// via the shared NEX Postgres pool. Isolated from the route so the
// route stays thin and the storage is unit-testable.

import { withClient } from "@/lib/nex/db";

export type Comparison = "gt" | "gte" | "lt" | "lte" | "eq";
export type Severity   = "p0" | "p1" | "p2" | "p3";

export type AlertRule = {
  rule_id:        string;
  counter_name:   string;
  comparison:     Comparison;
  threshold:      number;
  window_seconds: number;
  severity:       Severity;
  enabled:        boolean;
  description:    string | null;
  channels:       unknown[];
  created_by:     string | null;
  created_at:     string;
  updated_at:     string;
  disabled_at:    string | null;
};

export type CreateAlertRuleInput = Omit<AlertRule, "rule_id" | "created_at" | "updated_at" | "disabled_at">;
export type UpdateAlertRuleInput = Partial<Omit<AlertRule, "rule_id" | "created_at" | "updated_at" | "disabled_at">>;

function rowToRule(r: Record<string, unknown>): AlertRule {
  return {
    rule_id:        String(r.rule_id),
    counter_name:   String(r.counter_name),
    comparison:     r.comparison as Comparison,
    threshold:      Number(r.threshold),
    window_seconds: Number(r.window_seconds),
    severity:       r.severity as Severity,
    enabled:        Boolean(r.enabled),
    description:    (r.description as string | null) ?? null,
    channels:       Array.isArray(r.channels) ? r.channels : [],
    created_by:     (r.created_by as string | null) ?? null,
    created_at:     String(r.created_at),
    updated_at:     String(r.updated_at),
    disabled_at:    (r.disabled_at as string | null) ?? null,
  };
}

/** List all rules, newest first. Includes disabled rules — operators can filter client-side. */
export async function listAlertRules(): Promise<AlertRule[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT * FROM nex.alert_rules ORDER BY enabled DESC, updated_at DESC LIMIT 500`,
    );
    return res.rows.map(rowToRule);
  });
  return r ?? [];
}

/** Fetch a single rule. Returns null when missing. */
export async function getAlertRule(rule_id: string): Promise<AlertRule | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT * FROM nex.alert_rules WHERE rule_id = $1 LIMIT 1`, [rule_id],
    );
    return res.rows[0] ? rowToRule(res.rows[0]) : null;
  });
  return r ?? null;
}

/** Insert a new rule. Returns the row. */
export async function createAlertRule(input: CreateAlertRuleInput): Promise<AlertRule> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.alert_rules
         (counter_name, comparison, threshold, window_seconds, severity, enabled, description, channels, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING *`,
      [
        input.counter_name, input.comparison, input.threshold, input.window_seconds,
        input.severity, input.enabled, input.description ?? null,
        JSON.stringify(input.channels ?? []), input.created_by ?? null,
      ],
    );
    return rowToRule(res.rows[0]);
  });
  if (!r) throw new Error("[alert-rules] createAlertRule · pool unavailable");
  return r;
}

/** Update mutable fields. Returns the updated row or null if not found. */
export async function updateAlertRule(rule_id: string, patch: UpdateAlertRuleInput): Promise<AlertRule | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  if (patch.counter_name   !== undefined) push("counter_name",   patch.counter_name);
  if (patch.comparison     !== undefined) push("comparison",     patch.comparison);
  if (patch.threshold      !== undefined) push("threshold",      patch.threshold);
  if (patch.window_seconds !== undefined) push("window_seconds", patch.window_seconds);
  if (patch.severity       !== undefined) push("severity",       patch.severity);
  if (patch.enabled        !== undefined) push("enabled",        patch.enabled);
  if (patch.description    !== undefined) push("description",    patch.description);
  if (patch.channels       !== undefined) { params.push(JSON.stringify(patch.channels)); sets.push(`channels = $${params.length}::jsonb`); }
  if (sets.length === 0) return getAlertRule(rule_id);
  params.push(rule_id);
  const r = await withClient(async (c) => {
    const res = await c.query(
      `UPDATE nex.alert_rules SET ${sets.join(", ")} WHERE rule_id = $${params.length} RETURNING *`,
      params,
    );
    return res.rows[0] ? rowToRule(res.rows[0]) : null;
  });
  return r ?? null;
}

/** Hard delete. Returns true if a row was removed. */
export async function deleteAlertRule(rule_id: string): Promise<boolean> {
  const r = await withClient(async (c) => {
    const res = await c.query(`DELETE FROM nex.alert_rules WHERE rule_id = $1`, [rule_id]);
    return (res.rowCount ?? 0) > 0;
  });
  return r ?? false;
}
