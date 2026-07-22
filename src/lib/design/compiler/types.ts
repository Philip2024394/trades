// Public types produced by the Prompt Compiler.
// Per V3 Q13.

export type PromptSection = {
  name:       string;    // "IDENTITY" | "VEHICLE" | "TRADE" | "LAYOUT" | ...
  content:    string;    // rendered section body
  version:    string;    // per-section version so we can trace changes
  source:     string;    // which module contributed this
  reason:     string;    // why this section exists (for Decision Engine)
};

export type ReferenceAsset = {
  kind:  "logo" | "portfolio-photo" | "van-photo" | "style-anchor";
  url:   string;
  role?: string;         // per V2 photo-tagging rule
};

export type PromptVersion = {
  compilerVersion: string;
  layoutVersion:   string;
  tradeVersion:    string;
  vehicleVersion:  string;
  brandVersion:    string;
  criticVersion:   string;
};

export type CompiledPrompt = {
  model:               "gpt-image-1" | "ideogram-v3" | "recraft-v3" | "flux-kontext";
  systemPrompt:        string;                      // model system role
  userPrompt:          string;                      // assembled prompt text
  sections:            PromptSection[];             // for debug/explainability
  negativeConstraints: string[];
  references:          ReferenceAsset[];
  qualityProfile:      "low" | "medium" | "high" | "hd";
  estimatedCostUsd:    number;
  estimatedTokens:     number;
  compilerVersion:     string;
  version:             PromptVersion;
  cacheKey:            string;                      // sha256 of the input IR
  explainability:      Array<{                      // metadata, NEVER sent to model
    section: string;
    source:  string;
    reason:  string;
    version: string;
  }>;
};
