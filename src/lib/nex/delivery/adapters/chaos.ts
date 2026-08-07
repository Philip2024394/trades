// NEX Delivery · chaos test adapter
//
// Test-only adapter that lets the recovery suite exercise failure
// modes deterministically. Behaviour controlled by env vars:
//
//   NEX_CHAOS_MODE=off               (default · behaves like a fast simulator)
//   NEX_CHAOS_MODE=throttle          returns 429 retriable · with retry-after
//   NEX_CHAOS_MODE=timeout           always throws (network-timeout-like)
//   NEX_CHAOS_MODE=permanent_bounce  returns non-retriable failure
//
// NEVER select this in production. The registry doesn't gate that ·
// but no production env will ever set NEX_DELIVERY_PROVIDER=chaos.

import type { DeliveryProviderAdapter, EmailMessage, ProviderEnvHint, ProviderSendResult } from "../types";

export const chaosAdapter: DeliveryProviderAdapter = {
  id: "chaos",
  label: "Chaos test adapter (recovery suite only)",

  isConfigured(): boolean { return true; },
  env_hints(): ProviderEnvHint[] {
    return [{ name: "NEX_CHAOS_MODE", purpose: "off | throttle | timeout | permanent_bounce", present: !!process.env.NEX_CHAOS_MODE }];
  },
  async health() { return { ok: true, detail: `mode=${process.env.NEX_CHAOS_MODE ?? "off"}` }; },

  async send(_msg: EmailMessage): Promise<ProviderSendResult> {
    const t0 = Date.now();
    const mode = (process.env.NEX_CHAOS_MODE ?? "off").toLowerCase();
    if (mode === "timeout") {
      throw new Error("chaos: simulated network timeout");
    }
    if (mode === "throttle") {
      return { ok: false, error: "chaos: throttled 429", retriable: true, retry_after_ms: 500, latency_ms: Date.now() - t0 };
    }
    if (mode === "permanent_bounce") {
      return { ok: false, error: "chaos: permanent bounce (mailbox does not exist)", retriable: false, latency_ms: Date.now() - t0 };
    }
    // off · behave like fast simulator
    return { ok: true, provider_message_id: `chaos-${Date.now().toString(36)}`, latency_ms: Date.now() - t0 };
  },
};
