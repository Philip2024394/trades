// src/lib/nex/action-brain/mcp-jsonrpc.ts
//
// Founder Path A · MCP-1 · JSON-RPC 2.0 transport for the MCP server.
//
// Wraps the in-process mcp-server.ts behind the JSON-RPC 2.0 wire
// protocol so external MCP clients can call NEX over HTTP. Every
// tools/call still routes through the Action Brain facade →
// Doctrine #2 (LLM never executes an action without NEX authorization)
// preserved by construction.
//
// Supported methods:
//   initialize      · client handshake · returns serverInfo + capabilities
//   tools/list      · returns registered actions in MCP tool shape
//   tools/call      · invokes a tool via authorize pipeline · returns result + audit
//   ping            · liveness probe
//
// JSON-RPC 2.0 error codes:
//   -32700 parse error         (caller-facing · content of the request)
//   -32600 invalid request     (missing jsonrpc/method)
//   -32601 method not found
//   -32602 invalid params
//   -32603 internal error
//   -32000..-32099 server error range (we use -32001 unauthorized, -32002 tool_error)

import type { McpServer } from "./mcp-server";

// ═══════════════════════════════════════════════════════════════════
// Types (JSON-RPC 2.0)
// ═══════════════════════════════════════════════════════════════════

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

// ═══════════════════════════════════════════════════════════════════
// Server info (MCP protocol handshake)
// ═══════════════════════════════════════════════════════════════════

export const NEX_MCP_SERVER_INFO = {
  name: "nex-mcp",
  version: "1.0.0",
  vendor: "nex",
  // MCP protocol version this server speaks (subset · initialize/tools/list/tools/call).
  protocolVersion: "2024-11-05",
  capabilities: {
    tools: { listChanged: false },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════
// Handler
// ═══════════════════════════════════════════════════════════════════

export interface HandleContext {
  session_id?: string | null;
  user_id?: string | null;
  language?: "en" | "id";
}

/**
 * Dispatch a single JSON-RPC request. Never throws · always returns a
 * response (success or error). Notifications (id undefined) return null
 * so the caller can skip serialising them.
 */
export async function handleMcpJsonRpc(
  request: unknown,
  server: McpServer,
  ctx: HandleContext = {},
): Promise<JsonRpcResponse | null> {
  // ── Shape validation ─────────────────────────────────────────────
  if (!request || typeof request !== "object") {
    return err(null, -32600, "invalid_request", "request must be a JSON-RPC object");
  }
  const req = request as Partial<JsonRpcRequest>;
  const id = (req.id === undefined) ? null : (req.id as string | number | null);
  const isNotification = req.id === undefined;

  if (req.jsonrpc !== "2.0") {
    return isNotification ? null : err(id, -32600, "invalid_request", "jsonrpc must be '2.0'");
  }
  if (typeof req.method !== "string" || !req.method) {
    return isNotification ? null : err(id, -32600, "invalid_request", "method must be a non-empty string");
  }

  const method = req.method;
  const params = req.params;

  // ── Dispatch ─────────────────────────────────────────────────────
  // JSON-RPC 2.0: notifications (no id) must NOT elicit any response.
  // We still execute side-effecting methods but discard the result.
  const respond = (r: JsonRpcResponse): JsonRpcResponse | null => isNotification ? null : r;
  try {
    switch (method) {
      case "initialize": {
        // Params: { protocolVersion?, capabilities?, clientInfo? } · echoed back partial.
        return respond(ok(id, {
          protocolVersion: NEX_MCP_SERVER_INFO.protocolVersion,
          capabilities: NEX_MCP_SERVER_INFO.capabilities,
          serverInfo: {
            name: NEX_MCP_SERVER_INFO.name,
            version: NEX_MCP_SERVER_INFO.version,
            vendor: NEX_MCP_SERVER_INFO.vendor,
          },
        }));
      }
      case "ping": {
        return respond(ok(id, { pong: true, server: NEX_MCP_SERVER_INFO.name }));
      }
      case "tools/list": {
        const tools = await server.listTools();
        return respond(ok(id, { tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          // NEX-specific extension · surfaces confirmation requirement.
          annotations: { requires_confirmation: t.requires_confirmation },
        })) }));
      }
      case "tools/call": {
        if (!params || typeof params !== "object") {
          return isNotification ? null : err(id, -32602, "invalid_params", "params object required");
        }
        const p = params as { name?: unknown; arguments?: unknown };
        if (typeof p.name !== "string" || p.name.length === 0) {
          return isNotification ? null : err(id, -32602, "invalid_params", "tools/call requires string 'name'");
        }
        const args = (p.arguments && typeof p.arguments === "object")
          ? p.arguments as Record<string, unknown>
          : {};
        const call = await server.callTool({
          tool_name: p.name,
          arguments: args,
          session_id: ctx.session_id ?? null,
          user_id: ctx.user_id ?? null,
          language: ctx.language ?? "en",
        });
        // Return MCP-shaped result · content array with tool payload.
        // Include the audit id so callers can trace the doctrine chain.
        return respond(ok(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: call.ok,
                outcome: call.outcome,
                audit_id: call.audit?.audit_id ?? null,
                result: call.result ?? null,
                requires_user_confirmation: call.audit?.requires_user_confirmation ?? false,
                confirmation_token: call.audit?.confirmation_token ?? null,
              }),
            },
          ],
          isError: !call.ok,
        }));
      }
      default:
        return respond(err(id, -32601, "method_not_found", `unknown method: ${method}`));
    }
  } catch (e) {
    return respond(err(id, -32603, "internal_error",
      e instanceof Error ? e.message.slice(0, 200) : "unknown"));
  }
}

/**
 * Batch support · JSON-RPC 2.0 allows an array of requests.
 * Returns an array of responses (notifications filtered out).
 */
export async function handleMcpJsonRpcBatch(
  requests: unknown[],
  server: McpServer,
  ctx: HandleContext = {},
): Promise<JsonRpcResponse[]> {
  const responses: JsonRpcResponse[] = [];
  for (const req of requests) {
    const r = await handleMcpJsonRpc(req, server, ctx);
    if (r) responses.push(r);
  }
  return responses;
}

// ═══════════════════════════════════════════════════════════════════
// Response builders
// ═══════════════════════════════════════════════════════════════════

function ok(id: JsonRpcSuccess["id"], result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}
function err(id: JsonRpcError["id"], code: number, message: string, data?: unknown): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}
