// Runtime types shared across the Brain substrate.

import type { z } from "zod";
import type { BrainManifest, MODULE_SCHEMAS, V1ModuleName } from "./_schema";

export type LoadedModule<K extends V1ModuleName> = z.infer<typeof MODULE_SCHEMAS[K]>;

/** A fully-loaded Brain after boot audit. Only V1 modules are typed
 *  at runtime — V2 modules are optional JSON payloads accessible via
 *  `optionalModules`. */
export type LoadedBrain = {
  manifest:        BrainManifest;
  craft:           LoadedModule<"craft">;
  regulations:     LoadedModule<"regulations">;
  materials:       LoadedModule<"materials">;
  workflow:        LoadedModule<"workflow">;
  defects:         LoadedModule<"defects">;
  pricing_model:   LoadedModule<"pricing_model">;
  optionalModules: Record<string, unknown>;
};

/** JSON pack input — one file per module, plus manifest. In dev the
 *  loader reads from the filesystem; in tests fixtures inject the same
 *  shape directly. */
export type BrainPack = {
  manifest: unknown;
  modules: Partial<Record<V1ModuleName, unknown>> & {
    [k: string]: unknown;
  };
};

export type BootAuditError = {
  kind:        "missing_v1_module" | "invalid_manifest" | "invalid_module"
             | "slug_mismatch"     | "unknown";
  brain_slug?: string;
  module?:     string;
  detail:      string;
};

export class BrainBootError extends Error {
  errors: BootAuditError[];
  constructor(errors: BootAuditError[]) {
    super(`Brain boot audit failed with ${errors.length} error(s): ${
      errors.map((e) => e.detail).join(" · ")
    }`);
    this.errors = errors;
    this.name = "BrainBootError";
  }
}
