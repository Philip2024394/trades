// src/lib/nex-native/intelligence/boot-nex-builder.ts
//
// R4 · Boot-activate the NEX AI Builder production adapter · sealed 2026-09-25.
// -----------------------------------------------------------------------------
// Founder-sealed doctrine: production mode must NOT silently use ConsoleAdapter.
// Boot-time activation swaps DEFAULT_SITE_GEN_ADAPTER to the real
// NexGenEngineAdapter wired to the model registry + generation engine.
//
// This module is intentionally idempotent · safe to call from
// instrumentation.ts, from tests, and from the Reality Check.
//
// The activation itself does NOT force a model download — that happens on the
// first .generate() call (or explicitly via warmUp=true). This lets the boot
// hook stay cheap; the warm-up is separately verifiable.

import "server-only";
import { makeProductionAdapter, setDefaultSiteGenAdapter, DEFAULT_SITE_GEN_ADAPTER } from "../site-gen-adapter";
import { selectModel } from "./model-registry";

export interface BootActivateOptions {
  /** If true, perform a warm-up load + one probe generation so the first
   *  user request doesn't pay the cold-load cost. Default false. */
  warmUp?: boolean;
  /** If true, throw when no commercial-safe model is available. Default false. */
  requireProduction?: boolean;
  /** Max warm-up time in ms · rejected on timeout so the boot hook never hangs. */
  warmUpTimeoutMs?: number;
}

export interface BootActivateResult {
  activated: boolean;
  adapter_name: string;
  model_id: string | null;
  already_activated: boolean;
  warm_up_attempted: boolean;
  warm_up_ok: boolean;
  warm_up_latency_ms: number | null;
  warm_up_text_preview: string | null;
  warm_up_error: string | null;
  reason: string | null;
}

let _activated = false;

/** Boot-time activation of the production NEX AI Builder adapter.
 *  Idempotent · safe to call multiple times. */
export async function bootActivateNexBuilder(
  options: BootActivateOptions = {},
): Promise<BootActivateResult> {
  const warmUpTimeoutMs = options.warmUpTimeoutMs ?? 6 * 60 * 1000; // 6 minutes

  if (_activated && DEFAULT_SITE_GEN_ADAPTER.name === "nex-gen-engine") {
    return {
      activated: true,
      adapter_name: DEFAULT_SITE_GEN_ADAPTER.name,
      model_id: selectModel("default")?.id ?? null,
      already_activated: true,
      warm_up_attempted: false,
      warm_up_ok: false,
      warm_up_latency_ms: null,
      warm_up_text_preview: null,
      warm_up_error: null,
      reason: "idempotent · already activated",
    };
  }

  // Refuse to activate when no commercial-safe model is registered.
  const model = selectModel("default");
  if (!model) {
    const msg = "no commercial-safe model registered · production adapter refused";
    if (options.requireProduction) throw new Error(`boot-nex-builder: ${msg}`);
    return {
      activated: false,
      adapter_name: DEFAULT_SITE_GEN_ADAPTER.name,
      model_id: null,
      already_activated: false,
      warm_up_attempted: false,
      warm_up_ok: false,
      warm_up_latency_ms: null,
      warm_up_text_preview: null,
      warm_up_error: null,
      reason: msg,
    };
  }

  const prod = await makeProductionAdapter();
  setDefaultSiteGenAdapter(prod);
  _activated = true;

  // Optional warm-up · load model + one probe generation so first
  // real request lands hot. Every failure path is recorded honestly.
  let warm_up_ok = false;
  let warm_up_latency_ms: number | null = null;
  let warm_up_text_preview: string | null = null;
  let warm_up_error: string | null = null;
  const warm_up_attempted = !!options.warmUp;

  if (options.warmUp) {
    const start = Date.now();
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`warm_up_timeout_${warmUpTimeoutMs}ms`)), warmUpTimeoutMs),
      );
      const probe = prod.generate({
        prompt: "Modern minimal bakery site for a demo business.",
        business: {
          business_id: "warm-up-probe",
          display_name: "Warm-Up Bakery",
          description: "A minimal warm-up probe · not a real business.",
        },
      });
      const result = await Promise.race([probe, timeout]);
      warm_up_latency_ms = Date.now() - start;
      if (result.spec) {
        const anyText = result.spec.content.hero_headline ?? result.spec.content.hero_subline ?? "";
        warm_up_text_preview = String(anyText).slice(0, 120);
      }
      warm_up_ok = !result.is_dry_run;
      if (result.is_dry_run) {
        warm_up_error = result.fallback_reason ?? "adapter_returned_dry_run";
      }
    } catch (e) {
      warm_up_latency_ms = Date.now() - start;
      warm_up_error = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    activated: true,
    adapter_name: DEFAULT_SITE_GEN_ADAPTER.name,
    model_id: model.id,
    already_activated: false,
    warm_up_attempted,
    warm_up_ok,
    warm_up_latency_ms,
    warm_up_text_preview,
    warm_up_error,
    reason: null,
  };
}

/** Test-only: reset the internal activation flag so consecutive tests can
 *  re-boot without process restart. Never call from production code. */
export function _resetBootActivationForTests(): void {
  _activated = false;
}
