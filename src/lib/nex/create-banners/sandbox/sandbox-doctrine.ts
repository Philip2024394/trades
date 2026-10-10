// src/lib/nex/create-banners/sandbox/sandbox-doctrine.ts
//
// NEX Create Banners · Sandbox doctrine locks · 2026-09-23
// ========================================================
// Hard invariants for the interactive sandbox demo. Every generation
// path in the sandbox reads these constants. Do NOT weaken.

import * as path from "node:path";

/** ONLY reference asset the sandbox will accept. Founder-authorised Cat 1. */
export const SANDBOX_ONLY_REFERENCE_SHA256 =
  "6fe56772c3916612acd2af3ee224ce2fcb5915a45fc9fa8710448c51ce62cce0" as const;

export const SANDBOX_ONLY_REFERENCE_RELATIVE_PATH =
  "data/nex-sdxl-smoke-test-2026-09-23/reference-founder-supplied.png" as const;

export function sandboxReferenceAbsolutePath(): string {
  return path.join(process.cwd(), SANDBOX_ONLY_REFERENCE_RELATIVE_PATH);
}

/** Root directory for sandbox outputs. NEVER the image manifest. */
export const SANDBOX_OUTPUT_ROOT_RELATIVE =
  "data/nex-create-banners-sandbox" as const;

export function sandboxOutputRootAbsolute(): string {
  return path.join(process.cwd(), SANDBOX_OUTPUT_ROOT_RELATIVE);
}

export function sandboxJobDirAbsolute(jobId: string): string {
  const safe = jobId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(sandboxOutputRootAbsolute(), safe);
}

/** Watermark text stamped on every rendered variant. Never removable. */
export const SANDBOX_WATERMARK_TEXT =
  "QUALITY UNPROVEN · NOT FOR CUSTOMER PUBLICATION" as const;

/** Explicit publication ban for anything sandbox-produced. */
export const SANDBOX_MAY_PUBLISH = false as const;

/** Explicit manifest-write ban for anything sandbox-produced. */
export const SANDBOX_MAY_WRITE_TO_MANIFEST = false as const;

/** Explicit Social Poster handoff ban. */
export const SANDBOX_MAY_HANDOFF_TO_SOCIAL_POSTER = false as const;

// Doctrine locks
export const _SANDBOX_ONLY_CAT1_REFERENCE = true as const;
export const _SANDBOX_ALL_OUTPUTS_WATERMARKED = true as const;
export const _SANDBOX_NEVER_WRITES_TO_MANIFEST = true as const;
export const _SANDBOX_NEVER_PUBLISHES = true as const;
