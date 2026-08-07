// NEX Delivery Engine · provider adapter registry
//
// Adapters implement `DeliveryProviderAdapter` and are registered by
// name. Selection is by env var NEX_DELIVERY_PROVIDER (default:
// "simulator"). Application code MUST NEVER import a provider SDK
// directly — only from the adapter file for that provider.
//
// Today: simulator only. Future adapters (smtp/ses/sendgrid/mailgun/
// postmark) plug in without changing anything above this line.

import type { DeliveryProviderAdapter, EmailMessage, ProviderSendResult } from "./types";

// ── Simulator adapter · the "delivery simulation mode" from the doctrine ──
//
// Behaves exactly like a real provider (returns a message id + latency)
// but never actually sends. ~1% transient failure · ~0.5% permanent
// failure · latency 80-220ms. Enough randomness that retries and
// dead-letter transitions get exercised realistically.
const simulator: DeliveryProviderAdapter = {
  id: "simulator",
  label: "Delivery Simulation (no real send)",
  async send(_msg: EmailMessage): Promise<ProviderSendResult> {
    const t0 = Date.now();
    const target_latency = 80 + Math.floor(Math.random() * 140);
    await new Promise((r) => setTimeout(r, target_latency));
    const roll = Math.random();
    const latency_ms = Date.now() - t0;
    if (roll < 0.005) {
      return { ok: false, error: "simulated permanent bounce · invalid mailbox", retriable: false, latency_ms };
    }
    if (roll < 0.015) {
      return { ok: false, error: "simulated transient throttle · try later", retriable: true, latency_ms };
    }
    const provider_message_id = `sim-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    return { ok: true, provider_message_id, latency_ms };
  },
};

const REGISTRY: Record<string, DeliveryProviderAdapter> = {
  simulator,
};

export function activeProvider(): DeliveryProviderAdapter {
  const requested = (process.env.NEX_DELIVERY_PROVIDER ?? "simulator").toLowerCase();
  return REGISTRY[requested] ?? simulator;
}

export function currentMode(): "simulation" | "runtime" {
  return activeProvider().id === "simulator" ? "simulation" : "runtime";
}

export function registeredProviders(): Array<{ id: string; label: string }> {
  return Object.values(REGISTRY).map((p) => ({ id: p.id, label: p.label }));
}
