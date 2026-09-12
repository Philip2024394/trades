// src/lib/nex/action-brain/mcp-server.ts
//
// Founder Path A/B · ECO-2 · MCP tool-server scaffold.
//
// Exposes NEX's authorized actions as tools per the Model Context
// Protocol (Anthropic, 2024) that OpenAI Deep Research adopted in 2026.
//
// SCOPE OF THIS SCAFFOLD (deliberately narrow):
//   · list_tools() returns the registered action summaries so an MCP
//     client can enumerate what NEX can do.
//   · call_tool() DELEGATES to the Action Brain facade, which routes
//     every call through the 7-stage authorize pipeline. No doctrine
//     escape hatch is possible.
//   · Full JSON-RPC / SSE transport is DEFERRED to a follow-on BEGIN
//     · this scaffold provides the shape a transport layer will wrap.
//
// Doctrine #2 anchor: even MCP clients cannot execute an action
// without NEX authorization. Every call materialises an audit row.

import type { ActionBrainFacade } from "./contract";
import type { AuthorizedActionRecord } from "@/lib/nex/live-chat-completion/actions/contract";

export interface McpToolSummary {
  name: string;
  description: string;
  requires_confirmation: boolean;
}

export interface McpCallInput {
  tool_name: string;
  arguments: Record<string, unknown>;
  /** Optional caller context (session/user) so authorize can bind properly. */
  session_id?: string | null;
  user_id?: string | null;
  language?: "en" | "id";
}

export interface McpCallOutput {
  ok: boolean;
  outcome: string;
  /** Full audit record for observability + audit trail. */
  audit: AuthorizedActionRecord | null;
  /** Present only when the underlying executor produced a result. */
  result?: unknown;
}

export interface McpServer {
  name: string;
  listTools(): Promise<McpToolSummary[]>;
  callTool(input: McpCallInput): Promise<McpCallOutput>;
}

export function makeMcpServer(actionBrain: ActionBrainFacade): McpServer {
  return {
    name: "nex-action-mcp-v1",

    async listTools(): Promise<McpToolSummary[]> {
      const actions = await actionBrain.listActions();
      return actions.map((a) => ({
        name: a.action_id,
        description: a.summary,
        requires_confirmation: a.requires_confirmation,
      }));
    },

    async callTool(input: McpCallInput): Promise<McpCallOutput> {
      const audit = await actionBrain.propose({
        action_id: input.tool_name,
        args: input.arguments ?? {},
        rationale: "mcp_tool_call",
        conversation_id: input.session_id ?? null,
        entity_ref: null,
        language: input.language ?? "en",
        user_id: input.user_id ?? null,
      });
      if (!audit) return { ok: false, outcome: "authorize_failed", audit: null };
      return {
        ok: audit.outcome === "executed",
        outcome: audit.outcome,
        audit,
        result: audit.result,
      };
    },
  };
}
