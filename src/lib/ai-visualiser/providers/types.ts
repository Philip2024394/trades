// Provider abstraction. All image work — classification + generation —
// happens through this interface so the render pipeline never cares
// whether the current row in ai_visualiser_provider_config is OpenAI,
// Flux, Nano Banana, or anything future.

export type ProviderClassifyInput = {
  imageUrl: string;
  candidatePrompts: Array<{ leafSlug: string; prompt: string }>;
};

export type ProviderClassifyResult = {
  bestLeafSlug: string | null;
  bestPrompt: string | null;
  confidence: number; // 0..1
  scores: Array<{ leafSlug: string; score: number }>;
};

export type ProviderGenerateInput = {
  sourceImageUrl: string;
  prompt: string;
  aspectRatio?: "1:1" | "3:2" | "16:9";
  strength?: number; // 0..1 — how much to depart from the source
};

export type ProviderGenerateResult = {
  imageUrl: string;
  providerRequestId?: string;
  costPence: number;
};

export type AiVisualiserProvider = {
  id: string;
  displayName: string;
  classify(input: ProviderClassifyInput): Promise<ProviderClassifyResult>;
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult>;
  test(): Promise<{ ok: true } | { ok: false; error: string }>;
};

export type ProviderCredentials = {
  api_key?: string;
  api_base?: string;
  model_id?: string;
};
