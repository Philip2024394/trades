// NEX Delivery Engine · provider adapter registry
//
// Adapters implement `DeliveryProviderAdapter` and are registered by
// name. Selection is by env var NEX_DELIVERY_PROVIDER (default:
// "simulator"). Application code MUST NEVER import a provider SDK
// directly — only from the adapter file for that provider.
//
// Registered today (Phase 4f.1):
//   simulator · smtp · ses · sendgrid · mailgun · postmark
//
// Simulator is the default so Simulation Mode ships out of the box ·
// switching to a real provider is one env var change.

import type { DeliveryProviderAdapter, EmailMessage, ProviderEnvHint, ProviderSendResult } from "./types";
import { smtpAdapter }      from "./adapters/smtp";
import { sesAdapter }       from "./adapters/ses";
import { sendgridAdapter }  from "./adapters/sendgrid";
import { mailgunAdapter }   from "./adapters/mailgun";
import { postmarkAdapter }  from "./adapters/postmark";

// ── Simulator adapter · the "delivery simulation mode" from the doctrine ──
//
// Behaves exactly like a real provider (returns a message id + latency)
// but never actually sends. ~1% transient failure · ~0.5% permanent
// failure · latency 80-220ms. Enough randomness that retries and
// dead-letter transitions get exercised realistically.
const simulator: DeliveryProviderAdapter = {
  id: "simulator",
  label: "Delivery Simulation (no real send)",

  isConfigured(): boolean { return true; },
  env_hints(): ProviderEnvHint[] {
    return [{ name: "NEX_DELIVERY_PROVIDER", purpose: "Set to 'simulator' to activate simulation mode (default)", present: (process.env.NEX_DELIVERY_PROVIDER ?? "simulator") === "simulator" }];
  },
  async health() { return { ok: true, detail: "always healthy · does not touch the network" }; },

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
  smtp:     smtpAdapter,
  ses:      sesAdapter,
  sendgrid: sendgridAdapter,
  mailgun:  mailgunAdapter,
  postmark: postmarkAdapter,
};

export function activeProvider(): DeliveryProviderAdapter {
  const requested = (process.env.NEX_DELIVERY_PROVIDER ?? "simulator").toLowerCase();
  return REGISTRY[requested] ?? simulator;
}

export function currentMode(): "simulation" | "runtime" {
  return activeProvider().id === "simulator" ? "simulation" : "runtime";
}

export function registeredProviders(): Array<{ id: string; label: string; configured: boolean }> {
  return Object.values(REGISTRY).map((p) => ({ id: p.id, label: p.label, configured: p.isConfigured() }));
}

/** Per-adapter env-hint listing · secrets never leaked (only presence + length). */
export function providerEnvHints(): Array<{ id: string; label: string; hints: ProviderEnvHint[] }> {
  return Object.values(REGISTRY).map((p) => ({ id: p.id, label: p.label, hints: p.env_hints() }));
}

/** Run health() on every registered adapter · used by /api/nex/delivery/provider-health */
export async function checkAllProviderHealth(): Promise<Array<{ id: string; label: string; configured: boolean; ok: boolean | null; detail: string | null }>> {
  const out: Array<{ id: string; label: string; configured: boolean; ok: boolean | null; detail: string | null }> = [];
  for (const p of Object.values(REGISTRY)) {
    const configured = p.isConfigured();
    if (!configured) { out.push({ id: p.id, label: p.label, configured, ok: null, detail: "not configured" }); continue; }
    if (!p.health)    { out.push({ id: p.id, label: p.label, configured, ok: null, detail: "no health probe" }); continue; }
    try {
      const r = await Promise.race([
        p.health(),
        new Promise<{ ok: false; detail: string }>((res) => setTimeout(() => res({ ok: false, detail: "health probe timeout (5s)" }), 5000)),
      ]);
      out.push({ id: p.id, label: p.label, configured, ok: r.ok, detail: r.detail ?? null });
    } catch (e) {
      out.push({ id: p.id, label: p.label, configured, ok: false, detail: e instanceof Error ? e.message : "exception" });
    }
  }
  return out;
}
