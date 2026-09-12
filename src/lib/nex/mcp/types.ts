// src/lib/nex/mcp/types.ts
//
// WAVE-P-2 · GAP-1 · MODEL CONTEXT PROTOCOL types
// Founder BEGIN WAVE-P-2 · 2026-09-08
//
// MCP spec revision 2026-07-28. JSON-RPC 2.0 wire · direction rules:
// clients send requests+notifications · servers send responses+notifications.
// Servers do NOT initiate requests · clients do NOT send responses.
// Transports: stdio (local subprocess) + Streamable HTTP (remote SSE).
//
// This module implements the wire types and NEX-specific tool bridge.
// Provider-agnostic · transport-agnostic · protocol-first.

// ═══════════════════════════════════════════════════════════════════
// § A · JSON-RPC 2.0 CORE WIRE TYPES
// ═══════════════════════════════════════════════════════════════════

export type JsonRpcId = string | number;

export type JsonRpcRequest<TParams = unknown> = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: TParams;
};

export type JsonRpcNotification<TParams = unknown> = {
  jsonrpc: "2.0";
  method: string;
  params?: TParams;
  // notifications have NO id
};

export type JsonRpcSuccessResponse<TResult = unknown> = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: TResult;
};

export type JsonRpcErrorResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  error: JsonRpcErrorObject;
};

export type JsonRpcResponse<TResult = unknown> = JsonRpcSuccessResponse<TResult> | JsonRpcErrorResponse;

export type JsonRpcErrorObject = {
  code: number;
  message: string;
  data?: unknown;
};

/** Standard JSON-RPC error codes · with MCP-specific additions. */
export const JsonRpcErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-defined (server-defined range -32000 to -32099)
  SERVER_ERROR: -32000,
  TOOL_EXECUTION_ERROR: -32001,
  MANIFEST_VERIFICATION_FAILED: -32002,
  ALLOWLIST_REJECTED: -32003,
} as const;

// ═══════════════════════════════════════════════════════════════════
// § B · MCP TOOL SHAPES
// ═══════════════════════════════════════════════════════════════════

/** MCP tool descriptor · what a server publishes via tools/list. */
export type McpTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: readonly string[];
      items?: { type: string };
    }>;
    required?: readonly string[];
  };
};

/** Content block returned inside a tools/call result · MCP allows
 *  text · image · resource · resource_link · embedded_resource. */
export type McpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; resource: { uri: string; mimeType?: string; text?: string } };

/** tools/call response body per MCP spec. */
export type McpCallResult = {
  content: readonly McpContentBlock[];
  isError: boolean;
  /** Optional structured content (protocol extension · 2026-01+). */
  structuredContent?: unknown;
};

// ═══════════════════════════════════════════════════════════════════
// § C · MCP METHOD SIGNATURES (subset we implement in Wave-P-2)
// ═══════════════════════════════════════════════════════════════════

export type McpMethod =
  | "initialize"
  | "notifications/initialized"
  | "tools/list"
  | "tools/call"
  | "resources/list"
  | "resources/read"
  | "prompts/list"
  | "prompts/get"
  | "notifications/cancelled"
  | "notifications/tools/list_changed"
  | "ping";

/** initialize params · client hello. */
export type McpInitializeParams = {
  protocolVersion: string;                  // e.g. "2026-07-28"
  capabilities: {
    tools?: { listChanged?: boolean };
    resources?: { listChanged?: boolean };
    prompts?: { listChanged?: boolean };
    sampling?: {};
  };
  clientInfo: { name: string; version: string };
};

export type McpInitializeResult = {
  protocolVersion: string;
  capabilities: McpInitializeParams["capabilities"];
  serverInfo: { name: string; version: string };
};

// ═══════════════════════════════════════════════════════════════════
// § D · TRANSPORT ABSTRACTION
// ═══════════════════════════════════════════════════════════════════

/** Transport-agnostic message interface. Concrete transports (stdio
 *  · Streamable HTTP) plug in here. */
export interface McpTransport {
  /** Send a request · await the response. */
  request<TResult = unknown>(method: string, params?: unknown, timeout_ms?: number): Promise<TResult>;
  /** Send a notification · fire-and-forget. */
  notify(method: string, params?: unknown): Promise<void>;
  /** Register a request handler (for server side · handle incoming). */
  onRequest(method: string, handler: (params: unknown) => Promise<unknown>): void;
  /** Register a notification handler. */
  onNotification(method: string, handler: (params: unknown) => Promise<void>): void;
  /** Graceful close. */
  close(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════
// § E · NEX SPECIFIC: server manifest + allowlist
// ═══════════════════════════════════════════════════════════════════

/** Manifest describing a NEX-published or NEX-consumed MCP server ·
 *  used for auditability + signed-manifest verification (SELF-SUSTAINMENT
 *  DOCTRINE: NEX must know exactly what tools + what code it exposes /
 *  consumes). */
export type McpServerManifest = {
  server_name: string;
  server_version: string;
  transport_kind: "stdio" | "streamable_http";
  transport_uri?: string;                   // e.g. "https://mcp.example.com" for HTTP · path for stdio
  advertised_tools: readonly McpTool[];
  manifest_hash: string;                    // SHA-256 of canonical serialization
  signed_by?: string;                       // when signed: signer identity
  signature?: string;                       // hex signature (verified against pubkey)
  approved_by_founder_at_iso?: string;      // set only after Founder approval
  approval_scope: "read_only" | "read_write" | "denied";
};

/** Per-session allowlist · which servers + tools may be invoked. */
export type McpSessionAllowlist = {
  session_id: string;
  allowed_servers: readonly string[];       // server_name allowlist
  allowed_tools: readonly string[];         // "server_name.tool_name" allowlist
  allow_all_read_only: boolean;
  created_at_ms: number;
  expires_at_ms?: number;
};

// ═══════════════════════════════════════════════════════════════════
// § F · NEX ↔ MCP tool bridge output types
// ═══════════════════════════════════════════════════════════════════

/** NEX side of a bridged tool. Wraps NexTool contract to speak MCP. */
export type BridgedNexTool = {
  mcp_name: string;                          // possibly namespaced (e.g. "nex.staircase.updateDesign")
  nex_tool_name: string;                     // original NexTool.name
  mcp_descriptor: McpTool;
};
