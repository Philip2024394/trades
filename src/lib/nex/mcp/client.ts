// src/lib/nex/mcp/client.ts
//
// WAVE-P-2 · Consume external MCP servers as NEX tools
// Founder BEGIN WAVE-P-2 · 2026-09-08
//
// This client TALKS to an external MCP server via a transport +
// discovers its tools via `tools/list` + invokes them via `tools/call`.
// The transport is pluggable · caller provides.

import type {
  McpTool,
  McpCallResult,
  McpTransport,
  McpInitializeParams,
  McpInitializeResult,
  McpServerManifest,
  McpSessionAllowlist,
} from "./types";
import { verifyManifest, checkAllowlist, isMcpStrictMode, computeManifestHash } from "./security";
import { mcpToolToNexShape } from "./schema-bridge";

// ═══════════════════════════════════════════════════════════════════
// § A · CLIENT
// ═══════════════════════════════════════════════════════════════════

export type McpClientConfig = {
  transport: McpTransport;
  client_name: string;
  client_version: string;
  supported_protocol_version: string;
  session_allowlist: McpSessionAllowlist;
  manifest?: McpServerManifest;  // when known · verified pre-connect
  strict_mode?: boolean;         // override env
};

export class McpClient {
  private initialized = false;
  private discovered_tools: McpTool[] = [];
  private server_info?: McpInitializeResult["serverInfo"];

  constructor(private readonly config: McpClientConfig) {}

  /** Initialize + verify manifest + discover tools. */
  async connect(): Promise<{ ok: true; tools: readonly McpTool[] } | { ok: false; reason: string }> {
    // 1 · verify manifest if provided
    if (this.config.manifest) {
      const strict = this.config.strict_mode ?? isMcpStrictMode();
      const v = verifyManifest({ manifest: this.config.manifest, strict });
      if (!v.ok) return { ok: false, reason: `manifest verification failed: ${v.reason}` };
    } else if (this.config.strict_mode ?? isMcpStrictMode()) {
      return { ok: false, reason: `strict mode: no manifest supplied · refusing to connect to unknown server` };
    }

    // 2 · initialize
    const initParams: McpInitializeParams = {
      protocolVersion: this.config.supported_protocol_version,
      capabilities: { tools: {} },
      clientInfo: { name: this.config.client_name, version: this.config.client_version },
    };
    let initResult: McpInitializeResult;
    try {
      initResult = await this.config.transport.request<McpInitializeResult>("initialize", initParams, 30_000);
    } catch (err) {
      return { ok: false, reason: `initialize failed: ${err instanceof Error ? err.message : String(err)}` };
    }
    this.server_info = initResult.serverInfo;
    await this.config.transport.notify("notifications/initialized", {});

    // 3 · discover tools
    try {
      const listResult = await this.config.transport.request<{ tools: McpTool[] }>("tools/list", {}, 15_000);
      this.discovered_tools = listResult.tools ?? [];
    } catch (err) {
      return { ok: false, reason: `tools/list failed: ${err instanceof Error ? err.message : String(err)}` };
    }

    // 4 · if manifest included · verify advertised tools match discovered tools
    if (this.config.manifest) {
      const advertisedNames = new Set(this.config.manifest.advertised_tools.map((t) => t.name));
      const discoveredNames = new Set(this.discovered_tools.map((t) => t.name));
      for (const name of discoveredNames) {
        if (!advertisedNames.has(name)) {
          return { ok: false, reason: `server exposes tool '${name}' not in signed manifest · REFUSED` };
        }
      }
    }

    this.initialized = true;
    return { ok: true, tools: this.discovered_tools };
  }

  /** Call a tool by name. Enforces session allowlist BEFORE dispatch. */
  async callTool(input: {
    tool_name: string;
    arguments: Record<string, unknown>;
    tool_is_read_only?: boolean;
  }): Promise<McpCallResult> {
    if (!this.initialized) {
      return { content: [{ type: "text", text: "client not initialized · call connect() first" }], isError: true };
    }

    // Allowlist gate
    const server_name = this.config.manifest?.server_name ?? (this.server_info?.name ?? "unknown");
    const tool_full_name = `${server_name}.${input.tool_name}`;
    const gate = checkAllowlist({
      allowlist: this.config.session_allowlist,
      server_name,
      tool_full_name,
      tool_is_read_only: input.tool_is_read_only ?? false,
    });
    if (!gate.allowed) {
      return { content: [{ type: "text", text: `allowlist refused: ${gate.reason}` }], isError: true };
    }

    // Discovered-tool check
    if (!this.discovered_tools.some((t) => t.name === input.tool_name)) {
      return { content: [{ type: "text", text: `tool '${input.tool_name}' not discovered on this server` }], isError: true };
    }

    // Dispatch
    try {
      const r = await this.config.transport.request<McpCallResult>("tools/call", {
        name: input.tool_name,
        arguments: input.arguments,
      }, 60_000);
      return r;
    } catch (err) {
      return {
        content: [{ type: "text", text: `tools/call transport error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }

  discoveredTools(): readonly McpTool[] {
    return this.discovered_tools;
  }

  /** Bridge discovered MCP tools to NEX tool shapes (without handlers ·
   *  caller wraps callTool for each). */
  toNexShapes(): readonly ReturnType<typeof mcpToolToNexShape>[] {
    return this.discovered_tools.map(mcpToolToNexShape);
  }

  async close(): Promise<void> {
    await this.config.transport.close();
  }
}
