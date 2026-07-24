// Model Router — chooses the backend for a given DesignIR.
//
// Policy (V3 Q11 · Router hint):
//   • Vehicle wraps + hero photos      → GPT Image 1 (best photorealism)
//   • Logos + geometric marks          → Ideogram v2 (best typography)
//   • Flyers + posters + line art      → Recraft v3 (best vector)
//   • Explicit ir.intent.model_hint    → honoured verbatim
//
// Adding a new backend = new file in this folder + a case here.
// The dispatcher never leaks backend-specific types to the caller.

import type { DesignIR } from "../ir";
import type { CompiledPrompt, PromptSection } from "../types";
import { compileForGptImage } from "./gpt-image";

export type BackendId = "gpt-image-1" | "ideogram-v3" | "recraft-v3";

export type RoutingDecision = {
  backend:  BackendId;
  reason:   string;
};

export function chooseBackend(ir: DesignIR): RoutingDecision {
  // 1. Explicit override always wins. Studios pass `model_hint` when the
  //    merchant picks a specific engine or when we A/B test a router.
  const hint = (ir.intent as { model_hint?: BackendId }).model_hint;
  if (hint === "gpt-image-1" || hint === "ideogram-v3" || hint === "recraft-v3") {
    return { backend: hint, reason: "explicit ir.intent.model_hint" };
  }

  // 2. Surface-based defaults. Vehicles + photos → GPT Image 1.
  if (ir.intent.surface === "vehicle") {
    return { backend: "gpt-image-1", reason: "surface=vehicle default" };
  }

  // 3. Logo / business-card surfaces prefer Ideogram (typography wins).
  if (ir.intent.surface === "logo" || ir.intent.surface === "business-card") {
    return { backend: "ideogram-v3", reason: "surface=logo default (Ideogram typography)" };
  }

  // 4. Print / signage surfaces prefer Recraft (vector-friendly).
  if (ir.intent.surface === "print" || ir.intent.surface === "signage" || ir.intent.surface === "invoice" || ir.intent.surface === "letterhead") {
    return { backend: "recraft-v3", reason: "surface=print default (Recraft vector)" };
  }

  // 5. Fallback — GPT Image 1 is the most-general adapter.
  return { backend: "gpt-image-1", reason: "fallback default" };
}

/** Dispatch to the chosen backend's compileFor* fn. Backends that
 *  aren't wired yet fall through to GPT Image 1 so the compiler never
 *  hard-fails on a routing decision. */
export function compileForBackend(
  ir:       DesignIR,
  sections: PromptSection[],
  decision: RoutingDecision
): CompiledPrompt {
  switch (decision.backend) {
    case "gpt-image-1":
      return compileForGptImage(ir, sections);
    case "ideogram-v3":
    case "recraft-v3":
      // Adapters not shipped yet. Fall through with a note so the
      // caller can see why. Compiler still returns a valid prompt so
      // testing continues; the AI Orchestrator picks which backend
      // ultimately fires.
      return {
        ...compileForGptImage(ir, sections),
        model: decision.backend
      };
  }
}
