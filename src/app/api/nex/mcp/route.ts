// src/app/api/nex/mcp/route.ts
//
// Founder Path A · MCP-2 · HTTP JSON-RPC 2.0 endpoint for the MCP server.
//
// External MCP-speaking clients POST JSON-RPC 2.0 requests here.
// Every tools/call routes through the Action Brain facade so
// Doctrine #2 (LLM never executes an action without NEX authorization)
// is preserved uniformly with the in-process path.
//
// Supported methods: initialize · ping · tools/list · tools/call.
// Batch requests (JSON array) are supported per JSON-RPC 2.0.
//
// Content-type MUST be application/json. Unknown content-types → 415.
// Malformed body → JSON-RPC parse error (-32700) with id=null.

import { NextResponse } from "next/server";
import { makeActionBrain } from "@/lib/nex/action-brain";
import { makeMcpServer } from "@/lib/nex/action-brain/mcp-server";
import {
  handleMcpJsonRpc, handleMcpJsonRpcBatch, NEX_MCP_SERVER_INFO,
  type JsonRpcResponse,
} from "@/lib/nex/action-brain/mcp-jsonrpc";

const _actionBrain = makeActionBrain();
const _mcp = makeMcpServer(_actionBrain);

export const runtime = "nodejs";

function versionHeaders(): Record<string, string> {
  return {
    "NEX-MCP-Server": NEX_MCP_SERVER_INFO.name,
    "NEX-MCP-Version": NEX_MCP_SERVER_INFO.version,
    "NEX-MCP-Protocol": NEX_MCP_SERVER_INFO.protocolVersion,
  };
}

/** Simple discovery GET · returns serverInfo so ops can probe the endpoint. */
export async function GET() {
  return NextResponse.json({
    server: NEX_MCP_SERVER_INFO,
    endpoint: "/api/nex/mcp",
    supported_methods: ["initialize", "ping", "tools/list", "tools/call"],
    transport: "http-jsonrpc-2.0",
  }, { headers: versionHeaders() });
}

export async function POST(req: Request) {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("application/json")) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "content_type_must_be_application_json" } },
      { status: 415, headers: versionHeaders() },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse_error" } },
      { status: 200, headers: versionHeaders() },
    );
  }

  // Extract caller context from headers so tools bind properly.
  const ctx = {
    session_id: req.headers.get("x-nex-session-id"),
    user_id: req.headers.get("x-nex-user-id"),
    language: (req.headers.get("x-nex-language") === "id" ? "id" : "en") as "en" | "id",
  };

  // Batch or single.
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return NextResponse.json(
        { jsonrpc: "2.0", id: null, error: { code: -32600, message: "empty_batch" } },
        { status: 200, headers: versionHeaders() },
      );
    }
    const responses: JsonRpcResponse[] = await handleMcpJsonRpcBatch(raw, _mcp, ctx);
    return NextResponse.json(responses, { headers: versionHeaders() });
  }

  const response = await handleMcpJsonRpc(raw, _mcp, ctx);
  if (!response) {
    // Notification (no id) · JSON-RPC 2.0 says server MUST NOT reply.
    return new NextResponse(null, { status: 204, headers: versionHeaders() });
  }
  return NextResponse.json(response, { headers: versionHeaders() });
}
