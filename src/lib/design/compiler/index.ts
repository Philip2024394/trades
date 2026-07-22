// Prompt Compiler — public API.
//
// Studios never write prompts. They construct a DesignIR and call
// compile(). The compiler runs the 14-stage pipeline per V3 Q13,
// returns a CompiledPrompt versioned, cached, and ready for the
// Model Router.
//
// The compiler NEVER calls the AI. It only produces the prompt.
// The AI Orchestrator (V3 Q16) hands the CompiledPrompt to the
// image / reasoning model of its choice.

import type { DesignIR } from "./ir";
import type { CompiledPrompt } from "./types";
import { parseIR } from "./ir";
import { assembleSections } from "./stages/prompt-assembly";
import { validate } from "./stages/validator";
import { resolveConstraints } from "./stages/constraint-resolver";
import { compileForGptImage } from "./backends/gpt-image";
import { cacheKey, readCache, writeCache } from "./cache";

export const COMPILER_VERSION = "1.0.0";

export type CompileError = {
  ok:     false;
  errors: Array<{ path: string; message: string }>;
};

export type CompileSuccess = {
  ok:     true;
  prompt: CompiledPrompt;
  cached: boolean;
};

export type CompileResult = CompileSuccess | CompileError;

/** Compile an IR into a model-specific prompt.
 *
 *  Pipeline:
 *   1  parseIR                    — validate IR shape (Zod)
 *   2  cache lookup               — early return on hit
 *   3  assembleSections           — Stage 11 (build PromptSection[])
 *   4  validate                   — Stage 13 (nothing missing)
 *   5  backend compile            — Stages 7 + 12 (model-specific)
 *   6  writeCache                 — cache for future hits
 *
 *  Returns typed error on any failure — never throws.
 */
export function compile(input: unknown): CompileResult {
  let ir: DesignIR;
  try {
    ir = parseIR(input);
  } catch (e) {
    return {
      ok: false,
      errors: [{ path: "ir", message: e instanceof Error ? e.message : "IR parse failed" }]
    };
  }

  const key = cacheKey(ir, COMPILER_VERSION);
  const cached = readCache(key);
  if (cached) return { ok: true, prompt: cached, cached: true };

  // Resolve constraints — merges universal + surface + trade rules
  // into the IR before assembly reads them.
  const irWithConstraints: DesignIR = {
    ...ir,
    constraints: resolveConstraints(ir.intent.surface, ir.trade, ir.constraints)
  };

  const sections = assembleSections(irWithConstraints);

  const validation = validate(irWithConstraints, sections);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  // Model routing — for now only GPT Image 1. When Ideogram / Recraft
  // / Flux backends land, dispatch by ir.production or a router hint.
  const compiled = compileForGptImage(irWithConstraints, sections);
  compiled.cacheKey = key;

  writeCache(key, compiled);
  return { ok: true, prompt: compiled, cached: false };
}

/** Convenience — build a minimal DesignIR from Studio input.
 *  Studios use this rather than assembling the IR by hand. */
export function buildVehicleIR(input: {
  brand:          Parameters<typeof buildVehicleIRImpl>[0]["brand"];
  business:       Parameters<typeof buildVehicleIRImpl>[0]["business"];
  vehicle:        Parameters<typeof buildVehicleIRImpl>[0]["vehicle"];
  trade:          string;
  brand_snapshot_id: string;
  style_anchor?:  string;
  hero_photo_urls?: string[];
  memory_hints?:  Parameters<typeof buildVehicleIRImpl>[0]["memory_hints"];
}): DesignIR {
  return buildVehicleIRImpl(input);
}

// Impl separated so the exported signature stays clean.
function buildVehicleIRImpl(input: {
  brand: { colour: DesignIR["colour"]; typography: DesignIR["typography"]; };
  business: DesignIR["business"];
  vehicle:  DesignIR["vehicle"];
  trade:    string;
  brand_snapshot_id: string;
  style_anchor?:  string;
  hero_photo_urls?: string[];
  memory_hints?: DesignIR["memory_hints"];
}): DesignIR {
  return {
    schema_version: "1.0.0",
    intent: {
      surface: "vehicle",
      style:   input.style_anchor,
      hints:   []
    },
    trade:             input.trade,
    vehicle:           input.vehicle,
    brand_snapshot_id: input.brand_snapshot_id,
    layout: {
      style_anchor:       input.style_anchor,
      hero_pct:           28,
      negative_space_pct: 18,
      info_groups_max:    3
    },
    photography: {
      hero_style: input.style_anchor,
      photo_urls: input.hero_photo_urls ?? [],
      overlay:    false,
      grain:      false
    },
    typography:    input.brand.typography,
    colour:        input.brand.colour,
    constraints:   [],   // constraint-resolver runs downstream
    outputs: [
      { kind: "side",  width_px: 1600, height_px: 900, quality: "medium" }
    ],
    memory_hints:  input.memory_hints ?? [],
    business:      input.business
  };
}

export type { DesignIR } from "./ir";
export type { CompiledPrompt } from "./types";
