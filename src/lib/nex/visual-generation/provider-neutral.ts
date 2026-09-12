// src/lib/nex/visual-generation/provider-neutral.ts
//
// Stage 10 · Visual Generation Layer · provider-neutral facade.
//
// Guarantees:
//   1. No provider is bound at author time.
//   2. Any call to `generate()` without a bound provider returns
//      sec.visual_gen_provider_not_bound (fail-closed).
//   3. Provider binding requires founder signature + measurable proof
//      (per measurable-not-claimed rule).
//   4. NEVER writes to nex-image-manifest without artefactStorageHint=manifest
//      + founder-signed run · ephemeral/test-only never persist.

import type {
  GenerationRequest,
  GenerationResult,
  ProviderBinding,
  VisualGenValidation,
  VisualKind,
} from "./types";

export class VisualGenerationLayer {
  private bindings: ProviderBinding[] = [];

  bindProvider(binding: ProviderBinding): VisualGenValidation {
    if (!binding.name || binding.name.length === 0) {
      return { ok: false, code: "sec.visual_gen_bind_missing_name", reason: "provider name required" };
    }
    if (!binding.boundBy || binding.boundBy.length === 0) {
      return { ok: false, code: "sec.visual_gen_bind_missing_signature", reason: "founder signature required" };
    }
    if (!binding.measurableProof || binding.measurableProof.length === 0) {
      return {
        ok: false,
        code: "sec.visual_gen_bind_missing_proof",
        reason: "measurable-not-claimed: reproducible test artefact required",
      };
    }
    if (binding.kinds.length === 0) {
      return { ok: false, code: "sec.visual_gen_bind_missing_kinds", reason: "at least one supported kind required" };
    }
    this.bindings.push(binding);
    return { ok: true };
  }

  boundKinds(): readonly VisualKind[] {
    const s = new Set<VisualKind>();
    for (const b of this.bindings) {
      for (const k of b.kinds) s.add(k);
    }
    return Array.from(s);
  }

  isBoundFor(kind: VisualKind): boolean {
    return this.bindings.some((b) => b.kinds.includes(kind));
  }

  /**
   * Attempt a generation. Returns a result only when a provider is bound
   * for the requested kind. Otherwise returns a validation failure with
   * sec.visual_gen_provider_not_bound (fail-closed).
   */
  generate(
    request: GenerationRequest,
  ): VisualGenValidation | { readonly ok: true; readonly result: GenerationResult } {
    if (!this.isBoundFor(request.kind)) {
      return {
        ok: false,
        code: "sec.visual_gen_provider_not_bound",
        reason: `No bound provider for kind ${request.kind} · founder-approved binding required`,
      };
    }
    if (request.artefactStorageHint === "manifest" && !request.requestedBy) {
      return {
        ok: false,
        code: "sec.visual_gen_manifest_requires_signed_run",
        reason: "manifest storage requires signed requestedBy",
      };
    }
    if (request.widthPx <= 0 || request.heightPx <= 0) {
      return {
        ok: false,
        code: "sec.visual_gen_bad_dimensions",
        reason: `Dimensions must be positive · got ${request.widthPx}x${request.heightPx}`,
      };
    }

    // Placeholder: no real generation performed. Return a synthetic 0-byte
    // result marker that the caller can use to test the wire without an actual
    // provider. Real provider integration replaces this.
    return {
      ok: true,
      result: {
        resultId: `unbound-placeholder-${Date.now()}`,
        kind: request.kind,
        bytes: 0,
        widthPx: request.widthPx,
        heightPx: request.heightPx,
        manifestId: null,
        providerBoundName: this.bindings[0]?.name ?? "unbound",
        reproducibleSeed: null,
        createdAt: new Date().toISOString(),
      },
    };
  }

  clear(): void {
    this.bindings = [];
  }
}
