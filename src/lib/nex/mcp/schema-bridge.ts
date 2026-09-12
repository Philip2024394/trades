// src/lib/nex/mcp/schema-bridge.ts
//
// WAVE-P-2 · NexTool ↔ MCP tool schema translation
// Founder BEGIN WAVE-P-2 · 2026-09-08
//
// Deterministic bidirectional bridge between NEX's NexTool + NexToolInputSchema
// and MCP's tool descriptor shape. Pure functions · no I/O.

import type { NexToolDef, NexToolInputSchema } from "@/lib/nex/brain/provider";
import type { McpTool, BridgedNexTool } from "./types";

// ─── NexTool → MCP ─────────────────────────────────────────────

/** Namespace a NexTool for MCP · prevents collision across NEX subsystems.
 *  Convention: `nex.<subsystem>.<toolName>` (e.g. `nex.staircase.updateDesign`). */
export function namespaceNexTool(subsystem: string, tool_name: string): string {
  if (!subsystem || !/^[a-z0-9_\-]+$/i.test(subsystem)) {
    throw new Error(`namespaceNexTool: invalid subsystem '${subsystem}'`);
  }
  if (!tool_name || !/^[a-zA-Z0-9_]+$/.test(tool_name)) {
    throw new Error(`namespaceNexTool: invalid tool_name '${tool_name}'`);
  }
  return `nex.${subsystem}.${tool_name}`;
}

/** Convert a NexTool into an MCP tool descriptor. Preserves schema
 *  shape exactly (both use JSON Schema-shaped input). */
export function nexToolToMcp(input: {
  nex_tool: NexToolDef;
  subsystem: string;
}): BridgedNexTool {
  const mcp_name = namespaceNexTool(input.subsystem, input.nex_tool.name);
  const descriptor: McpTool = {
    name: mcp_name,
    description: input.nex_tool.description,
    inputSchema: {
      type: "object",
      properties: mapProperties(input.nex_tool.inputSchema.properties),
      required: input.nex_tool.inputSchema.required ?? [],
    },
  };
  return {
    mcp_name,
    nex_tool_name: input.nex_tool.name,
    mcp_descriptor: descriptor,
  };
}

function mapProperties(
  props: NexToolInputSchema["properties"],
): McpTool["inputSchema"]["properties"] {
  const out: McpTool["inputSchema"]["properties"] = {};
  for (const [key, val] of Object.entries(props)) {
    out[key] = {
      type: val.type,
      description: val.description,
      enum: val.enum,
      items: val.items,
    };
  }
  return out;
}

// ─── MCP → NexTool ─────────────────────────────────────────────

/** Convert an MCP tool descriptor into a NexTool-shaped record (without
 *  a handler · handler is provided at consumption time by wrapping an
 *  MCP client call). Used when NEX consumes external MCP servers. */
export function mcpToolToNexShape(mcp: McpTool): {
  nex_shape: NexToolDef;
  mcp_original_name: string;
} {
  // If the MCP tool is namespaced (contains dots), strip the namespace
  // for the NEX-side handle · caller can re-namespace as needed.
  const short_name = normalizeNexToolName(mcp.name);
  const props: NexToolInputSchema["properties"] = {};
  for (const [key, val] of Object.entries(mcp.inputSchema.properties ?? {})) {
    props[key] = {
      type: (val.type ?? "string") as NexToolInputSchema["properties"][string]["type"],
      description: val.description,
      enum: val.enum,
      items: val.items,
    };
  }
  return {
    nex_shape: {
      name: short_name,
      description: mcp.description,
      inputSchema: {
        type: "object",
        properties: props,
        required: mcp.inputSchema.required ?? [],
      },
    },
    mcp_original_name: mcp.name,
  };
}

function normalizeNexToolName(mcp_name: string): string {
  // Convert dots to underscores · NEX tools accept [a-zA-Z0-9_]
  return mcp_name.replace(/\./g, "_").replace(/[^a-zA-Z0-9_]/g, "_");
}
