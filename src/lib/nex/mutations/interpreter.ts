// NEX Mutations · instruction interpreter (Philip 2026-08-14).
//
// Turns owner input into a structured MutationProposal.
// Rule-based (per NEX Core Dependency Rule · no third-party LLM).
//
// Accepts EITHER:
//   - a structured object { kind, selector, newValue }
//   - a plain-English string (routed through the per-registration parseInstruction)

import type { MutationProposal } from "./types";
import { getMutation, listMutationKinds } from "./registry";

export type InterpretResult =
  | { ok: true; proposal: MutationProposal }
  | { ok: false; error: string; candidates?: string[] };

export function interpret(input: string | MutationProposal): InterpretResult {
  if (typeof input === "object" && input !== null) {
    const kind = input.kind;
    if (!kind || !getMutation(kind)) return { ok: false, error: `unknown mutation kind "${kind}"`, candidates: listMutationKinds() };
    return { ok: true, proposal: input };
  }

  const text = String(input ?? "").trim();
  if (text.length === 0) return { ok: false, error: "empty instruction" };

  // Try every registered parser · deterministic first-match wins.
  for (const kind of listMutationKinds()) {
    const reg = getMutation(kind);
    if (!reg?.parseInstruction) continue;
    const parsed = reg.parseInstruction(text);
    if (parsed) return { ok: true, proposal: parsed };
  }

  return {
    ok: false,
    error: `no mutation type matched the instruction "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}". Try a structured proposal { kind, selector, newValue }.`,
    candidates: listMutationKinds()
  };
}
