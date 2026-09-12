// src/lib/nex/mcp/server.ts
//
// WAVE-P-2 · Publish NEX tools as an MCP server
// Founder BEGIN WAVE-P-2 · 2026-09-08
//
// This module exposes a set of NexTool objects via the MCP protocol.
// It is TRANSPORT-AGNOSTIC · the transport (stdio or Streamable HTTP)
// is plugged in by the caller. This file handles the JSON-RPC method
// dispatch + tools/list + tools/call semantics.

import type {
  JsonRpcErrorObject,
  McpTool,
  McpCallResult,
  McpContentBlock,
  McpInitializeParams,
  McpInitializeResult,
  BridgedNexTool,
} from "./types";
import { JsonRpcErrorCode } from "./types";
import type { NexTool, NexToolContext, NexToolResult } from "@/lib/nex/tools/types";
import { namespaceNexTool } from "./schema-bridge";

// ═══════════════════════════════════════════════════════════════════
// § A · SERVER CONFIG
// ═══════════════════════════════════════════════════════════════════

export type McpServerConfig = {
  server_name: string;
  server_version: string;
  supported_protocol_version: string; // e.g. "2026-07-28"
  /** NEX subsystems + their tools · flattened into namespaced MCP tools. */
  subsystems: Record<string, readonly NexTool[]>;
  /** Context passed to every NexTool handler invocation via MCP. Must be
   *  supplied by caller · default matches "external MCP client" surface. */
  invocation_context?: NexToolContext;
};

export type McpMethodDispatcher = {
  handleRequest(method: string, params: unknown): Promise<{ ok: true; result: unknown } | { ok: false; error: JsonRpcErrorObject }>;
  listTools(): readonly BridgedNexTool[];
};

// ═══════════════════════════════════════════════════════════════════
// § B · Create dispatcher
// ═══════════════════════════════════════════════════════════════════

export function createMcpServerDispatcher(config: McpServerConfig): McpMethodDispatcher {
  // Flatten and namespace · adapt NexTool (snake_case input_schema) to MCP
  const bridged: BridgedNexTool[] = [];
  const nexToolByMcpName = new Map<string, NexTool>();
  const ctx: NexToolContext = config.invocation_context ?? {
    surface: "visitor",
    userKey: "mcp_external",
  };

  for (const [subsystem, tools] of Object.entries(config.subsystems)) {
    for (const nex of tools) {
      const mcp_name = namespaceNexTool(subsystem, nex.name);
      const descriptor: McpTool = {
        name: mcp_name,
        description: nex.description,
        inputSchema: {
          type: "object",
          properties: (nex.input_schema?.properties ?? {}) as McpTool["inputSchema"]["properties"],
          required: (nex.input_schema?.required ?? []) as readonly string[],
        },
      };
      bridged.push({ mcp_name, nex_tool_name: nex.name, mcp_descriptor: descriptor });
      nexToolByMcpName.set(mcp_name, nex);
    }
  }
  Object.freeze(bridged);

  return {
    listTools() {
      return bridged;
    },
    async handleRequest(method, params) {
      switch (method) {
        case "initialize": {
          const p = params as McpInitializeParams | undefined;
          if (!p || typeof p.protocolVersion !== "string") {
            return err(JsonRpcErrorCode.INVALID_PARAMS, "initialize requires protocolVersion");
          }
          const result: McpInitializeResult = {
            protocolVersion: config.supported_protocol_version,
            capabilities: { tools: { listChanged: true } },
            serverInfo: { name: config.server_name, version: config.server_version },
          };
          return { ok: true, result };
        }

        case "notifications/initialized": {
          // Notifications don't produce a result · dispatcher returns null
          return { ok: true, result: null };
        }

        case "ping": {
          return { ok: true, result: {} };
        }

        case "tools/list": {
          const tools: McpTool[] = bridged.map((b) => b.mcp_descriptor);
          return { ok: true, result: { tools } };
        }

        case "tools/call": {
          const p = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
          if (!p || typeof p.name !== "string") {
            return err(JsonRpcErrorCode.INVALID_PARAMS, "tools/call requires name");
          }
          const nex = nexToolByMcpName.get(p.name);
          if (!nex) {
            return err(JsonRpcErrorCode.METHOD_NOT_FOUND, `unknown tool: ${p.name}`);
          }
          try {
            const handlerResult: NexToolResult = await nex.handler(p.arguments ?? {}, ctx);
            const isError = handlerResult.ok === false;
            const contentSource = handlerResult.ok ? (handlerResult.data ?? null) : (handlerResult.error ?? "tool_error");
            const result: McpCallResult = {
              content: coerceToMcpContent(contentSource),
              isError,
            };
            return { ok: true, result };
          } catch (execErr) {
            const errText = execErr instanceof Error ? execErr.message : String(execErr);
            const result: McpCallResult = {
              content: [{ type: "text", text: `Tool execution error: ${errText}` }],
              isError: true,
            };
            return { ok: true, result };  // tool errors ride in result · not JSON-RPC error
          }
        }

        default:
          return err(JsonRpcErrorCode.METHOD_NOT_FOUND, `method not found: ${method}`);
      }
    },
  };
}

function err(code: number, message: string, data?: unknown): { ok: false; error: JsonRpcErrorObject } {
  return { ok: false, error: { code, message, data } };
}

/** Coerce a handler return value into MCP content blocks.
 *  · string → single text block
 *  · array of {text} → text blocks
 *  · object → JSON-serialized text block
 *  · other primitives → String() wrapped
 */
function coerceToMcpContent(raw: unknown): readonly McpContentBlock[] {
  if (raw === undefined || raw === null) return [{ type: "text", text: "" }];
  if (typeof raw === "string") return [{ type: "text", text: raw }];
  if (typeof raw === "number" || typeof raw === "boolean") return [{ type: "text", text: String(raw) }];
  if (Array.isArray(raw)) {
    if (raw.length > 0 && raw.every((x) => typeof x === "object" && x !== null && "text" in (x as object))) {
      return raw as unknown as McpContentBlock[];
    }
    return [{ type: "text", text: JSON.stringify(raw) }];
  }
  if (typeof raw === "object") return [{ type: "text", text: JSON.stringify(raw) }];
  return [{ type: "text", text: String(raw) }];
}
