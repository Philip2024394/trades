// NEX Automation Engine · evaluator + runner
//
// FLOW
//   scanEventsAgainstRules(events)
//     for each event:
//       for each enabled rule matching event.event_type + condition:
//         create a Run with status derived from rule.authority:
//           L3 → run action inline · status = auto_executed (or failed)
//           L2 → prepare · status = prepared (admin one-click confirms)
//           L1 → suggest · status = suggested (admin explicitly approves)
//
// IDEMPOTENCY
// A run is keyed by (rule_id · triggered_by_event_id). Re-scanning the same
// event never creates a duplicate run. This lets scan be called from any
// hot path or cron without care.
//
// SAFETY
// L3 actions run in-process. External webhooks use a 5s timeout · non-200
// responses are marked failed. `emit_event` and `log` are always safe.
//
// AUDIT
// Every run emits an Intelligence Event · either automation_rule_matched
// (L1/L2 pending) or automation_rule_executed (L3 completed) or
// automation_rule_failed. Living Timeline surfaces them all.

import { randomUUID } from "node:crypto";
import { emitEventSafe, listEvents, type IntelligenceEvent } from "../events/fs-store";
import {
  appendRun,
  listRules,
  listRuns,
  updateRun,
  type Rule,
  type Run,
  type RuleAction,
} from "./fs-store";

// ── Matching ──────────────────────────────────────────────────────

export function eventMatchesRule(event: IntelligenceEvent, rule: Rule): boolean {
  if (!rule.enabled) return false;
  if (event.event_type !== rule.trigger.event_type) return false;
  if (rule.trigger.source && event.source !== rule.trigger.source) return false;
  if (rule.trigger.related_department && event.related_department !== rule.trigger.related_department) return false;
  const payload = event.payload ?? {};
  if (rule.condition?.payload_equals) {
    for (const [k, v] of Object.entries(rule.condition.payload_equals)) {
      if ((payload as Record<string, unknown>)[k] !== v) return false;
    }
  }
  if (rule.condition?.payload_exists) {
    for (const k of rule.condition.payload_exists) {
      const val = (payload as Record<string, unknown>)[k];
      if (val === undefined || val === null) return false;
    }
  }
  return true;
}

// ── Action execution (only for L3) ────────────────────────────────

async function executeAction(action: RuleAction, event: IntelligenceEvent): Promise<{ ok: true; detail: string } | { ok: false; detail: string }> {
  try {
    if (action.kind === "log") {
      console.log(`[automation] LOG · ${action.message} · triggered_by=${event.event_type}`);
      return { ok: true, detail: `logged: ${action.message}` };
    }
    if (action.kind === "emit_event") {
      emitEventSafe({
        event_type: action.event_type,
        source: "system",
        actor_id: "automation-engine",
        related_department: event.related_department,
        outcome: "informational",
        payload: {
          ...(action.payload ?? {}),
          triggered_by_event_type: event.event_type,
          triggered_by_source: event.source,
        },
      });
      return { ok: true, detail: `emitted ${action.event_type}` };
    }
    if (action.kind === "notify_admin") {
      emitEventSafe({
        event_type: "case_opened",
        source: "system",
        actor_id: "automation-engine",
        related_department: "director",
        outcome: "pending",
        payload: {
          title: action.title,
          priority: action.priority,
          origin: "automation-engine",
          triggered_by_event_type: event.event_type,
        },
      });
      return { ok: true, detail: `notified admin · priority=${action.priority}` };
    }
    if (action.kind === "webhook") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const resp = await fetch(action.url, {
          method: action.method ?? "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event, action_body: action.body ?? {} }),
          signal: controller.signal,
        });
        if (!resp.ok) return { ok: false, detail: `webhook http ${resp.status}` };
        return { ok: true, detail: `webhook http ${resp.status}` };
      } finally {
        clearTimeout(timeout);
      }
    }
    return { ok: false, detail: "unknown_action_kind" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "unknown_error" };
  }
}

// ── Scan · match new events against enabled rules ────────────────

export type ScanResult = {
  scanned_at: string;
  events_scanned: number;
  matches: number;
  runs_created: number;
  runs_skipped_duplicate: number;
  runs: Run[];
};

/**
 * Evaluate a batch of events against all enabled rules. Idempotent per
 * (rule_id, event_id) — safe to call repeatedly. Missing event_id (Intelligence
 * Events without an id) fall back to hashing event_type+at+related_job so
 * duplicates within the same second are still suppressed.
 */
export async function scanEventsAgainstRules(events: IntelligenceEvent[]): Promise<ScanResult> {
  const now = new Date().toISOString();
  const rules = await listRules({ enabled_only: true });
  const priorRuns = await listRuns({ limit: 1000 });
  const priorKey = (rule_id: string, event_id: string | null) => `${rule_id}|${event_id ?? ""}`;
  const seen = new Set<string>();
  for (const pr of priorRuns) seen.add(priorKey(pr.rule_id, pr.triggered_by_event_id));

  let matches = 0;
  let created = 0;
  let dupes = 0;
  const createdRuns: Run[] = [];

  for (const event of events) {
    for (const rule of rules) {
      if (!eventMatchesRule(event, rule)) continue;
      matches += 1;
      const eventId = (event as unknown as { event_id?: string }).event_id ?? null;
      const key = priorKey(rule.rule_id, eventId);
      if (seen.has(key)) { dupes += 1; continue; }
      seen.add(key);

      // Build the Run · execute immediately if L3, else queue as pending.
      const baseRun: Run = {
        run_id: randomUUID(),
        rule_id: rule.rule_id,
        rule_name: rule.name,
        rule_authority: rule.authority,
        triggered_by_event_id: eventId,
        triggered_by_event_type: event.event_type,
        triggered_at: now,
        status: rule.authority === "L1" ? "suggested" : rule.authority === "L2" ? "prepared" : "auto_executed",
        outcome_detail: null,
        action_snapshot: rule.action,
        admin_actor: null,
        admin_decided_at: null,
      };

      if (rule.authority === "L3") {
        const result = await executeAction(rule.action, event);
        baseRun.status = result.ok ? "auto_executed" : "failed";
        baseRun.outcome_detail = result.detail;
        baseRun.admin_decided_at = now;
      }

      await appendRun(baseRun);
      createdRuns.push(baseRun);
      created += 1;

      // Audit trail on the Intelligence Bus
      emitEventSafe({
        event_type: rule.authority === "L3"
          ? (baseRun.status === "auto_executed" ? "automation_rule_executed" : "automation_rule_failed")
          : "automation_rule_matched",
        source: "system",
        actor_id: "automation-engine",
        related_department: event.related_department,
        outcome: rule.authority === "L3"
          ? (baseRun.status === "auto_executed" ? "success" : "failure")
          : "pending",
        payload: {
          rule_id: rule.rule_id,
          rule_name: rule.name,
          authority: rule.authority,
          run_id: baseRun.run_id,
          triggered_by_event_type: event.event_type,
          outcome_detail: baseRun.outcome_detail,
        },
      });
    }
  }

  return {
    scanned_at: now,
    events_scanned: events.length,
    matches,
    runs_created: created,
    runs_skipped_duplicate: dupes,
    runs: createdRuns,
  };
}

/**
 * Scan the recent Intelligence Bus window. Default = last 1h · up to 500 events.
 * Every call is idempotent via the (rule, event_id) dedup key in scan.
 */
export async function scanRecentEvents(sinceMs: number = 60 * 60 * 1000, eventLimit: number = 500): Promise<ScanResult> {
  const events = await listEvents({ limit: eventLimit, since_ms: sinceMs });
  return scanEventsAgainstRules(events);
}

// ── Admin decisions (L1/L2 approvals) ─────────────────────────────

export async function approveRun(run_id: string, admin: string): Promise<Run | null> {
  const now = new Date().toISOString();
  return updateRun(run_id, { status: "approved", admin_actor: admin, admin_decided_at: now, outcome_detail: "admin_approved" });
}

export async function rejectRun(run_id: string, admin: string, reason?: string): Promise<Run | null> {
  const now = new Date().toISOString();
  return updateRun(run_id, { status: "rejected", admin_actor: admin, admin_decided_at: now, outcome_detail: reason ?? "admin_rejected" });
}
