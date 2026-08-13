// Nex Booker · Business Autopilot rule engine.
//
// Pure evaluator: given a rule + an incoming event + context, decides
// whether the rule matches, and if so, returns a list of PlannedActions
// to emit. It does NOT execute the actions — an execution layer sits
// downstream and respects each rule's mode + owner permissions.
//
// Doctrine (this module is designed against these principles):
// · Owner-approved automation, never full autonomy
//   (project_nex_business_ai_positioning_2026_08_06.md)
// · Owner always in control · always explain why · never guess
//   (feedback_nex_business_ai_ten_principles_2026_08_06.md)
// · Prefer "unknown" over incorrect
//   (feedback_nex_speaking_knowledge_doctrine_2026_08_06.md)
//
// Safety rails baked in:
// · Default rule mode = suggest_only (never auto-execute unless explicit)
// · `disabled` mode is respected — no evaluation, no actions
// · Every PlannedAction carries the rule_id that produced it (traceability)
// · Every planned action includes a `reason` string explaining WHY it's
//   suggested (owner must understand before approving; matches Principle 7
//   "Explain the reasoning")

import type {
  NexBkAutopilotAction,
  NexBkAutopilotActionType,
  NexBkAutopilotCondition,
  NexBkAutopilotRule,
  NexBkAutopilotTriggerType,
  Uuid,
} from "./types";

// ── Incoming event shape ────────────────────────────────────────────

/** Minimal event shape the evaluator needs. Callers construct this
 *  from a NexBkEvent or from an external signal (invoice-aged sweep,
 *  stock-monitor tick, etc.). */
export type AutopilotEvent = {
  business_id: Uuid;
  event_type: string;         // Matches trigger_type or a related event
  entity_type: string;
  entity_id: string;
  /** Structured payload the conditions predicates + action configs read from. */
  payload: Record<string, unknown>;
  /** Optional source event id in the immutable event log — carried onto
   *  the planned actions for provenance. */
  source_event_id?: Uuid;
};

// ── Planned action (evaluator output) ───────────────────────────────

export type PlannedAction = {
  rule_id: Uuid;
  rule_name: string;
  rule_mode: "suggest_only" | "auto_execute";  // Never "disabled" — those don't evaluate
  action: NexBkAutopilotAction;
  /** Human-readable explanation of WHY this action is being proposed —
   *  shown to the owner in the suggestion UI. Principle 7. */
  reason: string;
  /** The event that triggered it (for audit trail). */
  source_event_id?: Uuid;
  triggered_at: string;                        // ISO timestamp
};

// ── Errors ──────────────────────────────────────────────────────────

export class AutopilotError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AutopilotError";
    this.code = code;
  }
}

// ── Trigger type → matcher ──────────────────────────────────────────

/**
 * Whether an event matches a rule's trigger type. Kept as a small
 * lookup — adding a trigger type means adding a case here + a test.
 *
 * The events NEX brain emits use the same event_type strings. If a
 * trigger needs configurable behaviour (e.g. `on_invoice_overdue_days`
 * needs to know "how many days"), that's read from trigger_config in
 * the caller (aged-invoice sweep), not here — this function just says
 * "yes this event kind matches this trigger kind".
 */
function triggerMatchesEvent(trigger: NexBkAutopilotTriggerType, eventType: string): boolean {
  switch (trigger) {
    case "on_receipt_captured":            return eventType === "receipt_captured";
    case "on_invoice_issued":              return eventType === "invoice_issued";
    case "on_customer_payment":            return eventType === "payment_received";
    case "on_invoice_overdue_days":        return eventType === "invoice_aged_check";     // Emitted by a scheduled sweep
    case "on_stock_below_min":             return eventType === "stock_low_signal";
    case "on_period_ready_for_accountant": return eventType === "period_marked_ready";
  }
}

// ── Conditions evaluator ────────────────────────────────────────────

/** Evaluate all conditions against the event payload. ALL must match
 *  for the rule to fire (AND semantics — no OR groups in v1; keep simple). */
function conditionsMatch(conditions: NexBkAutopilotCondition[], payload: Record<string, unknown>): boolean {
  if (!conditions || conditions.length === 0) return true;
  for (const cond of conditions) {
    const actual = getField(payload, cond.field);
    if (!compareValues(actual, cond.op, cond.value)) return false;
  }
  return true;
}

/** Read a possibly-nested field from the payload using dot notation
 *  (e.g. "customer.name" walks payload.customer.name). Returns undefined
 *  if any hop is missing. */
function getField(payload: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = payload;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function compareValues(actual: unknown, op: NexBkAutopilotCondition["op"], expected: unknown): boolean {
  switch (op) {
    case "eq":  return actual === expected;
    case "neq": return actual !== expected;
    case "gt":  return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte": return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt":  return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte": return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "in":  return Array.isArray(expected) && expected.includes(actual as never);
    case "not_in": return Array.isArray(expected) && !expected.includes(actual as never);
    case "contains":
      if (typeof actual === "string" && typeof expected === "string") return actual.toLowerCase().includes(expected.toLowerCase());
      if (Array.isArray(actual)) return actual.includes(expected as never);
      return false;
  }
}

// ── Reason builders ─────────────────────────────────────────────────
//
// Every planned action must include a human explanation for the owner.
// These builders keep the reasons consistent, plain-English, and NEX-voiced
// (Principle 3: clear · calm · helpful · practical). Never marketing.

function reasonForAction(rule: NexBkAutopilotRule, action: NexBkAutopilotAction, event: AutopilotEvent): string {
  const trigger = triggerFriendlyName(rule.trigger_type);
  switch (action.type) {
    case "mark_invoice_paid":
      return `${trigger} triggered rule "${rule.name}". Marking the invoice as paid keeps your ledger in sync.`;
    case "send_message":
      return `${trigger} triggered rule "${rule.name}". A message draft is ready for you to review.`;
    case "request_review":
      return `${trigger} triggered rule "${rule.name}". A review request would help build customer feedback signal.`;
    case "draft_supplier_order":
      return `${trigger} triggered rule "${rule.name}". A draft supplier order is ready — nothing has been sent.`;
    case "notify_owner":
      return `${trigger} triggered rule "${rule.name}". You may want to take a look at this.`;
    case "add_audit_note":
      return `${trigger} triggered rule "${rule.name}". A note has been prepared for the audit trail.`;
  }
}

function triggerFriendlyName(t: NexBkAutopilotTriggerType): string {
  switch (t) {
    case "on_receipt_captured":            return "Receipt captured";
    case "on_invoice_issued":              return "Invoice issued";
    case "on_customer_payment":            return "Customer payment received";
    case "on_invoice_overdue_days":        return "Invoice reached its overdue threshold";
    case "on_stock_below_min":             return "Stock dropped below your minimum";
    case "on_period_ready_for_accountant": return "You marked a period ready for the accountant";
  }
}

// ── Action config validation ────────────────────────────────────────
//
// Actions are data — but that data still has to be plausible. Reject
// rules whose action configs are structurally wrong. Better to fail
// loudly at evaluation time than silently emit a broken action.

export function validateAction(action: NexBkAutopilotAction): void {
  const type = action.type as NexBkAutopilotActionType;
  const cfg = action.config ?? {};
  switch (type) {
    case "mark_invoice_paid":
      // No config required — the payload-matched invoice id is used.
      return;
    case "send_message":
      if (!("template" in cfg) && !("body" in cfg)) {
        throw new AutopilotError("bad_action_config", `send_message action requires either "template" or "body" in config`);
      }
      return;
    case "request_review":
      // Optional channel: "email" | "sms" | "in_app"
      return;
    case "draft_supplier_order":
      if (!("supplier_id" in cfg) && !("supplier_from_payload" in cfg)) {
        throw new AutopilotError("bad_action_config", `draft_supplier_order requires "supplier_id" or "supplier_from_payload: true"`);
      }
      return;
    case "notify_owner":
      if (typeof cfg.message !== "string" || !cfg.message) {
        throw new AutopilotError("bad_action_config", `notify_owner requires config.message (non-empty string)`);
      }
      return;
    case "add_audit_note":
      if (typeof cfg.note !== "string" || !cfg.note) {
        throw new AutopilotError("bad_action_config", `add_audit_note requires config.note (non-empty string)`);
      }
      return;
  }
}

// ── Top-level evaluator ─────────────────────────────────────────────

/**
 * Evaluate one rule against one event. Returns:
 * - `[]` if the rule doesn't match or is disabled
 * - array of PlannedAction if it matches
 *
 * Purity: no I/O, no side effects, no wall-clock reads beyond a single
 * `Date.now()` for the timestamp on planned actions (pass `now` explicitly
 * for full determinism in tests).
 */
export function evaluateRule(
  rule: NexBkAutopilotRule,
  event: AutopilotEvent,
  opts: { now?: string } = {}
): PlannedAction[] {
  if (rule.mode === "disabled") return [];
  if (rule.business_id !== event.business_id) return [];
  if (!triggerMatchesEvent(rule.trigger_type, event.event_type)) return [];
  if (!conditionsMatch(rule.conditions ?? [], event.payload)) return [];

  // Validate every action once before emitting anything — fail closed
  // on misconfigured rules rather than emitting partial actions.
  for (const a of rule.actions) validateAction(a);

  const now = opts.now ?? new Date().toISOString();
  return rule.actions.map<PlannedAction>((action) => ({
    rule_id: rule.id,
    rule_name: rule.name,
    rule_mode: rule.mode as "suggest_only" | "auto_execute",
    action,
    reason: reasonForAction(rule, action, event),
    source_event_id: event.source_event_id,
    triggered_at: now,
  }));
}

/**
 * Evaluate an event against many rules — returns the flat list of
 * planned actions across all matching rules. Rules that fail to evaluate
 * (bad config, matcher throws) are skipped with their id + error recorded.
 */
export type EvaluateManyResult = {
  planned: PlannedAction[];
  errors: Array<{ rule_id: Uuid; rule_name: string; error: string }>;
};

export function evaluateEvent(
  rules: NexBkAutopilotRule[],
  event: AutopilotEvent,
  opts: { now?: string } = {}
): EvaluateManyResult {
  const planned: PlannedAction[] = [];
  const errors: EvaluateManyResult["errors"] = [];
  for (const rule of rules) {
    try {
      const p = evaluateRule(rule, event, opts);
      planned.push(...p);
    } catch (err) {
      errors.push({
        rule_id: rule.id,
        rule_name: rule.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { planned, errors };
}

// ── Grouping helpers for UI ─────────────────────────────────────────

/** Splits planned actions by mode — the UI shows `suggest_only` in the
 *  owner's inbox for approval, `auto_execute` in a "just happened" feed. */
export function splitPlannedByMode(planned: PlannedAction[]): {
  suggest_only: PlannedAction[];
  auto_execute: PlannedAction[];
} {
  return {
    suggest_only: planned.filter((p) => p.rule_mode === "suggest_only"),
    auto_execute: planned.filter((p) => p.rule_mode === "auto_execute"),
  };
}
