// Mate tool registry. Static import list — one line per tool file.
// Add a new tool = add its import + push it into TOOLS. That's it.
//
// The registry filters by surface at call time, so Claude only ever
// sees the tools legitimate for the current caller. Tier gating
// happens the same way (free-tier merchants don't see Pro tools).

import type { MateTool, MateSurface, MateTierGate } from "./types";
import { getExtraAnalyticsTool } from "./get_extra_analytics";
import { draftReviewReplyTool } from "./draft_review_reply";
import { findLocalTradeTool } from "./find_local_trade";

const TOOLS: MateTool[] = [
  getExtraAnalyticsTool,
  draftReviewReplyTool,
  findLocalTradeTool
];

const TIER_ORDER: MateTierGate[] = ["free", "starter", "professional", "business", "works"];

function tierMeets(userTier: MateTierGate | null | undefined, required: MateTierGate | undefined): boolean {
  if (!required) return true;
  const have = TIER_ORDER.indexOf(userTier ?? "free");
  const need = TIER_ORDER.indexOf(required);
  return have >= need;
}

/** Tools visible to Claude for this surface + tier. */
export function toolsForSurface(surface: MateSurface, userTier?: MateTierGate | null): MateTool[] {
  return TOOLS.filter((t) => t.surfaces.includes(surface) && tierMeets(userTier, t.requiredTier));
}

/** Look up a tool by name — used by the runtime to dispatch tool_use blocks. */
export function toolByName(name: string): MateTool | undefined {
  return TOOLS.find((t) => t.name === name);
}
