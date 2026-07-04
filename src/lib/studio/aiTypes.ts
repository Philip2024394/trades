// AI Gateway — request / response contract.
//
// Every Studio AI feature (Explain, Improve, Rewrite, Score, Suggest
// Alternative, Co-Pilot, Brand Extraction) calls the SAME endpoint:
// POST /api/ai/complete. Providers register behind the gateway; the
// gateway picks per-request based on task support, budget, and health.
//
// This file defines the wire shape. It never names a model, never
// mentions a provider. Zero preferred provider by design.

// ─── Task kinds ──────────────────────────────────────────────────
//
// Adding a new task kind is a code change (a caller needs to know when
// to fire it) not a schema change. Providers advertise which tasks they
// support via AiProvider.supports.

export type AiTaskKind =
  // Section-scoped
  | "section.explain"
  | "section.improve"
  | "section.rewrite"
  | "section.score"
  | "section.suggestAlternative"
  // Button-scoped — manifest-bound; providers can only patch fields
  // declared on the button's editableFields.
  | "button.improveCopy"
  | "button.restyle"
  | "button.suggestIcon"
  | "button.scoreConversion"
  // Page-scoped
  | "page.score"
  | "page.improve"
  | "page.recommend"
  // App-scoped
  //   app.recommend: given a merchant's natural-language description,
  //   return the top-N Apps from the registry that fit. Retrieval-first
  //   — provider MUST only reference slugs from the corpus supplied
  //   in payload.
  | "app.recommend"
  // Copy tasks
  | "copy.rewrite"
  | "copy.translate"
  // Media tasks
  | "media.generateImage"
  | "media.removeBackground"
  // Brand + design system
  | "brand.extract"
  | "design.suggestPalette"
  // Catch-all for provider-specific tasks callers agree on ad-hoc.
  | "custom";

// ─── Hints ───────────────────────────────────────────────────────

export type AiHints = {
  /** Voice for copy tasks — provider adapters map to their own tone
   *  primitives. */
  tone?: "trade-plain" | "reassuring" | "premium" | "friendly" | "urgent" | string;
  length?: "short" | "medium" | "long";
  /** Guarantee no structural rearrangement — Improve tasks must keep
   *  the section layout intact per the user's brief. */
  preserveLayout?: boolean;
  /** BCP-47 locale tag for translate / rewrite. */
  locale?: string;
  /** Anything else the caller wants to pass along; provider adapters
   *  decide how (or whether) to render into prompts. */
  extra?: Record<string, unknown>;
};

// ─── Budget ──────────────────────────────────────────────────────

export type AiBudget = {
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxCostUsd?: number;
  maxLatencyMs?: number;
};

// ─── Context ─────────────────────────────────────────────────────

export type AiContext = {
  merchantId?: string;
  brandId?: string;
  pageId?: string;
  instanceId?: string;
  /** Section-registry id (e.g. "hero.plant_hire_bold_1") — different
   *  from instanceId which is the layout-instance identity. */
  sectionId?: string;
  treeId?: string;
  /** Task-specific data. For section.rewrite we'd send the current
   *  copy fields as { copy: { heading, subheading, ctaLabel } }. */
  payload?: Record<string, unknown>;
};

// ─── Request / response ──────────────────────────────────────────

export type AiCompleteRequest = {
  task: AiTaskKind;
  context: AiContext;
  hints?: AiHints;
  stream?: boolean;
  budget?: AiBudget;
};

export type AiCompleteError = {
  code:
    | "not-implemented"
    | "no-provider"
    | "provider-unhealthy"
    | "budget-exceeded"
    | "invalid-request"
    | "internal";
  message: string;
  retryable: boolean;
};

export type AiCompleteMeta = {
  provider: string;
  model?: string;
  latencyMs: number;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
};

export type AiCompleteResponse =
  | { ok: true; result: unknown; meta: AiCompleteMeta }
  | { ok: false; error: AiCompleteError };

// ─── Provider interface ──────────────────────────────────────────

/** A registered provider. Adapters wrap Anthropic / OpenAI / Google /
 *  DeepSeek / any future model behind THIS interface. The gateway
 *  never binds to a provider name. */
export type AiProvider = {
  id: string;
  name: string;
  /** Task kinds this provider will accept. Others get filtered out at
   *  pick time. */
  supports: AiTaskKind[];
  /** Rough cost characteristics — router picks cheaper by default,
   *  faster when the request budget's maxLatencyMs is tight. */
  cost: { inputPerKtok: number; outputPerKtok: number };
  latencyP50Ms: number;
  complete(req: AiCompleteRequest): Promise<AiCompleteResponse>;
  isHealthy(): Promise<boolean>;
};
