// Nex tool contract. Every capability Nex gets = one file in
// src/lib/nex/tools/ exporting a NexTool. The registry auto-loads
// them and exposes only the ones allowed on the current surface.
//
// This mirrors the platform's manifest-first pattern (ADR-0001) so
// tools remain independently ownable + gate-able by tier.

import type { AnthropicToolDef } from "@/lib/llm/anthropic";

export type NexSurface = "merchant" | "homeowner" | "visitor";

/** Tier gates align with tierCatalog.ts. Tools marked with a
 *  requiredTier are hidden from surfaces where the caller can't
 *  afford them. Free-tier merchants see only free tools. */
export type NexTierGate = "free" | "starter" | "professional" | "business" | "works";

export type NexToolContext = {
  surface:     NexSurface;
  userKey:     string;
  slug?:       string;   // merchant slug OR visitor canteen slug
  homeownerId?: string;
};

export type NexToolResult = {
  ok:    boolean;
  data?: unknown;     // JSON-serialisable — this is what Claude sees
  error?: string;
  /** Optional structured artefact the widget can render as an
   *  editable card + Apply button. If unset, the tool just returns
   *  data for Claude to summarise in the final answer. */
  ui?: {
    kind:    "draft-review-reply" | "draft-yard-post" | "list" | "action";
    payload: Record<string, unknown>;
  };
};

export type NexTool = {
  name:        string;              // snake_case, becomes the tool name Claude sees
  description: string;              // 1-2 sentences — Claude uses this to pick tools
  input_schema: AnthropicToolDef["input_schema"];
  surfaces:    NexSurface[];
  requiredTier?: NexTierGate;      // gate at registry level
  handler:     (input: Record<string, unknown>, ctx: NexToolContext) => Promise<NexToolResult>;
};

/** Convert a NexTool to the wire format Claude expects. */
export function toAnthropicTool(t: NexTool): AnthropicToolDef {
  return {
    name:         t.name,
    description:  t.description,
    input_schema: t.input_schema
  };
}
