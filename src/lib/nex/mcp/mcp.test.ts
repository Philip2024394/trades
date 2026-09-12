// src/lib/nex/mcp/mcp.test.ts
//
// WAVE-P-2 · MCP contract tests
// Founder BEGIN WAVE-P-2 · 2026-09-08

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JsonRpcErrorCode } from "./types";
import type { McpTool, McpTransport, McpServerManifest, McpSessionAllowlist } from "./types";
import { namespaceNexTool, nexToolToMcp, mcpToolToNexShape } from "./schema-bridge";
import { createMcpServerDispatcher } from "./server";
import { McpClient } from "./client";
import {
  canonicalManifestBytes,
  computeManifestHash,
  verifyManifest,
  checkAllowlist,
  isMcpStrictMode,
  markManifestApproved,
} from "./security";
import type { NexTool } from "@/lib/nex/tools/types";

// ─── Helpers ───────────────────────────────────────────────

function makeNexTool(name: string): NexTool {
  return {
    name,
    description: `test tool ${name}`,
    input_schema: {
      type: "object",
      properties: { x: { type: "string", description: "input" } },
      required: ["x"],
    },
    surfaces: ["visitor"],
    handler: async (args: Record<string, unknown>) => ({ ok: true, data: { echoed: args.x } }),
  };
}

/** In-process transport for tests · client ↔ server in same JS context. */
function makeLoopbackTransport(dispatcher: ReturnType<typeof createMcpServerDispatcher>): McpTransport {
  const notifHandlers = new Map<string, (params: unknown) => Promise<void>>();
  return {
    async request(method: string, params: unknown, _timeout_ms?: number) {
      const r = await dispatcher.handleRequest(method, params);
      if (r.ok) return r.result;
      throw new Error(`RPC error ${r.error.code}: ${r.error.message}`);
    },
    async notify(method: string, params: unknown) {
      const h = notifHandlers.get(method);
      if (h) await h(params);
    },
    onRequest() { /* server side · not used by loopback */ },
    onNotification(method, handler) { notifHandlers.set(method, handler); },
    async close() { /* nothing to close */ },
  };
}

// ═══════════════════════════════════════════════════════════════════
// § SCHEMA BRIDGE
// ═══════════════════════════════════════════════════════════════════

describe("§P2-BRIDGE · NexTool ↔ MCP", () => {
  it("namespaceNexTool produces `nex.<subsystem>.<tool>`", () => {
    expect(namespaceNexTool("staircase", "updateDesign")).toBe("nex.staircase.updateDesign");
  });

  it("namespaceNexTool refuses invalid inputs", () => {
    expect(() => namespaceNexTool("bad space", "x")).toThrow();
    expect(() => namespaceNexTool("ok", "bad-name")).toThrow();
  });

  it("nexToolToMcp preserves description + schema", () => {
    const b = nexToolToMcp({
      nex_tool: {
        name: "do_thing",
        description: "test tool do_thing",
        inputSchema: { type: "object", properties: { x: { type: "string", description: "input" } }, required: ["x"] },
      },
      subsystem: "test",
    });
    expect(b.mcp_name).toBe("nex.test.do_thing");
    expect(b.mcp_descriptor.description).toContain("do_thing");
    expect(b.mcp_descriptor.inputSchema.required).toEqual(["x"]);
  });

  it("mcpToolToNexShape round-trips schema · normalizes dotted names", () => {
    const mcp: McpTool = {
      name: "nex.test.do_thing",
      description: "d",
      inputSchema: { type: "object", properties: { x: { type: "string" } }, required: ["x"] },
    };
    const shape = mcpToolToNexShape(mcp);
    expect(shape.nex_shape.name).toBe("nex_test_do_thing");
    expect(shape.mcp_original_name).toBe("nex.test.do_thing");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § SERVER DISPATCH
// ═══════════════════════════════════════════════════════════════════

describe("§P2-SERVER · dispatcher method routing", () => {
  const dispatcher = createMcpServerDispatcher({
    server_name: "nex-test-server",
    server_version: "v1",
    supported_protocol_version: "2026-07-28",
    subsystems: {
      test: [makeNexTool("echo"), makeNexTool("reverse")],
    },
  });

  it("initialize returns serverInfo + capabilities + protocolVersion", async () => {
    const r = await dispatcher.handleRequest("initialize", {
      protocolVersion: "2026-07-28",
      capabilities: { tools: {} },
      clientInfo: { name: "test", version: "v1" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const res = r.result as { serverInfo: { name: string; version: string }; protocolVersion: string };
      expect(res.serverInfo.name).toBe("nex-test-server");
      expect(res.protocolVersion).toBe("2026-07-28");
    }
  });

  it("initialize refuses missing protocolVersion", async () => {
    const r = await dispatcher.handleRequest("initialize", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(JsonRpcErrorCode.INVALID_PARAMS);
  });

  it("tools/list returns all namespaced tools", async () => {
    const r = await dispatcher.handleRequest("tools/list", {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      const res = r.result as { tools: McpTool[] };
      expect(res.tools.length).toBe(2);
      expect(res.tools.map((t) => t.name).sort()).toEqual(["nex.test.echo", "nex.test.reverse"]);
    }
  });

  it("tools/call dispatches to correct handler · content is text block", async () => {
    const r = await dispatcher.handleRequest("tools/call", { name: "nex.test.echo", arguments: { x: "hello" } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const res = r.result as { content: { type: string; text: string }[]; isError: boolean };
      expect(res.isError).toBe(false);
      expect(res.content[0].type).toBe("text");
      expect(res.content[0].text).toContain("hello");
    }
  });

  it("tools/call unknown tool returns METHOD_NOT_FOUND", async () => {
    const r = await dispatcher.handleRequest("tools/call", { name: "nex.test.nope", arguments: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(JsonRpcErrorCode.METHOD_NOT_FOUND);
  });

  it("tools/call handler throw → isError:true (NOT JSON-RPC error)", async () => {
    const bomb: NexTool = {
      name: "bomb",
      description: "bomb",
      input_schema: { type: "object", properties: {} },
      surfaces: ["visitor"],
      handler: async () => { throw new Error("kaboom"); },
    };
    const d2 = createMcpServerDispatcher({
      server_name: "s", server_version: "v", supported_protocol_version: "2026-07-28",
      subsystems: { x: [bomb] },
    });
    const r = await d2.handleRequest("tools/call", { name: "nex.x.bomb", arguments: {} });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const res = r.result as { isError: boolean; content: { text: string }[] };
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("kaboom");
    }
  });

  it("unknown method returns METHOD_NOT_FOUND", async () => {
    const r = await dispatcher.handleRequest("unknown/method", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(JsonRpcErrorCode.METHOD_NOT_FOUND);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § SECURITY · manifests + allowlist
// ═══════════════════════════════════════════════════════════════════

describe("§P2-SECURITY · manifest verification", () => {
  const baseManifest: Omit<McpServerManifest, "manifest_hash" | "signature" | "approved_by_founder_at_iso"> = {
    server_name: "test-server",
    server_version: "1.0",
    transport_kind: "stdio",
    transport_uri: "test",
    advertised_tools: [{ name: "t1", description: "d", inputSchema: { type: "object", properties: {} } }],
    approval_scope: "read_only",
  };

  it("computeManifestHash is deterministic + stable", () => {
    const h1 = computeManifestHash(baseManifest);
    const h2 = computeManifestHash(baseManifest);
    expect(h1).toBe(h2);
  });

  it("canonicalManifestBytes sorts keys for stability", () => {
    const b1 = canonicalManifestBytes(baseManifest);
    const b2 = canonicalManifestBytes({ ...baseManifest, transport_uri: "test" });
    expect(b1).toBe(b2);
  });

  it("verifyManifest catches hash mismatch", () => {
    const m: McpServerManifest = { ...baseManifest, manifest_hash: "fake_hash", approval_scope: "read_only" };
    const r = verifyManifest({ manifest: m });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("hash mismatch");
  });

  it("verifyManifest ok when hash correct + not strict", () => {
    const hash = computeManifestHash(baseManifest);
    const m: McpServerManifest = { ...baseManifest, manifest_hash: hash };
    expect(verifyManifest({ manifest: m }).ok).toBe(true);
  });

  it("verifyManifest strict mode requires signature + approval", () => {
    const hash = computeManifestHash(baseManifest);
    const unsigned: McpServerManifest = { ...baseManifest, manifest_hash: hash };
    expect(verifyManifest({ manifest: unsigned, strict: true }).ok).toBe(false);
    const signed = { ...unsigned, signed_by: "author", signature: "sig" };
    expect(verifyManifest({ manifest: signed, strict: true }).ok).toBe(false); // still missing approval
    const approved = markManifestApproved({ manifest: signed, approval_scope: "read_only" });
    expect(verifyManifest({ manifest: approved, strict: true }).ok).toBe(true);
  });

  it("verifyManifest refuses denied scope regardless of signature", () => {
    const hash = computeManifestHash({ ...baseManifest, approval_scope: "denied" });
    const denied: McpServerManifest = { ...baseManifest, approval_scope: "denied", manifest_hash: hash };
    expect(verifyManifest({ manifest: denied }).ok).toBe(false);
  });

  it("isMcpStrictMode defaults to TRUE (refuse-first)", () => {
    const prior = process.env.NEX_MCP_STRICT;
    delete process.env.NEX_MCP_STRICT;
    expect(isMcpStrictMode()).toBe(true);
    process.env.NEX_MCP_STRICT = "false";
    expect(isMcpStrictMode()).toBe(false);
    if (prior === undefined) delete process.env.NEX_MCP_STRICT;
    else process.env.NEX_MCP_STRICT = prior;
  });
});

describe("§P2-SECURITY · session allowlist", () => {
  const now = 2_000_000_000_000;
  const allowlist: McpSessionAllowlist = {
    session_id: "s1",
    allowed_servers: ["good-server"],
    allowed_tools: ["good-server.tool_a"],
    allow_all_read_only: false,
    created_at_ms: now,
  };

  it("denies unknown server", () => {
    const r = checkAllowlist({ allowlist, server_name: "bad-server", tool_full_name: "bad-server.x", tool_is_read_only: true });
    expect(r.allowed).toBe(false);
  });

  it("denies unknown tool on known server", () => {
    const r = checkAllowlist({ allowlist, server_name: "good-server", tool_full_name: "good-server.other_tool", tool_is_read_only: false });
    expect(r.allowed).toBe(false);
  });

  it("allows known tool on known server", () => {
    const r = checkAllowlist({ allowlist, server_name: "good-server", tool_full_name: "good-server.tool_a", tool_is_read_only: false });
    expect(r.allowed).toBe(true);
  });

  it("allow_all_read_only bypasses tool list for read-only tools", () => {
    const wide: McpSessionAllowlist = { ...allowlist, allow_all_read_only: true };
    const r = checkAllowlist({ allowlist: wide, server_name: "any", tool_full_name: "any.read", tool_is_read_only: true });
    expect(r.allowed).toBe(true);
  });

  it("expired session refused", () => {
    const expired = { ...allowlist, expires_at_ms: now };
    const r = checkAllowlist({ allowlist: expired, server_name: "good-server", tool_full_name: "good-server.tool_a", tool_is_read_only: true, now_ms: now + 1 });
    expect(r.allowed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § CLIENT · end-to-end loopback
// ═══════════════════════════════════════════════════════════════════

describe("§P2-CLIENT · loopback client ↔ server", () => {
  it("connect + tools/list + tools/call round-trip", async () => {
    const dispatcher = createMcpServerDispatcher({
      server_name: "loopback",
      server_version: "1.0",
      supported_protocol_version: "2026-07-28",
      subsystems: { test: [makeNexTool("echo")] },
    });
    const transport = makeLoopbackTransport(dispatcher);
    const allowlist: McpSessionAllowlist = {
      session_id: "s", allowed_servers: ["loopback"], allowed_tools: ["loopback.nex.test.echo"],
      allow_all_read_only: false, created_at_ms: Date.now(),
    };
    const client = new McpClient({
      transport, client_name: "nex-test-client", client_version: "1.0",
      supported_protocol_version: "2026-07-28", session_allowlist: allowlist, strict_mode: false,
    });
    const conn = await client.connect();
    expect(conn.ok).toBe(true);
    if (conn.ok) expect(conn.tools.length).toBe(1);
    const call = await client.callTool({ tool_name: "nex.test.echo", arguments: { x: "world" } });
    expect(call.isError).toBe(false);
    expect(call.content[0]).toMatchObject({ type: "text" });
  });

  it("strict mode + no manifest → connect refused", async () => {
    const dispatcher = createMcpServerDispatcher({
      server_name: "sv", server_version: "1", supported_protocol_version: "2026-07-28",
      subsystems: { t: [makeNexTool("e")] },
    });
    const transport = makeLoopbackTransport(dispatcher);
    const allowlist: McpSessionAllowlist = { session_id: "s", allowed_servers: [], allowed_tools: [], allow_all_read_only: false, created_at_ms: Date.now() };
    const client = new McpClient({
      transport, client_name: "c", client_version: "1",
      supported_protocol_version: "2026-07-28", session_allowlist: allowlist, strict_mode: true,
    });
    const conn = await client.connect();
    expect(conn.ok).toBe(false);
  });

  it("allowlist rejects tool call not in list", async () => {
    const dispatcher = createMcpServerDispatcher({
      server_name: "sv", server_version: "1", supported_protocol_version: "2026-07-28",
      subsystems: { t: [makeNexTool("allowed"), makeNexTool("blocked")] },
    });
    const transport = makeLoopbackTransport(dispatcher);
    const allowlist: McpSessionAllowlist = {
      session_id: "s", allowed_servers: ["sv"],
      allowed_tools: ["sv.nex.t.allowed"], // only 'allowed'
      allow_all_read_only: false, created_at_ms: Date.now(),
    };
    const client = new McpClient({
      transport, client_name: "c", client_version: "1",
      supported_protocol_version: "2026-07-28", session_allowlist: allowlist, strict_mode: false,
    });
    await client.connect();
    const call = await client.callTool({ tool_name: "nex.t.blocked", arguments: {} });
    expect(call.isError).toBe(true);
    expect(call.content[0].type === "text" && call.content[0].text.includes("allowlist")).toBe(true);
  });
});
