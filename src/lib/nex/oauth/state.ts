// src/lib/nex/oauth/state.ts
//
// Founder Phase 24 · P24-1 · OAuth state store · in-memory with TTL.
//
// Holds { state, code_verifier, provider_id, redirect_after, created_at }.
// TTL 10 minutes · state consumed on first read (single-use) so a leaked
// callback URL can't be replayed.

import { createHash, randomBytes } from "node:crypto";

interface StateEntry {
  state: string;
  code_verifier: string;
  provider_id: string;
  redirect_after: string;
  created_at: number;
}

const _states = new Map<string, StateEntry>();
const _TTL_MS = 10 * 60 * 1000;

function gc(): void {
  const cutoff = Date.now() - _TTL_MS;
  for (const [k, v] of _states) {
    if (v.created_at < cutoff) _states.delete(k);
  }
}

export function issueState(args: { provider_id: string; redirect_after: string }): { state: string; code_verifier: string; code_challenge: string } {
  gc();
  const state = randomBytes(24).toString("base64url");
  const code_verifier = randomBytes(32).toString("base64url");
  const code_challenge = createHash("sha256").update(code_verifier).digest("base64url");
  _states.set(state, {
    state,
    code_verifier,
    provider_id: args.provider_id,
    redirect_after: args.redirect_after,
    created_at: Date.now(),
  });
  return { state, code_verifier, code_challenge };
}

/** Consumes the state entry · returns null if unknown/expired. */
export function consumeState(state: string): StateEntry | null {
  gc();
  const entry = _states.get(state);
  if (!entry) return null;
  _states.delete(state);
  if (Date.now() - entry.created_at > _TTL_MS) return null;
  return entry;
}

/** Test-only introspection · never used in production paths. */
export function _pendingStateCount(): number {
  gc();
  return _states.size;
}
