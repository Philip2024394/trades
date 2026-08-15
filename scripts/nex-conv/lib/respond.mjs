// ADR-0044 V1 · Step 2 · Response layer dispatcher.
//
// ============================================================================
// LOCAL-ONLY LOCKED (Philip · 2026-08-15)
// ============================================================================
// NEX has ZERO third-party LLM / API dependency. The response layer routes to
// LOCAL providers only. Hosted providers (OpenRouter, Anthropic, OpenAI,
// Google, Groq, etc.) are NOT registered here and will not be revived.
//
// Adapter selection · env NEX_RESPONSE_PROVIDER
//   - 'ollama' (default): local Ollama runtime at localhost:11434
//   - future providers register here as new files (llamacpp, vllm, ...)
//
// Model selection · env NEX_RESPONSE_MODEL
//   - defaults to 'qwen2.5:3b' (Qwen 2.5 3B Instruct Q4_K_M · Apache 2.0)
// ============================================================================

import * as ollamaLocal from './respond-local.mjs';

const PROVIDER = process.env.NEX_RESPONSE_PROVIDER ?? 'ollama';

const LOCAL_PROVIDERS = {
  ollama: ollamaLocal,
};

if (!Object.hasOwn(LOCAL_PROVIDERS, PROVIDER)) {
  throw new Error(
    `respond: NEX_RESPONSE_PROVIDER='${PROVIDER}' is not a registered LOCAL provider. ` +
    `Registered: ${Object.keys(LOCAL_PROVIDERS).join(', ')}. ` +
    `NEX has a zero-third-party-AI hard rule (2026-08-15) — hosted providers are not offered.`
  );
}

const _adapter = LOCAL_PROVIDERS[PROVIDER];

export const renderReply    = _adapter.renderReply;
export const getCallLog     = _adapter.getCallLog;
export const clearCallLog   = _adapter.clearCallLog;
