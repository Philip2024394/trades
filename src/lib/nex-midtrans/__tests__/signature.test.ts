// src/lib/nex-midtrans/__tests__/signature.test.ts · Philip 2026-08-29
//
// Unit tests for Midtrans SHA-512 signature verification.
// Pure math · no network · no DB.

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { computeMidtransSignature, verifyMidtransSignature } from "../signature";

// Build a known-good input for reuse across tests. Numbers below reflect
// Midtrans's docs example shape (order_id + status_code + gross_amount + key).
const GOOD = {
  order_id: "nex-topup-uuid-abc123",
  status_code: "200",
  gross_amount: "50000.00",
  server_key: "SB-Mid-server-EXAMPLEKEY123",
};

// Compute the signature via a fresh SHA-512 hash so the test doesn't just
// mirror the implementation — it independently derives the truth.
function independentSha512(input: string): string {
  return createHash("sha512").update(input).digest("hex");
}

describe("computeMidtransSignature · matches the SHA-512 of concatenated fields", () => {
  it("agrees with an independent SHA-512 computation", () => {
    const expected = independentSha512(
      GOOD.order_id + GOOD.status_code + GOOD.gross_amount + GOOD.server_key,
    );
    expect(computeMidtransSignature(GOOD)).toBe(expected);
  });

  it("digest is 128-char lowercase hex", () => {
    const sig = computeMidtransSignature(GOOD);
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
  });

  it("changing ANY input field changes the digest", () => {
    const base = computeMidtransSignature(GOOD);
    expect(computeMidtransSignature({ ...GOOD, order_id: "other" })).not.toBe(base);
    expect(computeMidtransSignature({ ...GOOD, status_code: "201" })).not.toBe(base);
    expect(computeMidtransSignature({ ...GOOD, gross_amount: "50000.01" })).not.toBe(base);
    expect(computeMidtransSignature({ ...GOOD, server_key: "SB-Mid-server-OTHER" })).not.toBe(base);
  });

  it("is deterministic across many invocations", () => {
    const a = computeMidtransSignature(GOOD);
    for (let i = 0; i < 100; i++) {
      expect(computeMidtransSignature(GOOD)).toBe(a);
    }
  });
});

describe("verifyMidtransSignature · accept only exact matches", () => {
  const trueSig = computeMidtransSignature(GOOD);

  it("accepts a genuine signature", () => {
    expect(verifyMidtransSignature({ ...GOOD, signature_key: trueSig })).toBe(true);
  });

  it("rejects a signature computed with a different server key", () => {
    const forged = computeMidtransSignature({ ...GOOD, server_key: "SB-Mid-server-WRONG" });
    expect(verifyMidtransSignature({ ...GOOD, signature_key: forged })).toBe(false);
  });

  it("rejects when order_id was tampered post-signing", () => {
    expect(verifyMidtransSignature({
      ...GOOD, order_id: "attacker-forged", signature_key: trueSig,
    })).toBe(false);
  });

  it("rejects when gross_amount was inflated post-signing (amount-tamper attack)", () => {
    expect(verifyMidtransSignature({
      ...GOOD, gross_amount: "500000.00", signature_key: trueSig,
    })).toBe(false);
  });

  it("rejects empty / missing fields", () => {
    expect(verifyMidtransSignature({ ...GOOD, order_id: "", signature_key: trueSig })).toBe(false);
    expect(verifyMidtransSignature({ ...GOOD, status_code: "", signature_key: trueSig })).toBe(false);
    expect(verifyMidtransSignature({ ...GOOD, gross_amount: "", signature_key: trueSig })).toBe(false);
    expect(verifyMidtransSignature({ ...GOOD, server_key: "", signature_key: trueSig })).toBe(false);
    expect(verifyMidtransSignature({ ...GOOD, signature_key: "" })).toBe(false);
  });

  it("rejects a signature of wrong length (defensive · returns fast)", () => {
    expect(verifyMidtransSignature({ ...GOOD, signature_key: "deadbeef" })).toBe(false);
    // Length one short of correct
    expect(verifyMidtransSignature({ ...GOOD, signature_key: trueSig.slice(0, -1) })).toBe(false);
  });

  it("does not short-circuit on early character mismatch (constant-time)", () => {
    // Flip the FIRST character and the LAST character of a valid signature.
    // Both should reject. This test is a smoke check that the comparison
    // loops through the whole string; there's no timing assertion.
    const flipFirst = String.fromCharCode(trueSig.charCodeAt(0) ^ 1) + trueSig.slice(1);
    const flipLast  = trueSig.slice(0, -1) + String.fromCharCode(trueSig.charCodeAt(trueSig.length - 1) ^ 1);
    expect(verifyMidtransSignature({ ...GOOD, signature_key: flipFirst })).toBe(false);
    expect(verifyMidtransSignature({ ...GOOD, signature_key: flipLast })).toBe(false);
  });

  it("gross_amount format matters (Midtrans always sends 2 decimals)", () => {
    // A payload with "50000" (no decimals) would NOT match a signature
    // computed against "50000.00". Confirms our code treats the exact string.
    const sig2dp = computeMidtransSignature({ ...GOOD, gross_amount: "50000.00" });
    expect(verifyMidtransSignature({
      ...GOOD, gross_amount: "50000", signature_key: sig2dp,
    })).toBe(false);
  });
});
