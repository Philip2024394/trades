// src/app/api/nex/founder/command/route.ts
//
// SLICE #7 · Founder Command Surface v0 (Philip 2026-09-05)
//
// PURPOSE
// -------
// Receive founder commands, verify all authority factors, run
// governance, execute the allowed command, emit the full audit
// chain.
//
// AUTHORITY CHAIN (every command)
// -------------------------------
//   Factor A · Supabase Auth session (identity)
//        ↓
//   Factor B · Supabase user_id === NEX_FOUNDER_SUPABASE_USER_ID
//        ↓
//   Factor C · Valid, unexpired founder-mode session cookie
//              (from POST /api/nex/founder/session)
//        ↓
//   Gate 1 · Governance denylist check (constitutional restrictions)
//        ↓
//   Gate 2 · Governance allowlist check (known command kind)
//        ↓
//   Execute the specific handler
//        ↓
//   Emit audit event chain (received → authorized → executed)
//
// If ANY step fails, execution is aborted with a structured 4xx/5xx
// response AND the failure is recorded in the audit stream.
//
// The LLM is nowhere in this chain. The founder authority decision
// is made by NEX code alone (env config + cryptographic session
// verification). This preserves the LOCKED architectural hierarchy:
//
//   NEX decides authority · not the model.
//
// v0 COMMAND HANDLERS
// -------------------
//   nex.founder.ping           → { ok, timestamp, founder_user_id }
//   nex.founder.identity_status → { supabase_user_id, email, in_founder_mode, expires_at }
//   nex.founder.audit_query    → { events: [ ... last N founder.* events ... ] }
//
// All three are READ-ONLY. No state-changing commands in v0.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import {
  assertFounderConfigOperable,
  resolveFounderIdentity,
} from "@/lib/nex/founder/identity";
import {
  readFounderModeCookie,
  verifyFounderModeToken,
} from "@/lib/nex/founder/session";
import {
  evaluateCommand,
  type FounderCommand,
} from "@/lib/nex/founder/governance";
import { emitFounderEvent } from "@/lib/nex/founder/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── POST · execute a founder command ─────────────────────────────

export async function POST(req: NextRequest) {
  // Step 0 · config operable?
  try {
    assertFounderConfigOperable();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "server_misconfigured" },
      { status: 503 },
    );
  }

  // Step 1 · Supabase Auth
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    emitFounderEvent({
      kind: "founder.identity.rejected",
      actor_supabase_user_id: null,
      denial_gate: "auth",
      reason: auth.error,
    });
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  // Step 2 · Founder identity anchor
  const identity = resolveFounderIdentity({
    supabase_user_id: auth.user.supabase_user_id,
    email: auth.user.email,
  });
  if (identity.kind !== "founder_candidate") {
    emitFounderEvent({
      kind: "founder.identity.rejected",
      actor_supabase_user_id: auth.user.supabase_user_id,
      denial_gate: "identity",
      reason: identity.reason,
    });
    return NextResponse.json(
      { ok: false, error: "not_founder_identity", reason: identity.reason },
      { status: 403 },
    );
  }

  // Step 3 · Founder-mode session cookie
  const cookie = await readFounderModeCookie();
  const v = verifyFounderModeToken(cookie, auth.user.supabase_user_id);
  if (!v.valid) {
    emitFounderEvent({
      kind: "founder.identity.rejected",
      actor_supabase_user_id: auth.user.supabase_user_id,
      denial_gate: "session",
      reason: v.reason,
    });
    return NextResponse.json(
      { ok: false, error: "not_in_founder_mode", reason: v.reason },
      { status: 401 },
    );
  }

  // Step 4 · Parse + normalize the command
  let body: Partial<FounderCommand> = {};
  try {
    body = await req.json();
  } catch {
    // Malformed body handled by governance.evaluateCommand()
  }
  const command: FounderCommand = {
    command_id:
      typeof body.command_id === "string" && body.command_id.length > 0
        ? body.command_id
        : randomUUID(),
    kind: typeof body.kind === "string" ? body.kind : "",
    args: (body.args && typeof body.args === "object" ? body.args : undefined) as
      | Record<string, unknown>
      | undefined,
    requested_at_iso:
      typeof body.requested_at_iso === "string" ? body.requested_at_iso : new Date().toISOString(),
    correlation_id:
      typeof body.correlation_id === "string" ? body.correlation_id : undefined,
  };

  // Step 5 · Emit received event (pending outcome)
  emitFounderEvent({
    kind: "founder.command.received",
    actor_supabase_user_id: auth.user.supabase_user_id,
    command_id: command.command_id,
    command_kind: command.kind,
    correlation_id: command.correlation_id,
  });

  // Step 6 · Governance decision
  const decision = evaluateCommand(command);
  if (!decision.allowed) {
    emitFounderEvent({
      kind: "founder.command.denied",
      actor_supabase_user_id: auth.user.supabase_user_id,
      command_id: command.command_id,
      command_kind: command.kind,
      denial_gate: decision.gate,
      reason: decision.reason,
      correlation_id: command.correlation_id,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "command_denied",
        reason: decision.reason,
        gate: decision.gate,
        command_id: command.command_id,
      },
      { status: decision.gate === "malformed" ? 400 : 403 },
    );
  }

  emitFounderEvent({
    kind: "founder.command.authorized",
    actor_supabase_user_id: auth.user.supabase_user_id,
    command_id: command.command_id,
    command_kind: command.kind,
    correlation_id: command.correlation_id,
  });

  // Step 7 · Execute the specific handler
  try {
    const result = await executeCommand(command, {
      founder_supabase_user_id: auth.user.supabase_user_id,
      founder_email: auth.user.email,
      founder_mode: v,
    });
    emitFounderEvent({
      kind: "founder.command.executed",
      actor_supabase_user_id: auth.user.supabase_user_id,
      command_id: command.command_id,
      command_kind: command.kind,
      correlation_id: command.correlation_id,
      extra: { outcome_summary: summarizeOutcome(command.kind, result) },
    });
    return NextResponse.json(
      { ok: true, command_id: command.command_id, kind: command.kind, result },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitFounderEvent({
      kind: "founder.command.failed",
      actor_supabase_user_id: auth.user.supabase_user_id,
      command_id: command.command_id,
      command_kind: command.kind,
      reason: msg,
      correlation_id: command.correlation_id,
    });
    return NextResponse.json(
      { ok: false, error: "command_failed", command_id: command.command_id, reason: msg },
      { status: 500 },
    );
  }
}

// ─── Command handlers (v0 · read-only only) ──────────────────────

type ExecContext = {
  founder_supabase_user_id: string;
  founder_email: string;
  founder_mode: {
    valid: true;
    user_id: string;
    issued_at_iso: string;
    expires_at_iso: string;
    remaining_sec: number;
  };
};

async function executeCommand(
  cmd: FounderCommand,
  ctx: ExecContext,
): Promise<Record<string, unknown>> {
  switch (cmd.kind) {
    case "nex.founder.ping":
      return {
        timestamp: new Date().toISOString(),
        founder_user_id: ctx.founder_supabase_user_id,
      };

    case "nex.founder.identity_status":
      return {
        supabase_user_id: ctx.founder_supabase_user_id,
        email: ctx.founder_email,
        in_founder_mode: true,
        issued_at_iso: ctx.founder_mode.issued_at_iso,
        expires_at_iso: ctx.founder_mode.expires_at_iso,
        remaining_sec: ctx.founder_mode.remaining_sec,
      };

    case "nex.founder.audit_query": {
      // Read scope · founder.* events only. Small default limit.
      // We keep this thin in v0 · a proper query surface can arrive
      // in a future slice under separate authorization.
      const rawLimit = typeof cmd.args?.limit === "number" ? cmd.args.limit : 25;
      const limit = Math.max(1, Math.min(200, Math.floor(rawLimit)));
      const events = await readFounderAuditWindow(limit);
      return {
        limit,
        count: events.length,
        events,
        note:
          "founder.* events only · read from local Intelligence Event Bus · v0 read-only surface",
      };
    }

    default:
      // Should be unreachable because governance already rejected
      // unknown kinds. Belt + braces.
      throw new Error(`unhandled_command_kind: ${cmd.kind}`);
  }
}

function summarizeOutcome(kind: string, result: Record<string, unknown>): string {
  switch (kind) {
    case "nex.founder.ping":
      return "ping_ok";
    case "nex.founder.identity_status":
      return "identity_reported";
    case "nex.founder.audit_query":
      return `returned_${(result.count as number) ?? 0}_events`;
    default:
      return "ok";
  }
}

// ─── Audit window reader ─────────────────────────────────────────

async function readFounderAuditWindow(limit: number): Promise<Array<Record<string, unknown>>> {
  // Fail-closed on any storage error. Audit-query returning an empty
  // list is safer than surfacing a partial/corrupted read.
  try {
    const { getStorage } = await import("@/lib/nex/storage/registry");
    const { COLLECTIONS } = await import("@/lib/nex/storage/types");
    const storage = getStorage();
    // Query the events collection scoped to executive_layer source
    // (which is what emitFounderEvent uses). Then filter by
    // event_type prefix client-side to keep the founder.* scope
    // tight even if other executive_layer producers appear later.
    const rows = await storage.query<Record<string, unknown>>(COLLECTIONS.events, {
      where: { source: "executive_layer" },
      order_by: "timestamp",
      order_dir: "desc",
      limit: Math.max(limit, 100),
    });
    const filtered: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      const et = (row as { event_type?: string }).event_type;
      if (typeof et === "string" && et.startsWith("founder.")) {
        filtered.push(row);
        if (filtered.length >= limit) break;
      }
    }
    return filtered;
  } catch {
    return [];
  }
}

// ─── GET · convenience for smoke checks ──────────────────────────

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      surface: "nex.founder.command",
      version: "v0",
      accepts: ["POST"],
      note:
        "POST a FounderCommand { command_id, kind, args?, requested_at_iso, correlation_id? } while in founder mode.",
    },
    { status: 200 },
  );
}
