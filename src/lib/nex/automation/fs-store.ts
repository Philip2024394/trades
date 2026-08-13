// NEX Automation Engine · rules + runs storage
//
// DOCTRINE
// Every automation rule has a locked AUTHORITY LEVEL:
//   L1 · SUGGESTION — NEX writes a recommendation; admin decides
//   L2 · PREPARED   — NEX drafts the action; admin one-click confirms
//   L3 · AUTONOMOUS — NEX executes automatically; every action still audited
// There is NEVER a "Let NEX Handle" button. Authority is set per rule at
// creation and can only be changed by explicit admin action.
//
// A Run is one evaluation of one rule against one event. Every match
// creates a Run row — regardless of authority level. L1 runs stay pending
// until admin approves/rejects · L2 runs stay pending until admin one-clicks
// · L3 runs execute inline and are logged as completed.
//
// STORAGE (append-only JSONL, latest-per-id wins)
//   data/nex-automation/rules.jsonl
//   data/nex-automation/runs.jsonl
//
// Cross-refs: feedback_nex_authority_semantics_corrected_2026_08_07 +
//             project_nex_backend_three_layers_event_bus_and_intelligence_centre

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emitEventSafe, type IntelligenceEvent } from "../events/fs-store";

// ── Paths ──────────────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), "data", "nex-automation");
const RULES_FILE = path.join(ROOT, "rules.jsonl");
const RUNS_FILE = path.join(ROOT, "runs.jsonl");

async function ensureDir(): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
}

// ── Types ─────────────────────────────────────────────────────────

export type AuthorityLevel = "L1" | "L2" | "L3";

export type RuleActionKind =
  | "log"
  | "emit_event"
  | "notify_admin"
  | "webhook";

export type RuleTrigger = {
  event_type: string;                    // e.g. "knowledge_dumped"
  source?: string;                       // optional filter on IntelligenceEvent.source
  related_department?: string;
};

/** Condition · shallow key/value predicate over event.payload. */
export type RuleCondition = {
  payload_equals?: Record<string, string | number | boolean>;
  payload_exists?: string[];             // keys that must exist (non-null)
};

export type RuleAction =
  | { kind: "log";           message: string }
  | { kind: "emit_event";    event_type: string; payload?: Record<string, unknown> }
  | { kind: "notify_admin";  title: string;      priority: "P1" | "P2" | "P3" }
  | { kind: "webhook";       url: string;        method?: "POST" | "GET"; body?: Record<string, unknown> };

export type Rule = {
  rule_id: string;
  name: string;
  description: string | null;
  authority: AuthorityLevel;
  enabled: boolean;
  trigger: RuleTrigger;
  condition: RuleCondition | null;
  action: RuleAction;
  created_at: string;
  updated_at: string;
  created_by: string;
  version: number;
};

export type RunStatus = "auto_executed" | "suggested" | "prepared" | "approved" | "rejected" | "failed" | "skipped";

export type Run = {
  run_id: string;
  rule_id: string;
  rule_name: string;
  rule_authority: AuthorityLevel;
  triggered_by_event_id: string | null;  // Intelligence Bus event id (if any)
  triggered_by_event_type: string;
  triggered_at: string;
  status: RunStatus;
  outcome_detail: string | null;
  action_snapshot: RuleAction;           // frozen at run time
  admin_actor: string | null;            // for L1/L2 approvals
  admin_decided_at: string | null;
};

// ── Rules · create + read + update ────────────────────────────────

export type CreateRuleInput = {
  name: string;
  description?: string | null;
  authority: AuthorityLevel;
  enabled?: boolean;
  trigger: RuleTrigger;
  condition?: RuleCondition | null;
  action: RuleAction;
  created_by?: string;
};

export async function createRule(input: CreateRuleInput): Promise<Rule> {
  const now = new Date().toISOString();
  const rule: Rule = {
    rule_id: randomUUID(),
    name: input.name,
    description: input.description ?? null,
    authority: input.authority,
    enabled: input.enabled ?? true,
    trigger: input.trigger,
    condition: input.condition ?? null,
    action: input.action,
    created_at: now,
    updated_at: now,
    created_by: input.created_by ?? "admin",
    version: 1,
  };
  await ensureDir();
  await fs.appendFile(RULES_FILE, JSON.stringify(rule) + "\n", "utf8");

  emitEventSafe({
    event_type: "automation_rule_created",
    source: "system",
    actor_id: rule.created_by,
    related_department: "operations",
    outcome: "success",
    payload: {
      rule_id: rule.rule_id,
      name: rule.name,
      authority: rule.authority,
      trigger_event_type: rule.trigger.event_type,
      action_kind: rule.action.kind,
    },
  });
  return rule;
}

export async function updateRule(rule_id: string, patch: Partial<Omit<Rule, "rule_id" | "created_at" | "created_by" | "version">>): Promise<Rule | null> {
  const current = await getRule(rule_id);
  if (!current) return null;
  const now = new Date().toISOString();
  const next: Rule = {
    ...current,
    ...patch,
    updated_at: now,
    version: current.version + 1,
  };
  await ensureDir();
  await fs.appendFile(RULES_FILE, JSON.stringify(next) + "\n", "utf8");
  return next;
}

async function readAllRuleSnapshots(): Promise<Rule[]> {
  let raw: string;
  try { raw = await fs.readFile(RULES_FILE, "utf8"); }
  catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return []; throw err; }
  const latest = new Map<string, Rule>();
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const r = JSON.parse(line) as Rule;
      latest.set(r.rule_id, r);
    } catch { /* skip */ }
  }
  return [...latest.values()];
}

export async function getRule(rule_id: string): Promise<Rule | null> {
  const all = await readAllRuleSnapshots();
  return all.find((r) => r.rule_id === rule_id) ?? null;
}

export async function listRules(options: { enabled_only?: boolean; authority?: AuthorityLevel } = {}): Promise<Rule[]> {
  const all = await readAllRuleSnapshots();
  return all
    .filter((r) => (options.enabled_only ? r.enabled : true))
    .filter((r) => (options.authority ? r.authority === options.authority : true))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

// ── Runs · append + list ──────────────────────────────────────────

export async function appendRun(run: Run): Promise<Run> {
  await ensureDir();
  await fs.appendFile(RUNS_FILE, JSON.stringify(run) + "\n", "utf8");
  return run;
}

export async function updateRun(run_id: string, patch: Partial<Pick<Run, "status" | "outcome_detail" | "admin_actor" | "admin_decided_at">>): Promise<Run | null> {
  const current = await getRun(run_id);
  if (!current) return null;
  const next: Run = { ...current, ...patch };
  await ensureDir();
  await fs.appendFile(RUNS_FILE, JSON.stringify(next) + "\n", "utf8");
  return next;
}

async function readAllRunSnapshots(): Promise<Run[]> {
  let raw: string;
  try { raw = await fs.readFile(RUNS_FILE, "utf8"); }
  catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return []; throw err; }
  const latest = new Map<string, Run>();
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const r = JSON.parse(line) as Run;
      latest.set(r.run_id, r);
    } catch { /* skip */ }
  }
  return [...latest.values()];
}

export async function getRun(run_id: string): Promise<Run | null> {
  const all = await readAllRunSnapshots();
  return all.find((r) => r.run_id === run_id) ?? null;
}

export type ListRunsOptions = {
  limit?: number;
  status?: RunStatus;
  rule_id?: string;
  since_ms?: number;
};

export async function listRuns(options: ListRunsOptions = {}): Promise<Run[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 100), 1000);
  const sinceIso = new Date(Date.now() - (options.since_ms ?? 30 * 24 * 60 * 60 * 1000)).toISOString();
  const all = await readAllRunSnapshots();
  return all
    .filter((r) => (options.status ? r.status === options.status : true))
    .filter((r) => (options.rule_id ? r.rule_id === options.rule_id : true))
    .filter((r) => r.triggered_at >= sinceIso)
    .sort((a, b) => (a.triggered_at < b.triggered_at ? 1 : -1))
    .slice(0, limit);
}

/**
 * Per-rule confidence: fraction of L3 runs that executed cleanly (auto_executed)
 * vs the total number of L3 runs. L1/L2 confidence tracks approval rate.
 */
export type RuleConfidence = {
  rule_id: string;
  rule_name: string;
  authority: AuthorityLevel;
  total_runs: number;
  clean_runs: number;                    // auto_executed | approved
  failed_runs: number;
  rejected_runs: number;
  pending_runs: number;                  // suggested | prepared
  confidence_pct: number;
};

export async function ruleConfidences(): Promise<RuleConfidence[]> {
  const runs = await readAllRunSnapshots();
  const rules = await readAllRuleSnapshots();
  const out: RuleConfidence[] = [];
  for (const rule of rules) {
    const scoped = runs.filter((r) => r.rule_id === rule.rule_id);
    const total = scoped.length;
    const clean = scoped.filter((r) => r.status === "auto_executed" || r.status === "approved").length;
    const failed = scoped.filter((r) => r.status === "failed").length;
    const rejected = scoped.filter((r) => r.status === "rejected").length;
    const pending = scoped.filter((r) => r.status === "suggested" || r.status === "prepared").length;
    const decided = clean + failed + rejected;
    out.push({
      rule_id: rule.rule_id,
      rule_name: rule.name,
      authority: rule.authority,
      total_runs: total,
      clean_runs: clean,
      failed_runs: failed,
      rejected_runs: rejected,
      pending_runs: pending,
      confidence_pct: decided > 0 ? Math.round((clean / decided) * 1000) / 10 : 0,
    });
  }
  return out.sort((a, b) => b.total_runs - a.total_runs);
}

// ── Re-exports for engine.ts ──────────────────────────────────────

export type { IntelligenceEvent };
