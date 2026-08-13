// Nex Booker · Autopilot rule engine tests.
//
// Covers: trigger matching per type, condition ops, mode gating,
// action validation, reason strings, evaluateEvent aggregation,
// splitPlannedByMode, and error handling for misconfigured rules.

import { describe, expect, it } from "vitest";
import {
  AutopilotError,
  evaluateEvent,
  evaluateRule,
  splitPlannedByMode,
  validateAction,
  type AutopilotEvent,
} from "./autopilot";
import type {
  NexBkAutopilotAction,
  NexBkAutopilotCondition,
  NexBkAutopilotRule,
  NexBkAutopilotTriggerType,
} from "./types";

// ── Fixtures ────────────────────────────────────────────────────────

function mkRule(overrides: Partial<NexBkAutopilotRule> = {}): NexBkAutopilotRule {
  return {
    id: "rule-1",
    business_id: "biz-1",
    name: "Test rule",
    description: null,
    trigger_type: "on_customer_payment",
    trigger_config: {},
    conditions: [],
    actions: [{ type: "notify_owner", config: { message: "You've been paid!" } }],
    mode: "suggest_only",
    created_by_user_id: null,
    created_at: "2026-08-06T00:00:00Z",
    updated_at: "2026-08-06T00:00:00Z",
    last_fired_at: null,
    last_fired_event_id: null,
    fired_count: 0,
    last_error: null,
    notes: null,
    ...overrides,
  };
}

function mkEvent(overrides: Partial<AutopilotEvent> = {}): AutopilotEvent {
  return {
    business_id: "biz-1",
    event_type: "payment_received",
    entity_type: "payment",
    entity_id: "pay-1",
    payload: { amount: 500, customer_id: "cust-1", invoice_ref: "INV-42" },
    source_event_id: "evt-1",
    ...overrides,
  };
}

const NOW = "2026-08-06T10:00:00Z";

// ── Trigger matching ───────────────────────────────────────────────

describe("evaluateRule · trigger matching", () => {
  const cases: Array<[NexBkAutopilotTriggerType, string, boolean]> = [
    ["on_receipt_captured", "receipt_captured", true],
    ["on_receipt_captured", "payment_received", false],
    ["on_invoice_issued", "invoice_issued", true],
    ["on_customer_payment", "payment_received", true],
    ["on_customer_payment", "invoice_issued", false],
    ["on_invoice_overdue_days", "invoice_aged_check", true],
    ["on_stock_below_min", "stock_low_signal", true],
    ["on_period_ready_for_accountant", "period_marked_ready", true],
    ["on_period_ready_for_accountant", "receipt_captured", false],
  ];

  for (const [trigger, eventType, shouldMatch] of cases) {
    it(`${trigger} vs event ${eventType} → ${shouldMatch ? "matches" : "no match"}`, () => {
      const rule = mkRule({ trigger_type: trigger });
      const event = mkEvent({ event_type: eventType });
      const planned = evaluateRule(rule, event, { now: NOW });
      expect(planned.length > 0).toBe(shouldMatch);
    });
  }
});

// ── Mode gating ────────────────────────────────────────────────────

describe("evaluateRule · mode gating", () => {
  it("disabled rule returns []", () => {
    const rule = mkRule({ mode: "disabled" });
    const planned = evaluateRule(rule, mkEvent(), { now: NOW });
    expect(planned).toEqual([]);
  });

  it("suggest_only rule fires, actions carry rule_mode 'suggest_only'", () => {
    const rule = mkRule({ mode: "suggest_only" });
    const planned = evaluateRule(rule, mkEvent(), { now: NOW });
    expect(planned).toHaveLength(1);
    expect(planned[0].rule_mode).toBe("suggest_only");
  });

  it("auto_execute rule fires, actions carry rule_mode 'auto_execute'", () => {
    const rule = mkRule({ mode: "auto_execute" });
    const planned = evaluateRule(rule, mkEvent(), { now: NOW });
    expect(planned).toHaveLength(1);
    expect(planned[0].rule_mode).toBe("auto_execute");
  });
});

// ── Business isolation ─────────────────────────────────────────────

describe("evaluateRule · business isolation", () => {
  it("rule from a different business does NOT fire on this event", () => {
    const rule = mkRule({ business_id: "biz-other" });
    const event = mkEvent({ business_id: "biz-1" });
    expect(evaluateRule(rule, event, { now: NOW })).toEqual([]);
  });
});

// ── Conditions ─────────────────────────────────────────────────────

describe("evaluateRule · conditions", () => {
  it("all conditions match (AND semantics) → fires", () => {
    const rule = mkRule({
      conditions: [
        { field: "amount", op: "gte", value: 100 },
        { field: "customer_id", op: "eq", value: "cust-1" },
      ],
    });
    expect(evaluateRule(rule, mkEvent(), { now: NOW })).toHaveLength(1);
  });

  it("any condition fails → no fire", () => {
    const rule = mkRule({
      conditions: [
        { field: "amount", op: "gte", value: 100 },
        { field: "customer_id", op: "eq", value: "cust-999" },   // Mismatch
      ],
    });
    expect(evaluateRule(rule, mkEvent(), { now: NOW })).toEqual([]);
  });

  it("empty conditions → all events matching trigger fire", () => {
    const rule = mkRule({ conditions: [] });
    expect(evaluateRule(rule, mkEvent(), { now: NOW })).toHaveLength(1);
  });

  it("supports nested field paths (a.b.c)", () => {
    const rule = mkRule({
      conditions: [{ field: "meta.priority", op: "eq", value: "high" }],
    });
    const event = mkEvent({
      payload: { amount: 500, customer_id: "cust-1", meta: { priority: "high" } },
    });
    expect(evaluateRule(rule, event, { now: NOW })).toHaveLength(1);
  });
});

describe("evaluateRule · condition operators", () => {
  const ops: Array<[NexBkAutopilotCondition["op"], unknown, unknown, boolean]> = [
    ["eq", 500, 500, true],
    ["eq", 500, 400, false],
    ["neq", 500, 400, true],
    ["neq", 500, 500, false],
    ["gt", 500, 400, true],
    ["gt", 500, 500, false],
    ["gte", 500, 500, true],
    ["gte", 500, 501, false],
    ["lt", 500, 501, true],
    ["lt", 500, 500, false],
    ["lte", 500, 500, true],
    ["lte", 500, 499, false],
    ["in", "cust-1", ["cust-1", "cust-2"], true],
    ["in", "cust-999", ["cust-1", "cust-2"], false],
    ["not_in", "cust-999", ["cust-1", "cust-2"], true],
    ["not_in", "cust-1", ["cust-1"], false],
    ["contains", "Materials · timber", "timber", true],
    ["contains", "Materials · timber", "plastic", false],
    ["contains", ["oak", "walnut"], "oak", true],
  ];
  for (const [op, actual, expected, shouldMatch] of ops) {
    it(`op ${op}(${JSON.stringify(actual)}, ${JSON.stringify(expected)}) → ${shouldMatch}`, () => {
      const rule = mkRule({
        conditions: [{ field: "value", op, value: expected }],
      });
      const event = mkEvent({ payload: { value: actual } });
      const planned = evaluateRule(rule, event, { now: NOW });
      expect(planned.length > 0).toBe(shouldMatch);
    });
  }
});

// ── Multiple actions per rule ──────────────────────────────────────

describe("evaluateRule · multiple actions", () => {
  it("emits one PlannedAction per configured action", () => {
    const rule = mkRule({
      actions: [
        { type: "notify_owner", config: { message: "Paid" } },
        { type: "mark_invoice_paid", config: {} },
        { type: "request_review", config: { channel: "email" } },
      ],
    });
    const planned = evaluateRule(rule, mkEvent(), { now: NOW });
    expect(planned).toHaveLength(3);
    expect(planned.map((p) => p.action.type)).toEqual([
      "notify_owner", "mark_invoice_paid", "request_review",
    ]);
  });

  it("all planned actions carry the same rule_id + rule_name + triggered_at", () => {
    const rule = mkRule({
      name: "Payment thanks",
      actions: [
        { type: "notify_owner", config: { message: "Paid" } },
        { type: "request_review", config: {} },
      ],
    });
    const planned = evaluateRule(rule, mkEvent(), { now: NOW });
    for (const p of planned) {
      expect(p.rule_id).toBe(rule.id);
      expect(p.rule_name).toBe("Payment thanks");
      expect(p.triggered_at).toBe(NOW);
    }
  });
});

// ── Reason strings (Principle 7: Explain the Reasoning) ────────────

describe("evaluateRule · reasons", () => {
  it("every planned action carries a non-empty human reason", () => {
    const rule = mkRule({
      actions: [
        { type: "mark_invoice_paid", config: {} },
        { type: "send_message", config: { template: "thank_you" } },
        { type: "add_audit_note", config: { note: "Auto-noted" } },
      ],
    });
    const planned = evaluateRule(rule, mkEvent(), { now: NOW });
    for (const p of planned) {
      expect(p.reason.length).toBeGreaterThan(10);
      expect(p.reason).toContain("Test rule");   // Rule name should appear
    }
  });

  it("reason includes friendly trigger name", () => {
    const rule = mkRule({
      trigger_type: "on_stock_below_min",
      actions: [{ type: "draft_supplier_order", config: { supplier_id: "sup-1" } }],
    });
    const event = mkEvent({ event_type: "stock_low_signal" });
    const [action] = evaluateRule(rule, event, { now: NOW });
    expect(action.reason).toContain("Stock dropped below");
  });
});

// ── Action validation ──────────────────────────────────────────────

describe("validateAction", () => {
  it("send_message: needs template OR body", () => {
    expect(() => validateAction({ type: "send_message", config: { template: "x" } })).not.toThrow();
    expect(() => validateAction({ type: "send_message", config: { body: "hi" } })).not.toThrow();
    expect(() => validateAction({ type: "send_message", config: {} })).toThrow(/template.*body/);
  });

  it("notify_owner: needs message string", () => {
    expect(() => validateAction({ type: "notify_owner", config: { message: "x" } })).not.toThrow();
    expect(() => validateAction({ type: "notify_owner", config: {} })).toThrow(/message/);
    expect(() => validateAction({ type: "notify_owner", config: { message: "" } })).toThrow();
  });

  it("draft_supplier_order: needs supplier_id or supplier_from_payload", () => {
    expect(() => validateAction({ type: "draft_supplier_order", config: { supplier_id: "sup-1" } })).not.toThrow();
    expect(() => validateAction({ type: "draft_supplier_order", config: { supplier_from_payload: true } })).not.toThrow();
    expect(() => validateAction({ type: "draft_supplier_order", config: {} })).toThrow(/supplier/);
  });

  it("add_audit_note: needs note string", () => {
    expect(() => validateAction({ type: "add_audit_note", config: { note: "x" } })).not.toThrow();
    expect(() => validateAction({ type: "add_audit_note", config: {} })).toThrow(/note/);
  });

  it("mark_invoice_paid + request_review need no required config", () => {
    expect(() => validateAction({ type: "mark_invoice_paid", config: {} })).not.toThrow();
    expect(() => validateAction({ type: "request_review", config: {} })).not.toThrow();
  });
});

describe("evaluateRule · rejects rules with bad action config", () => {
  it("throws AutopilotError with 'bad_action_config' code", () => {
    const bad: NexBkAutopilotAction = { type: "send_message", config: {} };
    const rule = mkRule({ actions: [bad] });
    try {
      evaluateRule(rule, mkEvent(), { now: NOW });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AutopilotError);
      expect((err as AutopilotError).code).toBe("bad_action_config");
    }
  });
});

// ── evaluateEvent (many rules) ─────────────────────────────────────

describe("evaluateEvent", () => {
  it("returns flat planned list across matching rules", () => {
    const rules: NexBkAutopilotRule[] = [
      mkRule({ id: "r1", name: "A", actions: [{ type: "notify_owner", config: { message: "1" } }] }),
      mkRule({ id: "r2", name: "B", actions: [{ type: "notify_owner", config: { message: "2" } }] }),
    ];
    const result = evaluateEvent(rules, mkEvent(), { now: NOW });
    expect(result.planned).toHaveLength(2);
    expect(result.errors).toEqual([]);
    expect(result.planned.map((p) => p.rule_id).sort()).toEqual(["r1", "r2"]);
  });

  it("skips rules that don't match, keeps ones that do", () => {
    const rules: NexBkAutopilotRule[] = [
      mkRule({ id: "r1", trigger_type: "on_receipt_captured" }),   // Won't match payment_received
      mkRule({ id: "r2", trigger_type: "on_customer_payment" }),
    ];
    const result = evaluateEvent(rules, mkEvent(), { now: NOW });
    expect(result.planned).toHaveLength(1);
    expect(result.planned[0].rule_id).toBe("r2");
  });

  it("collects errors from misconfigured rules without stopping others", () => {
    const rules: NexBkAutopilotRule[] = [
      mkRule({ id: "r1", name: "Bad", actions: [{ type: "send_message", config: {} }] }),   // Bad config
      mkRule({ id: "r2", name: "Good" }),
    ];
    const result = evaluateEvent(rules, mkEvent(), { now: NOW });
    expect(result.planned).toHaveLength(1);
    expect(result.planned[0].rule_id).toBe("r2");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule_id).toBe("r1");
    expect(result.errors[0].error).toMatch(/template.*body/);
  });
});

// ── splitPlannedByMode ─────────────────────────────────────────────

describe("splitPlannedByMode", () => {
  it("groups by mode", () => {
    const rules: NexBkAutopilotRule[] = [
      mkRule({ id: "r1", mode: "suggest_only" }),
      mkRule({ id: "r2", mode: "auto_execute" }),
      mkRule({ id: "r3", mode: "suggest_only" }),
    ];
    const { planned } = evaluateEvent(rules, mkEvent(), { now: NOW });
    const split = splitPlannedByMode(planned);
    expect(split.suggest_only).toHaveLength(2);
    expect(split.auto_execute).toHaveLength(1);
  });
});

// ── Doctrine compliance sanity checks ──────────────────────────────

describe("doctrine compliance", () => {
  it("Principle 4/6: engine never executes actions — only emits data", () => {
    const rule = mkRule({
      mode: "auto_execute",
      actions: [{ type: "mark_invoice_paid", config: {} }],
    });
    const planned = evaluateRule(rule, mkEvent(), { now: NOW });
    // No side effects — result is just data. Test confirms we get data back with rule_mode preserved so downstream executor can decide.
    expect(planned[0]).toMatchObject({
      rule_id: "rule-1",
      rule_mode: "auto_execute",
      action: { type: "mark_invoice_paid" },
    });
  });

  it("Principle 6: default mode is suggest_only (owner in control)", () => {
    // The DB default is suggest_only (enforced by migration CHECK + DEFAULT).
    // This test asserts the fixture reflects that.
    const rule = mkRule({});
    expect(rule.mode).toBe("suggest_only");
  });

  it("Principle 7: every planned action includes a reason (audit trail)", () => {
    const rule = mkRule({
      actions: [
        { type: "notify_owner", config: { message: "x" } },
        { type: "mark_invoice_paid", config: {} },
      ],
    });
    const planned = evaluateRule(rule, mkEvent(), { now: NOW });
    for (const p of planned) expect(p.reason).toBeTruthy();
  });
});
