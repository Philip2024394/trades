// src/lib/nex/live-chat-completion/actions/contract.ts
//
// Founder BEGIN Phase 3.7 · Safe Actionable Intelligence · Action contract.
//
// Founder rule (2026-09-09, persisted in nex.master_rulebook):
//   "LLM NEVER EXECUTES AN ACTION WITHOUT NEX AUTHORIZATION."
//
// The LLM PROPOSES actions. NEX DECIDES whether they execute. Every
// proposed action MUST traverse:
//
//   schema validation → permission check → guardrail → confirmation
//     → execution → immutable audit
//
// This module holds the shapes. The registry + authorization pipeline
// live in registry.ts + authorize.ts.

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// Action IDs · one canonical string per registered action.
// New actions require adding a schema + executor + permission rule.
// ═══════════════════════════════════════════════════════════════════

export type ActionId =
  | "contact_via_whatsapp"     // opens WhatsApp with pre-filled message to entity
  | "save_favorite"            // add entity to user's saved list (session-scoped)
  | "submit_gap_ticket"        // enqueue a knowledge_gap for background workers
  | "request_evidence_page";   // return a public evidence page URL for the entity

export const ACTION_IDS = Object.freeze<readonly ActionId[]>([
  "contact_via_whatsapp",
  "save_favorite",
  "submit_gap_ticket",
  "request_evidence_page",
]);

// ═══════════════════════════════════════════════════════════════════
// LLM's proposal shape · what a rescue provider is allowed to emit.
// Kept minimal · authorization enriches later.
// ═══════════════════════════════════════════════════════════════════

export const ProposedActionSchema = z.object({
  action_id: z.string().min(1).max(60),
  args: z.record(z.string(), z.unknown()).default({}),
  // The LLM's own justification · shown to user in confirmation UI.
  rationale: z.string().max(500).optional(),
});
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

// ═══════════════════════════════════════════════════════════════════
// Verdict shapes for each pipeline stage
// ═══════════════════════════════════════════════════════════════════

export type AuthorizationOutcome =
  | "executed"
  | "rejected_schema"
  | "rejected_unknown_action"
  | "rejected_permission"
  | "rejected_guardrail"
  | "pending_confirmation"
  | "rejected_no_llm_rule";  // catch-all: LLM must not act without NEX

export interface AuthorizedActionRecord {
  audit_id: string;
  conversation_id: string | null;
  proposed: ProposedAction;
  outcome: AuthorizationOutcome;
  outcome_reason: string;
  executed_at: string | null;
  result: unknown | null;
  requires_user_confirmation: boolean;
  confirmation_token?: string;
  // Provenance chain of decisions.
  trace: readonly string[];
}

// ═══════════════════════════════════════════════════════════════════
// Executor / Permission signatures
// ═══════════════════════════════════════════════════════════════════

export interface ActionContext {
  conversation_id: string | null;
  entity_ref: string | null;
  language: "en" | "id";
  // Optional session identity · future user-identity BEGIN populates this.
  session_id?: string | null;
  user_id?: string | null;
}

export type PermissionCheck = (
  input: { context: ActionContext; args: Record<string, unknown> },
) => { allowed: true } | { allowed: false; reason: string };

export type ActionExecutor = (
  input: { context: ActionContext; args: Record<string, unknown> },
) => Promise<{
  ok: boolean;
  result?: unknown;
  error?: string;
}>;

export interface ActionDefinition {
  id: ActionId;
  display_en: string;
  display_id: string;
  args_schema: z.ZodTypeAny;
  /** True → NEX asks the user to confirm before executing. */
  requires_confirmation: boolean;
  /** Which trust band the retrieval evidence needs to be at, or null for none. */
  min_trust: "canonical_verified" | "evidence_verified" | "any" | null;
  /** Permission gate · runs before guardrails. */
  permission: PermissionCheck;
  /** Only invoked AFTER authorization. */
  executor: ActionExecutor;
}
