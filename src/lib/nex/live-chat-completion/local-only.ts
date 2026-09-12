// src/lib/nex/live-chat-completion/local-only.ts
//
// Founder AIW-1 · NEX AI-WiFi · NEX_LOCAL_ONLY=1 sentinel.
//
// When NEX_LOCAL_ONLY=1 is set, this module fills provider selectors
// with LOCAL defaults so NEX runs entirely on:
//   · Ollama (LLM + vision + embeddings)
//   · DuckDuckGo Instant Answer + Wikipedia REST + friends (data-only)
//   · Postgres (state)
//   · tesseract.js (OCR · in-process WASM)
//
// Non-destructive: only fills MISSING env values (`??=`). Existing
// settings win. This preserves the regression matrix (which uses
// `mock` providers) and makes local-only opt-in per Founder decision.
//
// Doctrine preservation: this module does NOT weaken any of the four
// Founder Doctrines. Provider swap is provider-agnostic — Gate v2,
// authorize pipeline, evidence_provisional cap, and memory-not-truth
// all continue to enforce regardless of which provider is selected.

export interface LocalOnlyResolution {
  applied: boolean;
  reason: string;
  resolved: {
    NEX_LLM_RESCUE_PROVIDER?: string;
    NEX_VISION_PROVIDER?: string;
    NEX_WEB_ACQUISITION_PROVIDER?: string;
    NEX_EMBEDDING_PROVIDER?: string;
    NEX_FILE_PROVIDER?: string;
    LLM_ALLOW_MOCK_FALLBACK?: string;
  };
}

/**
 * Apply local-only defaults iff NEX_LOCAL_ONLY=1. Idempotent · safe
 * to call multiple times. Returns a report of what was resolved so
 * smokes and Observatory can verify the mode is live.
 */
export function applyLocalOnlyModeIfSet(): LocalOnlyResolution {
  const flag = process.env.NEX_LOCAL_ONLY;
  if (flag !== "1" && flag !== "true" && flag !== "on") {
    return { applied: false, reason: "NEX_LOCAL_ONLY not set", resolved: {} };
  }

  // Non-destructive fill · existing env wins.
  process.env.NEX_LLM_RESCUE_PROVIDER ??= "ollama";
  process.env.NEX_VISION_PROVIDER ??= "ollama";
  process.env.NEX_WEB_ACQUISITION_PROVIDER ??= "ddg";
  process.env.NEX_EMBEDDING_PROVIDER ??= "ollama";
  process.env.NEX_FILE_PROVIDER ??= "real";
  process.env.LLM_ALLOW_MOCK_FALLBACK ??= "false";

  return {
    applied: true,
    reason: `NEX_LOCAL_ONLY=${flag}`,
    resolved: {
      NEX_LLM_RESCUE_PROVIDER: process.env.NEX_LLM_RESCUE_PROVIDER,
      NEX_VISION_PROVIDER: process.env.NEX_VISION_PROVIDER,
      NEX_WEB_ACQUISITION_PROVIDER: process.env.NEX_WEB_ACQUISITION_PROVIDER,
      NEX_EMBEDDING_PROVIDER: process.env.NEX_EMBEDDING_PROVIDER,
      NEX_FILE_PROVIDER: process.env.NEX_FILE_PROVIDER,
      LLM_ALLOW_MOCK_FALLBACK: process.env.LLM_ALLOW_MOCK_FALLBACK,
    },
  };
}

/** Get the resolution WITHOUT applying (for smoke tests + Observatory). */
export function getLocalOnlyResolution(): LocalOnlyResolution {
  const flag = process.env.NEX_LOCAL_ONLY;
  if (flag !== "1" && flag !== "true" && flag !== "on") {
    return { applied: false, reason: "NEX_LOCAL_ONLY not set", resolved: {} };
  }
  return {
    applied: true,
    reason: `NEX_LOCAL_ONLY=${flag}`,
    resolved: {
      NEX_LLM_RESCUE_PROVIDER: process.env.NEX_LLM_RESCUE_PROVIDER,
      NEX_VISION_PROVIDER: process.env.NEX_VISION_PROVIDER,
      NEX_WEB_ACQUISITION_PROVIDER: process.env.NEX_WEB_ACQUISITION_PROVIDER,
      NEX_EMBEDDING_PROVIDER: process.env.NEX_EMBEDDING_PROVIDER,
      NEX_FILE_PROVIDER: process.env.NEX_FILE_PROVIDER,
      LLM_ALLOW_MOCK_FALLBACK: process.env.LLM_ALLOW_MOCK_FALLBACK,
    },
  };
}

// Apply at module load so downstream imports see the resolved env.
const _resolution = applyLocalOnlyModeIfSet();
if (_resolution.applied) {
  // eslint-disable-next-line no-console
  console.log(`[NEX-LOCAL-ONLY] applied · resolved providers: ${JSON.stringify(_resolution.resolved)}`);
}
