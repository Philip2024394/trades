// NEX Operational Alerts · evaluator + lifecycle manager
//
// Called by /api/nex/alerts/evaluate (cron target). Steps:
//   1. Seed rule catalogue if missing (idempotent)
//   2. Build a platform snapshot (one DB round-trip)
//   3. Load enabled rules · run each evaluator against the snapshot
//   4. For each firing rule:
//        · if there's an open alert AND last_triggered was within
//          dedup_window → bump trigger_count + last_triggered only
//        · else → open a new alert OR re-open after resolve
//        · dispatch to configured channels (unless suppressed by dedup)
//   5. Emit canonical `system.health_alert` event to nex.events
//   6. Auto-resolve any open alert whose rule stopped firing this tick
//
// Correlation: rules with `root_cause_of` set stamp the same
// incident_id on dependent alerts so support UIs can group them.

import { withClient } from "@/lib/nex/delivery/db";
import { CATALOGUE, findRule, type RuleDefinition } from "./catalogue";
import { buildPlatformSnapshot } from "./snapshot";
import { dispatchAlert } from "./dispatch";
import type { Alert, AlertRule, DispatchChannel, PlatformSnapshot, Severity } from "./types";
// Wave 3 · H5 · structured logging + fail-closed gate observability.
import { logger } from "@/lib/nex/observability/logger";

const log = logger("alerts.evaluator");

/** Wave 3 · H5 · dispatch is off by default until an operator opts in. */
export function isDispatchEnabled(): boolean {
  return process.env.NEX_ALERTS_DISPATCH_ENABLED === "1";
}

// ── Seed catalogue ────────────────────────────────────────────────
let seeded = false;
async function seedCatalogue(): Promise<void> {
  if (seeded) return;
  seeded = true;
  await withClient(async (c) => {
    for (const r of CATALOGUE) {
      await c.query(
        `INSERT INTO nex.alert_rules (rule_id, name, category, severity, description, params, dedup_window_sec, notify_channels, root_cause_of)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::text[], $9::text[])
         ON CONFLICT (rule_id) DO NOTHING`,
        [r.rule_id, r.name, r.category, r.severity, r.description, JSON.stringify(r.default_params), r.default_dedup_window_sec, r.default_channels, r.root_cause_of],
      );
    }
    return null;
  });
}

// ── Rule row loader ───────────────────────────────────────────────
async function loadEnabledRules(): Promise<AlertRule[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.alert_rules WHERE enabled = TRUE ORDER BY rule_id`);
    return res.rows.map(rowToRule);
  });
  return r ?? [];
}
function rowToRule(r: Record<string, unknown>): AlertRule {
  return {
    rule_id: String(r.rule_id), name: String(r.name), category: String(r.category),
    severity: r.severity as Severity, description: (r.description as string | null) ?? null,
    params: (r.params as Record<string, number | string | boolean>) ?? {},
    enabled: r.enabled === true, dedup_window_sec: Number(r.dedup_window_sec ?? 300),
    notify_channels: ((r.notify_channels as string[]) ?? []) as DispatchChannel[],
    root_cause_of: (r.root_cause_of as string[]) ?? [],
    created_at: String(r.created_at), updated_at: String(r.updated_at),
  };
}
function rowToAlert(r: Record<string, unknown>): Alert {
  return {
    alert_id: String(r.alert_id), rule_id: String(r.rule_id),
    incident_id: (r.incident_id as string | null) ?? null,
    severity: r.severity as Severity, state: r.state as Alert["state"],
    title: String(r.title), detail: (r.detail as string | null) ?? null,
    snapshot: (r.snapshot as Record<string, unknown>) ?? {},
    first_detected_at: String(r.first_detected_at),
    last_triggered_at: String(r.last_triggered_at),
    trigger_count: Number(r.trigger_count ?? 1),
    acknowledged_at: (r.acknowledged_at as string | null) ?? null,
    acknowledged_by: (r.acknowledged_by as string | null) ?? null,
    resolved_at: (r.resolved_at as string | null) ?? null,
    resolved_reason: (r.resolved_reason as string | null) ?? null,
    resolved_by: (r.resolved_by as string | null) ?? null,
  };
}

// ── Evaluator ─────────────────────────────────────────────────────
export type EvaluateResult = {
  ok: true;
  timestamp: string;
  ran_rules: number;
  fired: number;
  suppressed_by_dedup: number;
  new_alerts: number;
  auto_resolved: number;
  dispatched: number;
  dispatch_failed: number;
  snapshot: PlatformSnapshot;
};

export async function evaluate(): Promise<EvaluateResult> {
  await seedCatalogue();
  const snapshot = await buildPlatformSnapshot();
  const rules = await loadEnabledRules();

  const outcomes: Array<{ rule: AlertRule; def: RuleDefinition; trigger: ReturnType<RuleDefinition["evaluate"]>; alert?: Alert; created?: boolean; suppressed?: boolean; }> = [];

  // ── First pass: for each rule, decide (fires? / open alert existing? / dedup?)
  for (const rule of rules) {
    const def = findRule(rule.rule_id);
    if (!def) continue;                             // unknown rule row · skip
    const trigger = def.evaluate(snapshot, rule.params);
    outcomes.push({ rule, def, trigger });
  }

  // Collect root incidents to correlate dependents
  const rootIncidents = new Map<string, string>();  // rule_id (dependent) → incident_id (root)
  for (const o of outcomes) {
    if (o.trigger.fires && o.rule.root_cause_of.length > 0) {
      // Root's incident_id will be its own alert_id once created · placeholder here
      // stamped after the root's alert is upserted below.
    }
  }

  let ran_rules = 0, fired = 0, suppressed_by_dedup = 0, new_alerts = 0, auto_resolved = 0, dispatched = 0, dispatch_failed = 0;
  const firedIds = new Set<string>();

  const client_r = await withClient(async (c) => {
    // Sort so root-cause rules process first · their incident_id is available to dependents
    outcomes.sort((a, b) => (b.rule.root_cause_of.length - a.rule.root_cause_of.length));

    for (const o of outcomes) {
      ran_rules++;
      const { rule, trigger } = o;

      if (!trigger.fires) continue;
      fired++;
      firedIds.add(rule.rule_id);

      // Determine correlation
      const inheritedIncident = rootIncidents.get(rule.rule_id) ?? null;

      // Find any open alert for this rule
      const openRes = await c.query(`SELECT * FROM nex.alerts WHERE rule_id = $1 AND state = 'open' LIMIT 1`, [rule.rule_id]);
      const existing = openRes.rows[0] ? rowToAlert(openRes.rows[0]) : null;

      if (existing) {
        // Dedup: if last_triggered within window, only bump
        const ageMs = Date.now() - new Date(existing.last_triggered_at).getTime();
        const withinWindow = ageMs < rule.dedup_window_sec * 1000;
        await c.query(
          `UPDATE nex.alerts
           SET last_triggered_at = NOW(), trigger_count = trigger_count + 1,
               detail = $1, snapshot = $2::jsonb,
               incident_id = COALESCE(incident_id, $3)
           WHERE alert_id = $4`,
          [trigger.detail.slice(0, 500), JSON.stringify(trigger.snapshot), inheritedIncident, existing.alert_id],
        );
        if (withinWindow) { suppressed_by_dedup++; continue; }

        // Outside window · re-dispatch
        const refreshed = await c.query(`SELECT * FROM nex.alerts WHERE alert_id = $1`, [existing.alert_id]);
        const alert = rowToAlert(refreshed.rows[0]);
        o.alert = alert;
      } else {
        // Create new alert (self-incident for roots)
        const ins = await c.query(
          `INSERT INTO nex.alerts (rule_id, incident_id, severity, state, title, detail, snapshot)
           VALUES ($1, $2, $3, 'open', $4, $5, $6::jsonb)
           RETURNING *`,
          [rule.rule_id, inheritedIncident, rule.severity, rule.name, trigger.detail.slice(0, 500), JSON.stringify(trigger.snapshot)],
        );
        const alert = rowToAlert(ins.rows[0]);
        // If this rule is a root, use its own alert_id as incident + stamp dependents
        if (rule.root_cause_of.length > 0 && !inheritedIncident) {
          await c.query(`UPDATE nex.alerts SET incident_id = alert_id WHERE alert_id = $1`, [alert.alert_id]);
          for (const depRule of rule.root_cause_of) rootIncidents.set(depRule, alert.alert_id);
        }
        new_alerts++;
        o.alert = alert;
        o.created = true;
      }
    }

    // ── Auto-resolve open alerts whose rule stopped firing this tick ──
    const openIdsRes = await c.query(`SELECT rule_id, alert_id FROM nex.alerts WHERE state = 'open'`);
    for (const row of openIdsRes.rows) {
      const rid = String(row.rule_id);
      if (firedIds.has(rid)) continue;                             // still firing · leave alone
      const aid = String(row.alert_id);
      await c.query(
        `UPDATE nex.alerts SET state = 'resolved', resolved_at = NOW(), resolved_reason = $1, resolved_by = 'system-auto' WHERE alert_id = $2 AND state = 'open'`,
        [`condition cleared at ${new Date().toISOString()}`, aid],
      );
      auto_resolved++;
    }

    // Canonical audit event (best-effort)
    try {
      await c.query(
        `INSERT INTO nex.events (event_type, payload) VALUES ('system.health_alert', $1::jsonb)`,
        [JSON.stringify({ ts: new Date().toISOString(), ran_rules, fired, new_alerts, auto_resolved, suppressed_by_dedup, snapshot })],
      );
    } catch { /* nex.events optional · never fail evaluation */ }

    return outcomes;
  }) ?? outcomes;

  // ── Dispatch new + non-suppressed alerts ────────────────────────
  // Wave 3 · H5 · gated behind NEX_ALERTS_DISPATCH_ENABLED. When the gate
  // is off (default), alerts still open/resolve in the DB and are visible
  // in AlertsCentrePanel; only the outbound notification is suppressed.
  // When on, dispatch fires per rule's notify_channels; fail-closed
  // observability (alerts/dispatch.ts) surfaces missing-transport cases.
  const gateEnabled = isDispatchEnabled();
  let dispatch_skipped_gate = 0;
  for (const o of client_r) {
    if (!o.alert) continue;
    if (o.suppressed) continue;
    if (!gateEnabled) { dispatch_skipped_gate++; continue; }
    const channels = o.rule.notify_channels;
    const dr = await dispatchAlert(o.alert, channels);
    dispatched      += dr.sent;
    dispatch_failed += dr.failed;
  }
  if (!gateEnabled && dispatch_skipped_gate > 0) {
    log.info("dispatch_skipped_gate_off", { skipped: dispatch_skipped_gate });
  }

  return {
    ok: true, timestamp: snapshot.timestamp, ran_rules, fired,
    suppressed_by_dedup, new_alerts, auto_resolved,
    dispatched, dispatch_failed, dispatch_skipped_gate,
    snapshot,
  };
}

// ── Read helpers ──────────────────────────────────────────────────
export async function listAlerts(state?: Alert["state"], limit = 100): Promise<Alert[]> {
  const r = await withClient(async (c) => {
    const wheres: string[] = [];
    const params: unknown[] = [];
    if (state) { params.push(state); wheres.push(`state = $${params.length}`); }
    const where = wheres.length > 0 ? `WHERE ${wheres.join(" AND ")}` : "";
    const res = await c.query(`SELECT * FROM nex.alerts ${where} ORDER BY last_triggered_at DESC LIMIT ${Math.max(1, Math.min(500, limit))}`, params);
    return res.rows.map(rowToAlert);
  });
  return r ?? [];
}
export async function getAlert(alert_id: string): Promise<Alert | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.alerts WHERE alert_id = $1`, [alert_id]);
    return res.rows[0] ? rowToAlert(res.rows[0]) : null;
  });
  return r ?? null;
}
export async function acknowledgeAlert(alert_id: string, actor: string): Promise<Alert | null> {
  const r = await withClient(async (c) => {
    await c.query(`UPDATE nex.alerts SET state = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = $1 WHERE alert_id = $2 AND state = 'open'`, [actor, alert_id]);
    const res = await c.query(`SELECT * FROM nex.alerts WHERE alert_id = $1`, [alert_id]);
    return res.rows[0] ? rowToAlert(res.rows[0]) : null;
  });
  return r ?? null;
}
export async function resolveAlert(alert_id: string, actor: string, reason: string): Promise<Alert | null> {
  const r = await withClient(async (c) => {
    await c.query(`UPDATE nex.alerts SET state = 'resolved', resolved_at = NOW(), resolved_by = $1, resolved_reason = $2 WHERE alert_id = $3 AND state IN ('open','acknowledged')`, [actor, reason.slice(0, 500), alert_id]);
    const res = await c.query(`SELECT * FROM nex.alerts WHERE alert_id = $1`, [alert_id]);
    return res.rows[0] ? rowToAlert(res.rows[0]) : null;
  });
  return r ?? null;
}
export async function listRules(): Promise<AlertRule[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.alert_rules ORDER BY category, rule_id`);
    return res.rows.map(rowToRule);
  });
  return r ?? [];
}
export async function updateRule(rule_id: string, patch: Partial<Pick<AlertRule, "enabled" | "params" | "dedup_window_sec" | "notify_channels" | "severity">>): Promise<AlertRule | null> {
  const r = await withClient(async (c) => {
    const sets: string[] = ["updated_at = NOW()"]; const params: unknown[] = [];
    if (patch.enabled !== undefined)          { params.push(patch.enabled);                       sets.push(`enabled = $${params.length}`); }
    if (patch.params !== undefined)           { params.push(JSON.stringify(patch.params));        sets.push(`params = $${params.length}::jsonb`); }
    if (patch.dedup_window_sec !== undefined) { params.push(patch.dedup_window_sec);              sets.push(`dedup_window_sec = $${params.length}`); }
    if (patch.notify_channels !== undefined)  { params.push(patch.notify_channels);               sets.push(`notify_channels = $${params.length}::text[]`); }
    if (patch.severity !== undefined)         { params.push(patch.severity);                      sets.push(`severity = $${params.length}`); }
    params.push(rule_id);
    await c.query(`UPDATE nex.alert_rules SET ${sets.join(", ")} WHERE rule_id = $${params.length}`, params);
    const res = await c.query(`SELECT * FROM nex.alert_rules WHERE rule_id = $1`, [rule_id]);
    return res.rows[0] ? rowToRule(res.rows[0]) : null;
  });
  return r ?? null;
}

// ── Ops metrics · MTTD/MTTA/MTTR ─────────────────────────────────
export type AlertOpsMetrics = {
  open: number; acknowledged: number; resolved_24h: number;
  mttd_ms: number | null;                            // detected-first-time to acknowledge
  mtta_ms: number | null;
  mttr_ms: number | null;
  by_rule_last_7d: Array<{ rule_id: string; count: number; last_fired_at: string }>;
};

export async function getAlertOpsMetrics(): Promise<AlertOpsMetrics> {
  const r = await withClient(async (c) => {
    const opens = await c.query(`SELECT state, COUNT(*)::int AS n FROM nex.alerts GROUP BY state`);
    const totals: Record<string, number> = {};
    for (const row of opens.rows) totals[String(row.state)] = Number(row.n);

    const res24 = await c.query(`SELECT COUNT(*)::int AS n FROM nex.alerts WHERE resolved_at > NOW() - INTERVAL '24 hours'`);
    const resolved_24h = Number((res24.rows[0] as { n: number })?.n ?? 0);

    // MTTA · time from first_detected to acknowledged_at (over last 30d)
    const mtta = await c.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (acknowledged_at - first_detected_at)) * 1000)::bigint AS ms
       FROM nex.alerts WHERE acknowledged_at IS NOT NULL AND acknowledged_at > NOW() - INTERVAL '30 days'`,
    );
    // MTTR · first_detected to resolved
    const mttr = await c.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - first_detected_at)) * 1000)::bigint AS ms
       FROM nex.alerts WHERE resolved_at IS NOT NULL AND resolved_at > NOW() - INTERVAL '30 days'`,
    );
    // MTTD · we detect on the tick after the condition emerges · use median tick interval as proxy (best-effort · MVP)
    // For MVP report NULL if we can't compute meaningfully.
    const mttd_ms: number | null = null;

    const byRule = await c.query(
      `SELECT rule_id, COUNT(*)::int AS count, MAX(last_triggered_at) AS last_fired_at
       FROM nex.alerts WHERE last_triggered_at > NOW() - INTERVAL '7 days'
       GROUP BY rule_id ORDER BY count DESC LIMIT 15`,
    );

    return {
      open: totals.open ?? 0,
      acknowledged: totals.acknowledged ?? 0,
      resolved_24h,
      mttd_ms,
      mtta_ms: Number((mtta.rows[0] as { ms: number | null })?.ms ?? 0) || null,
      mttr_ms: Number((mttr.rows[0] as { ms: number | null })?.ms ?? 0) || null,
      by_rule_last_7d: byRule.rows.map((r0) => ({ rule_id: String(r0.rule_id), count: Number(r0.count), last_fired_at: String(r0.last_fired_at) })),
    };
  });
  return r ?? { open: 0, acknowledged: 0, resolved_24h: 0, mttd_ms: null, mtta_ms: null, mttr_ms: null, by_rule_last_7d: [] };
}
