// NEX Merchant Assistant — public barrel.
//
// Every consumer imports from this file, never from internal modules.
// This is the seam for future refactors — internals can move without
// breaking downstream call sites.
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md
// Reference: docs/architecture/NEX_MASTER_DATA_FLOW_ARCHITECTURE.md
//
// Phase 7 · Increment 1 exports: types, tool definitions, guardrails.
// Executors, prompt builder, banner generator, auto-marketing arrive
// in Increments 2-5.

export type {
  ThreadStatus,
  BannerGenerator,
  BannerVisualStyle,
  MerchantAssistantThread,
  MerchantAssistantMessage,
  MerchantAssistantBanner,
  AssistantMessageContentBlock,
  ToolExecutionResult,
  MerchantContext,
  MerchantAssistantToolName,
} from "./types";

export { MERCHANT_ASSISTANT_TOOL_NAMES } from "./types";

export {
  MERCHANT_ASSISTANT_TOOLS,
  LIST_PRODUCTS_TOOL,
  CREATE_PRODUCT_DRAFT_TOOL,
  UPDATE_PRODUCT_FIELD_TOOL,
  GENERATE_BANNER_TOOL,
  PREVIEW_CHANGE_TOOL,
  PUBLISH_PRODUCT_TOOL,
  ARCHIVE_PRODUCT_TOOL,
} from "./tools";

export { checkText, checkFields } from "./guardrails";
export type { GuardrailResult } from "./guardrails";
