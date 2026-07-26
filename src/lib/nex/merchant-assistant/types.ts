// NEX Merchant Assistant — shared types.
//
// Kept minimal + serialisable so any surface can hold a reference
// without pulling in server-only internals.
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md
// Reference: docs/architecture/NEX_MASTER_DATA_FLOW_ARCHITECTURE.md

import "server-only";

export type ThreadStatus = "active" | "archived" | "closed";

export type BannerGenerator = "nex_ai" | "merchant_manual";

export type BannerVisualStyle =
  | "premium"
  | "utility"
  | "seasonal"
  | "minimal";

export type MerchantAssistantThread = {
  id: string;
  merchantId: string;
  title: string | null;
  status: ThreadStatus;
  createdAt: string;
  lastActivityAt: string;
};

/** Anthropic content-block shape, mirrored from src/lib/llm/anthropic.ts */
export type AssistantMessageContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export type MerchantAssistantMessage = {
  id: string;
  threadId: string;
  merchantId: string;
  role: "user" | "assistant" | "system";
  content: AssistantMessageContentBlock[];
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> | null;
  toolResults: Array<{ tool_use_id: string; content: string; is_error?: boolean }> | null;
  createdAt: string;
};

export type MerchantAssistantBanner = {
  id: string;
  merchantId: string;
  offerId: string;
  version: number;
  headline: string;
  body: string | null;
  cta: string | null;
  visualStyle: BannerVisualStyle | null;
  isActive: boolean;
  generatedBy: BannerGenerator;
  generatedAt: string;
  approvedAt: string | null;
};

/** Every tool executor returns this shape so the AI loop is
 *  guaranteed a stable contract regardless of which tool ran. */
export type ToolExecutionResult<TData = unknown> = {
  ok: boolean;
  data?: TData;
  error?: string;
  /** True if a guardrail blocked the operation — surfaced back to the
   *  merchant so they can rephrase or drop the offending claim. */
  guardrail_blocked?: boolean;
  guardrail_reason?: string;
};

/** Merchant identity as passed into tool executors. Every executor
 *  re-checks that the ownership implied by this context matches the
 *  record being modified. */
export type MerchantContext = {
  merchantId: string;
  slug: string | null;
  businessName: string | null;
  verificationLevel: "listed" | "claimed" | "verified" | "partner" | null;
  tier: string | null;
  tradeType: string | null;
};

/** Names for every tool the AI can call. Kept as a const so callers
 *  can switch exhaustively. Extending this list requires adding both
 *  the definition (tools.ts) and the executor (toolExecutors.ts). */
export const MERCHANT_ASSISTANT_TOOL_NAMES = [
  "list_products",
  "create_product_draft",
  "update_product_field",
  "generate_banner",
  "preview_change",
  "publish_product",
  "archive_product",
] as const;

export type MerchantAssistantToolName =
  (typeof MERCHANT_ASSISTANT_TOOL_NAMES)[number];
