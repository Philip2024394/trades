// src/lib/nex-midtrans/signature.ts · Philip 2026-08-29
//
// Midtrans webhook signature verification.
//
// Per docs.midtrans.com/docs/https-notification-webhooks (verified
// 2026-04-28), Midtrans signs every notification with:
//
//   signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
//
// Fields are concatenated as strings, no separator, no encoding — just
// str(order_id) + str(status_code) + str(gross_amount) + str(server_key).
//
// If the computed digest matches `signature_key` from the payload, the
// webhook is authentic. If not, reject with 403. Never trust a webhook
// without this check — otherwise anyone posting to our endpoint could
// credit any provider's wallet.
//
// Pure function. No DB, no fetch, no side effects. Unit-testable.

import { createHash } from "node:crypto";

export interface MidtransSignatureInput {
  order_id: string;
  /** Midtrans sends this as a STRING even though it's numeric ("200"). */
  status_code: string;
  /** Midtrans sends this as a STRING with 2 decimals ("50000.00"). */
  gross_amount: string;
  /** Midtrans server key (secret · env-only, never client-side). */
  server_key: string;
}

/**
 * Compute the expected signature. Returns lowercase hex SHA-512 digest.
 * Exported for testing convenience — production code should call
 * `verifyMidtransSignature()` instead.
 */
export function computeMidtransSignature(input: MidtransSignatureInput): string {
  const { order_id, status_code, gross_amount, server_key } = input;
  return createHash("sha512")
    .update(order_id + status_code + gross_amount + server_key)
    .digest("hex");
}

/**
 * Constant-time comparison. Rejects any input that fails validation
 * BEFORE hashing so we don't waste cycles on obviously-bad data.
 *
 * Returns `true` iff the incoming `signature_key` matches the expected
 * hash for these fields under our server_key.
 */
export function verifyMidtransSignature(input: MidtransSignatureInput & {
  signature_key: string;
}): boolean {
  const { signature_key } = input;
  // Type-guard every field. Any non-string / empty field → reject.
  if (typeof input.order_id     !== "string" || input.order_id     === "") return false;
  if (typeof input.status_code  !== "string" || input.status_code  === "") return false;
  if (typeof input.gross_amount !== "string" || input.gross_amount === "") return false;
  if (typeof input.server_key   !== "string" || input.server_key   === "") return false;
  if (typeof signature_key      !== "string" || signature_key      === "") return false;

  const expected = computeMidtransSignature(input);
  // Length mismatch → immediate reject. Both hex strings should be 128 chars.
  if (expected.length !== signature_key.length) return false;

  // Constant-time compare · never leak character position via short-circuit.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature_key.charCodeAt(i);
  }
  return diff === 0;
}
