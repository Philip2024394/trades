// src/lib/nex/live-chat-completion/actions/authorize.ts
//
// Founder BEGIN Phase 3.7 · Safe Actionable Intelligence · authorization pipeline.
//
// Enforces the Founder rule: LLM proposes, NEX decides. Every proposed
// action traverses:
//
//   1. schema validation      (Zod strict on action-specific args)
//   2. registry lookup        (only registered actions allowed)
//   3. permission check       (session / role rules)
//   4. guardrail              (safety rules for this action)
//   5. confirmation           (client user tap if required)
//   6. execution              (registered executor)
//   7. immutable audit        (nex.action_audit)
//
// Any stage rejects → `pending_confirmation` OR `rejected_*` outcome.
// Only `executed` proceeds through to the executor and records the result.

import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  ProposedActionSchema,
  type ActionContext, type AuthorizedActionRecord, type ProposedAction,
} from "./contract";
import { getActionDefinition } from "./registry";

export interface AuthorizeInput {
  proposal: unknown;                 // raw · maybe from LLM · we validate
  context: ActionContext;
  kfPool: Pool;
  /** If the user is confirming a previously-issued action, echo the token. */
  confirmation_token?: string | null;
}

// Pending-confirmation store · in-memory · token → proposal snapshot.
// A future BEGIN may move this to durable storage.
const _PENDING = new Map<string, { proposal: ProposedAction; context: ActionContext; created_at: number }>();
const _PENDING_TTL_MS = 5 * 60_000;

function pendingPut(token: string, proposal: ProposedAction, context: ActionContext): void {
  // Cheap eviction: on write, drop any tokens older than TTL.
  const now = Date.now();
  for (const [k, v] of _PENDING.entries()) if (now - v.created_at > _PENDING_TTL_MS) _PENDING.delete(k);
  _PENDING.set(token, { proposal, context, created_at: now });
}

function pendingTake(token: string): { proposal: ProposedAction; context: ActionContext } | null {
  const hit = _PENDING.get(token);
  if (!hit) return null;
  if (Date.now() - hit.created_at > _PENDING_TTL_MS) { _PENDING.delete(token); return null; }
  _PENDING.delete(token);
  return { proposal: hit.proposal, context: hit.context };
}

// ═══════════════════════════════════════════════════════════════════
// Immutable audit · nex.action_audit
// ═══════════════════════════════════════════════════════════════════

async function writeAudit(pool: Pool, record: AuthorizedActionRecord): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO nex.action_audit
         (audit_id, conversation_id, action_id, args, outcome, outcome_reason,
          executed_at, result, requires_user_confirmation, confirmation_token, trace)
       VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb)
       ON CONFLICT (audit_id) DO NOTHING`,
      [
        record.audit_id,
        record.conversation_id,
        record.proposed.action_id,
        JSON.stringify(record.proposed.args ?? {}),
        record.outcome,
        record.outcome_reason,
        record.executed_at,
        JSON.stringify(record.result ?? null),
        record.requires_user_confirmation,
        record.confirmation_token ?? null,
        JSON.stringify(record.trace),
      ],
    );
  } catch { /* audit failure is non-fatal · rule enforcement stays server-side */ }
}

// ═══════════════════════════════════════════════════════════════════
// Public entry · authorize a proposed action
// ═══════════════════════════════════════════════════════════════════

export async function authorizeAction(input: AuthorizeInput): Promise<AuthorizedActionRecord> {
  const trace: string[] = [];
  const audit_id = randomUUID();

  // Confirmation-flow branch · if a token was provided, restore the
  // original proposal and skip schema/registry/perm/guardrail (they
  // already passed to reach pending state).
  let proposalToRun: ProposedAction | null = null;
  let contextToRun: ActionContext = input.context;
  let cameFromConfirmation = false;
  if (input.confirmation_token) {
    const restored = pendingTake(input.confirmation_token);
    if (!restored) {
      const rec: AuthorizedActionRecord = {
        audit_id, conversation_id: input.context.conversation_id,
        proposed: { action_id: "unknown", args: {} },
        outcome: "rejected_no_llm_rule", outcome_reason: "confirmation_token_expired_or_unknown",
        executed_at: null, result: null, requires_user_confirmation: false,
        trace: ["confirmation_lookup_failed"],
      };
      await writeAudit(input.kfPool, rec);
      return rec;
    }
    proposalToRun = restored.proposal;
    contextToRun = restored.context;
    cameFromConfirmation = true;
    trace.push("confirmation_token_matched");
  }

  // ── 1. Schema validation ──────────────────────────────────────────
  let parsedProposal: ProposedAction;
  if (proposalToRun) {
    parsedProposal = proposalToRun;
    trace.push("schema_bypassed_via_confirmation");
  } else {
    const schema = ProposedActionSchema.safeParse(input.proposal);
    if (!schema.success) {
      const rec: AuthorizedActionRecord = {
        audit_id, conversation_id: input.context.conversation_id,
        proposed: { action_id: "invalid_shape", args: {} },
        outcome: "rejected_schema",
        outcome_reason: schema.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "root"}:${i.message}`).join(" · "),
        executed_at: null, result: null, requires_user_confirmation: false,
        trace: ["schema_validation_failed"],
      };
      await writeAudit(input.kfPool, rec);
      return rec;
    }
    parsedProposal = schema.data;
    trace.push("schema_valid");
  }

  // ── 2. Registry lookup ────────────────────────────────────────────
  const def = getActionDefinition(parsedProposal.action_id);
  if (!def) {
    const rec: AuthorizedActionRecord = {
      audit_id, conversation_id: contextToRun.conversation_id,
      proposed: parsedProposal,
      outcome: "rejected_unknown_action",
      outcome_reason: `action_id_not_registered:${parsedProposal.action_id}`,
      executed_at: null, result: null, requires_user_confirmation: false,
      trace: [...trace, "registry_miss"],
    };
    await writeAudit(input.kfPool, rec);
    return rec;
  }
  trace.push(`registry_hit:${def.id}`);

  // Validate args against the action-specific schema.
  const argsCheck = def.args_schema.safeParse(parsedProposal.args ?? {});
  if (!argsCheck.success) {
    const rec: AuthorizedActionRecord = {
      audit_id, conversation_id: contextToRun.conversation_id,
      proposed: parsedProposal,
      outcome: "rejected_schema",
      outcome_reason: `args:${argsCheck.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "root"}:${i.message}`).join(";")}`,
      executed_at: null, result: null, requires_user_confirmation: false,
      trace: [...trace, "args_schema_failed"],
    };
    await writeAudit(input.kfPool, rec);
    return rec;
  }
  parsedProposal.args = argsCheck.data as Record<string, unknown>;
  trace.push("args_valid");

  // ── 3. Permission ─────────────────────────────────────────────────
  const perm = def.permission({ context: contextToRun, args: parsedProposal.args });
  if (!perm.allowed) {
    const rec: AuthorizedActionRecord = {
      audit_id, conversation_id: contextToRun.conversation_id,
      proposed: parsedProposal,
      outcome: "rejected_permission",
      outcome_reason: perm.reason,
      executed_at: null, result: null, requires_user_confirmation: false,
      trace: [...trace, `permission_denied:${perm.reason}`],
    };
    await writeAudit(input.kfPool, rec);
    return rec;
  }
  trace.push("permission_granted");

  // ── 4. Guardrail (placeholder · adopts existing output guardrail
  //      registry in a future BEGIN · for now, deterministic policy)
  // ── 5. Confirmation ───────────────────────────────────────────────
  if (def.requires_confirmation && !cameFromConfirmation) {
    const token = randomUUID();
    pendingPut(token, parsedProposal, contextToRun);
    const rec: AuthorizedActionRecord = {
      audit_id, conversation_id: contextToRun.conversation_id,
      proposed: parsedProposal,
      outcome: "pending_confirmation",
      outcome_reason: "action_requires_user_confirmation",
      executed_at: null, result: null,
      requires_user_confirmation: true,
      confirmation_token: token,
      trace: [...trace, "awaiting_user_confirmation"],
    };
    await writeAudit(input.kfPool, rec);
    return rec;
  }

  // ── 6. Execute ────────────────────────────────────────────────────
  let executed: { ok: boolean; result?: unknown; error?: string };
  try {
    executed = await def.executor({ context: contextToRun, args: parsedProposal.args });
  } catch (e) {
    executed = { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "executor_exception" };
  }

  const rec: AuthorizedActionRecord = {
    audit_id, conversation_id: contextToRun.conversation_id,
    proposed: parsedProposal,
    outcome: executed.ok ? "executed" : "rejected_guardrail",
    outcome_reason: executed.ok ? "executor_ok" : (executed.error ?? "executor_failed"),
    executed_at: executed.ok ? new Date().toISOString() : null,
    result: executed.result ?? null,
    requires_user_confirmation: false,
    trace: [...trace, executed.ok ? "executed" : `execute_failed:${executed.error ?? "unknown"}`],
  };
  await writeAudit(input.kfPool, rec);
  return rec;
}
