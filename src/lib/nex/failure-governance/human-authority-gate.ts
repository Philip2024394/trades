// src/lib/nex/failure-governance/human-authority-gate.ts
//
// UWI · Wave 6 · M26 · HMAC-signed human-authority boundary
// Founder-authorised programme.
//
// Founder-locked doctrine (CRII synthesis §16 + ADR-0304 §5):
//   Every transition into BUILT / REJECTED / MERGED / SUPERSEDED /
//   PROMOTED / production change / new-allowlist / new-data-category
//   requires an HMAC-SHA256 signed decision from an authorised user.
//
// This module reuses the EXISTING signature primitive from
// `src/lib/nex/lab/promotions.ts` — it does NOT duplicate the HMAC
// scheme. The Wave 6 addition is the gate wrapper that enforces
// signature verification for lifecycle transitions in the Wave 5
// research-memory layer.
//
// Rule 5c preserved: gate is deterministic, no external service, no
// LLM. Signature secret is process.env.NEX_LAB_PROMOTION_SECRET
// (min 32 chars; fail-closed if unset).

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  type HumanAuthorityAction,
  type HumanAuthoritySignedDecision,
  HumanAuthorityRequiredError,
  HumanAuthoritySignatureInvalidError,
} from "./types";

const HUMAN_AUTHORITY_ACTIONS = new Set<HumanAuthorityAction>([
  "idea.built",
  "idea.rejected",
  "idea.merged",
  "idea.superseded",
  "opportunity.promoted",
  "opportunity.rejected",
  "opportunity.merged",
  "opportunity.superseded",
  "source.new_allowlist_entry",
  "governance.new_data_category",
  "governance.production_change",
  "governance.architecture_change",
]);

/** True if this action requires an HMAC-signed decision. Pure. */
export function requiresHumanAuthority(action: HumanAuthorityAction): boolean {
  return HUMAN_AUTHORITY_ACTIONS.has(action);
}

/** Canonical payload string for signing/verification. Deterministic. */
export function canonicalPayload(input: {
  action: HumanAuthorityAction;
  target_id: string;
  approved_at_iso: string;
  user_id: string;
}): string {
  // Same shape as ADR-0304 §5 but scoped to the Wave-5 lifecycle transition.
  return `${input.action}|${input.target_id}|${input.approved_at_iso}|${input.user_id}`;
}

/** Sign a proposed decision · returns the HMAC hex string.
 *  Requires NEX_LAB_PROMOTION_SECRET (min 32 chars). */
export function signHumanAuthorityDecision(input: {
  action: HumanAuthorityAction;
  target_id: string;
  approved_at_iso: string;
  user_id: string;
}, secret?: string): string {
  const key = secret ?? process.env.NEX_LAB_PROMOTION_SECRET ?? "";
  if (key.length < 32) {
    throw new HumanAuthoritySignatureInvalidError(
      input.action,
      input.target_id,
      "secret_not_configured (require NEX_LAB_PROMOTION_SECRET ≥ 32 chars)",
    );
  }
  return createHmac("sha256", key).update(canonicalPayload(input)).digest("hex");
}

/** Verify a signed decision · returns true/false. Timing-safe compare. */
export function verifyHumanAuthorityDecision(decision: HumanAuthoritySignedDecision, secret?: string): boolean {
  const key = secret ?? process.env.NEX_LAB_PROMOTION_SECRET ?? "";
  if (key.length < 32) return false; // fail-closed
  const expected_hex = createHmac("sha256", key).update(canonicalPayload({
    action: decision.action,
    target_id: decision.target_id,
    approved_at_iso: decision.approved_at_iso,
    user_id: decision.approved_by_user_id,
  })).digest("hex");
  const expected_buf = Buffer.from(expected_hex, "hex");
  const actual_buf = Buffer.from(decision.signature_hmac_sha256, "hex");
  if (expected_buf.length !== actual_buf.length) return false;
  return timingSafeEqual(expected_buf, actual_buf);
}

/** Assert-style gate · throws if action requires authority AND signature
 *  is missing/invalid. Callers wrap sensitive state transitions with this. */
export function assertHumanAuthority(
  action: HumanAuthorityAction,
  target_id: string,
  decision: HumanAuthoritySignedDecision | null | undefined,
  secret?: string,
): void {
  if (!requiresHumanAuthority(action)) return; // autonomous; nothing to check

  if (!decision) throw new HumanAuthorityRequiredError(action, target_id);

  if (decision.action !== action) {
    throw new HumanAuthoritySignatureInvalidError(action, target_id, `decision.action mismatch: ${decision.action} != ${action}`);
  }
  if (decision.target_id !== target_id) {
    throw new HumanAuthoritySignatureInvalidError(action, target_id, `decision.target_id mismatch: ${decision.target_id} != ${target_id}`);
  }
  if (!verifyHumanAuthorityDecision(decision, secret)) {
    throw new HumanAuthoritySignatureInvalidError(action, target_id, "signature verification failed");
  }
  // Time-drift guard (±5 min) to prevent stale signatures
  const now_ms = Date.now();
  const approved_ms = Date.parse(decision.approved_at_iso);
  if (!Number.isFinite(approved_ms) || Math.abs(now_ms - approved_ms) > 5 * 60 * 1000) {
    throw new HumanAuthoritySignatureInvalidError(action, target_id, `approved_at drift > 5min (approved_at=${decision.approved_at_iso})`);
  }
}
