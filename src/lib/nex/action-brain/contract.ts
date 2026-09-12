// src/lib/nex/action-brain/contract.ts
//
// Founder Path A/B · ECO-2 · Action Brain facade contract.
//
// Wraps the existing action pipeline (authorize.ts · registry.ts ·
// control-plane.ts · nex.action_audit) behind ONE named surface.
// Nothing changes about how actions execute · this brain just gives
// the rest of the system a single call to make.
//
// Doctrine #2 anchor: LLM NEVER EXECUTES AN ACTION WITHOUT NEX
// AUTHORIZATION. Every method here enforces the 7-stage authorize
// pipeline. propose() emits a confirmation token if the action
// requires it; confirm() completes the pending proposal only if the
// token echo is valid.
//
// MCP layer (see mcp-server.ts and mcp-client.ts) reuses this same
// facade — external tools plug in without a doctrine escape hatch.

import type { AuthorizedActionRecord } from "@/lib/nex/live-chat-completion/actions/contract";

// ═══════════════════════════════════════════════════════════════════
// Public surface
// ═══════════════════════════════════════════════════════════════════

export interface ActionBrainFacade {
  name: string;

  /**
   * Propose an action for authorization. Returns an AuthorizedActionRecord
   * that captures the outcome of the 7-stage pipeline. If confirmation is
   * required, the record carries `confirmation_token` for the client to
   * echo back via confirm().
   */
  propose(input: {
    action_id: string;
    args: Record<string, unknown>;
    rationale?: string;
    conversation_id?: string | null;
    entity_ref?: string | null;
    language?: "en" | "id";
    user_id?: string | null;
  }): Promise<AuthorizedActionRecord | null>;

  /**
   * Complete a pending confirmation. The client MUST echo the exact
   * confirmation_token that was issued by propose(). Tokens have a
   * short TTL (5min default in authorize.ts).
   */
  confirm(input: {
    confirmation_token: string;
    conversation_id?: string | null;
  }): Promise<AuthorizedActionRecord | null>;

  /**
   * List registered actions (name + schema summary). For the MCP tool-
   * server to announce capabilities to external clients.
   */
  listActions(): Promise<readonly {
    action_id: string;
    summary: string;
    requires_confirmation: boolean;
  }[]>;
}
