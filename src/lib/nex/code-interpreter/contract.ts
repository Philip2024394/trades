// src/lib/nex/code-interpreter/contract.ts
//
// Founder Phase 20 · P20-1 · Code-interpreter contract.
//
// ═══════════════════════════════════════════════════════════════════
// CODE DOCTRINE
// ═══════════════════════════════════════════════════════════════════
//   "COMPUTED OUTPUT IS INPUT · NEVER ESTABLISHES TRUTH"
//
// A user's code produces stdout/stderr/return-value. Those flow into
// the chat pipeline the same way voice transcripts and file text do —
// as untrusted user_context, never as an EvidenceItem. Every claim
// still passes Fabrication Gate v2 regardless of how it was computed.

import { z } from "zod";

export const CodeExecuteRequestSchema = z.object({
  code: z.string().min(1).max(20_000),                // ~20 KB max
  language: z.enum(["javascript"]).default("javascript"),
  budget_ms: z.number().int().min(50).max(10_000).default(3_000),
  conversation_id: z.string().max(120).optional(),
});
export type CodeExecuteRequest = z.infer<typeof CodeExecuteRequestSchema>;

export interface CodeExecuteResult {
  execution_id: string;                                // code:<hash>
  language: string;
  code_hash: string;
  code_length: number;
  stdout: string;
  stderr: string;
  return_value: unknown;                               // JSON-safe view of what the code returned
  return_kind: "undefined" | "primitive" | "object" | "error";
  ok: boolean;
  timed_out: boolean;
  error_class: string | null;
  error_message: string | null;
  request_ms: number;
}

// ═══════════════════════════════════════════════════════════════════
// Hash helper
// ═══════════════════════════════════════════════════════════════════

export function hashCode(code: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(code).digest("hex").slice(0, 16);
}
