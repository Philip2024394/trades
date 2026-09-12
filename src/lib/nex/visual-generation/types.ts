// src/lib/nex/visual-generation/types.ts
//
// Stage 10 · Visual Generation Layer · PROVIDER-NEUTRAL scaffold.
//
// Per founder decision (AUTHORISE BUILD locked 2026-09-11):
//   "IMAGE GEN = DEFER (build Visual Generation Layer provider-neutral)"
//
// This layer defines the CONTRACT that any future provider (OpenAI DALL-E ·
// Stability · Midjourney · local SDXL · pixel art tool · animation renderer)
// must satisfy. No provider is authored here. No provider is bound.
//
// Any attempt to declare provider capability without founder-approved binding
// is rejected as sec.visual_gen_provider_not_bound.

export type VisualKind = "image" | "pixel" | "animation" | "ui-asset" | "motion";

export interface GenerationRequest {
  readonly kind: VisualKind;
  readonly prompt: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly transparent: boolean;
  readonly requestedBy: string;
  readonly targetCapabilityId: string;
  readonly artefactStorageHint: "manifest" | "ephemeral" | "test-only";
}

export interface GenerationResult {
  readonly resultId: string;
  readonly kind: VisualKind;
  readonly bytes: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly manifestId: string | null;         // populated when written to nex-image-manifest
  readonly providerBoundName: string;         // "unbound" until founder binds a provider
  readonly reproducibleSeed: string | null;
  readonly createdAt: string;
}

export interface ProviderBinding {
  readonly name: string;
  readonly kinds: readonly VisualKind[];
  readonly boundBy: string;                   // founder session token
  readonly boundAt: string;
  readonly measurableProof: string;           // pointer to reproducible test artefact
}

export type VisualGenValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly reason: string };
