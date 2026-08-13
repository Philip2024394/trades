// GET/POST/PATCH /api/nex/automation/rules — Automation rules CRUD
//
// POST   create a rule. Body:
//          { name, description?, authority (L1|L2|L3), enabled?,
//            trigger { event_type, source?, related_department? },
//            condition? { payload_equals?, payload_exists? },
//            action { kind, ... } }
//
// PATCH  update a rule. Body:
//          { rule_id, ...patch fields }
//        Version is auto-incremented.
//
// GET    list rules. Params:
//          enabled_only=true · authority=L1|L2|L3

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createRule,
  updateRule,
  listRules,
  ruleConfidences,
  type AuthorityLevel,
  type RuleAction,
} from "@/lib/nex/automation/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_AUTHORITY: AuthorityLevel[] = ["L1", "L2", "L3"];
const VALID_ACTION_KINDS = ["log", "emit_event", "notify_admin", "webhook"] as const;

function validateAction(raw: unknown): RuleAction | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const a = raw as Record<string, unknown>;
  if (!VALID_ACTION_KINDS.includes(a.kind as (typeof VALID_ACTION_KINDS)[number])) return null;
  if (a.kind === "log" && typeof a.message === "string") return { kind: "log", message: a.message };
  if (a.kind === "emit_event" && typeof a.event_type === "string") {
    return { kind: "emit_event", event_type: a.event_type, payload: a.payload as Record<string, unknown> | undefined };
  }
  if (a.kind === "notify_admin" && typeof a.title === "string" && (a.priority === "P1" || a.priority === "P2" || a.priority === "P3")) {
    return { kind: "notify_admin", title: a.title, priority: a.priority };
  }
  if (a.kind === "webhook" && typeof a.url === "string") {
    const method = a.method === "GET" ? "GET" : "POST";
    return { kind: "webhook", url: a.url, method, body: a.body as Record<string, unknown> | undefined };
  }
  return null;
}

// ── POST · create ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

  const authority = body.authority as AuthorityLevel;
  if (!VALID_AUTHORITY.includes(authority)) {
    return NextResponse.json({ ok: false, error: "authority_required", detail: "L1 | L2 | L3" }, { status: 400 });
  }

  const trigger = body.trigger as { event_type?: unknown; source?: unknown; related_department?: unknown } | undefined;
  if (!trigger || typeof trigger.event_type !== "string" || !trigger.event_type.trim()) {
    return NextResponse.json({ ok: false, error: "trigger_event_type_required" }, { status: 400 });
  }

  const action = validateAction(body.action);
  if (!action) return NextResponse.json({ ok: false, error: "action_invalid" }, { status: 400 });

  try {
    const rule = await createRule({
      name,
      description: typeof body.description === "string" ? body.description : null,
      authority,
      enabled: typeof body.enabled === "boolean" ? body.enabled : true,
      trigger: {
        event_type: trigger.event_type,
        source: typeof trigger.source === "string" ? trigger.source : undefined,
        related_department: typeof trigger.related_department === "string" ? trigger.related_department : undefined,
      },
      condition: (body.condition && typeof body.condition === "object" && !Array.isArray(body.condition))
        ? (body.condition as { payload_equals?: Record<string, string | number | boolean>; payload_exists?: string[] })
        : null,
      action,
      created_by: typeof body.created_by === "string" ? body.created_by : "admin",
    });
    return NextResponse.json({ ok: true, backend: "filesystem", rule });
  } catch (err) {
    console.error("[automation.rules.POST] failed:", err);
    return NextResponse.json({ ok: false, error: "create_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}

// ── PATCH · update ───────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const rule_id = typeof body.rule_id === "string" ? body.rule_id : "";
  if (!rule_id) return NextResponse.json({ ok: false, error: "rule_id_required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.description === "string" || body.description === null) patch.description = body.description;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.authority === "string" && VALID_AUTHORITY.includes(body.authority as AuthorityLevel)) patch.authority = body.authority;
  if (body.trigger && typeof body.trigger === "object") patch.trigger = body.trigger;
  if (body.condition && typeof body.condition === "object") patch.condition = body.condition;
  if (body.action) {
    const action = validateAction(body.action);
    if (!action) return NextResponse.json({ ok: false, error: "action_invalid" }, { status: 400 });
    patch.action = action;
  }

  try {
    const updated = await updateRule(rule_id, patch as Parameters<typeof updateRule>[1]);
    if (!updated) return NextResponse.json({ ok: false, error: "rule_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, backend: "filesystem", rule: updated });
  } catch (err) {
    console.error("[automation.rules.PATCH] failed:", err);
    return NextResponse.json({ ok: false, error: "update_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}

// ── GET · list + confidences ─────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const enabled_only = searchParams.get("enabled_only") === "true";
  const authRaw = searchParams.get("authority") as AuthorityLevel | null;
  const authority = authRaw && VALID_AUTHORITY.includes(authRaw) ? authRaw : undefined;

  try {
    const [rules, confidences] = await Promise.all([
      listRules({ enabled_only, authority }),
      ruleConfidences(),
    ]);
    return NextResponse.json({
      ok: true,
      backend: "filesystem",
      rules,
      count: rules.length,
      confidences,
    });
  } catch (err) {
    console.error("[automation.rules.GET] failed:", err);
    return NextResponse.json({ ok: false, error: "list_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}
