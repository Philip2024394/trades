// src/lib/nex/signon/otp-store.test.ts
//
// Stage 3.33 · Phase 26 · OTP store tests (Philip 2026-08-31).
//
// Locks in:
//   · issueCode produces a 6-digit numeric code
//   · consumeCode succeeds exactly once (single-use)
//   · consumeCode rejects unknown phone with no_code_issued
//   · consumeCode rejects wrong code with wrong_code + counts attempts
//   · after MAX_ATTEMPTS wrong tries, the code is invalidated
//     (too_many_attempts on the next try)
//   · expired code returns code_expired and is cleaned up
//   · issuing a new code replaces the previous entry (resend button UX)

import { describe, expect, it, beforeEach } from "vitest";
import { issueCode, consumeCode, __resetOtpStoreForTests } from "./otp-store";

const PHONE = "+6281234567890";

beforeEach(() => __resetOtpStoreForTests());

describe("issueCode", () => {
  it("returns a 6-digit numeric code", () => {
    const { code } = issueCode(PHONE);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("returns an expiresAt roughly 5 minutes from now", () => {
    const now = 1_700_000_000_000;
    const { expiresAt } = issueCode(PHONE, now);
    expect(expiresAt).toBe(now + 5 * 60 * 1000);
  });

  it("re-issuing replaces the previous code (resend UX)", () => {
    const first  = issueCode(PHONE);
    const second = issueCode(PHONE);
    // second code overwrites first · first should now fail
    const bad = consumeCode(PHONE, first.code);
    expect(bad.ok).toBe(false);
    const good = consumeCode(PHONE, second.code);
    expect(good.ok).toBe(true);
  });
});

describe("consumeCode · happy path", () => {
  it("verifies correct code once + deletes it (single-use)", () => {
    const { code } = issueCode(PHONE);
    const first = consumeCode(PHONE, code);
    expect(first.ok).toBe(true);
    const second = consumeCode(PHONE, code);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("no_code_issued");
  });
});

describe("consumeCode · rejection paths", () => {
  it("no_code_issued when no code was ever issued", () => {
    const r = consumeCode("+6299999999999", "123456");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_code_issued");
  });

  it("wrong_code on mismatch · increments attempts", () => {
    issueCode(PHONE);
    const r = consumeCode(PHONE, "000000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong_code");
  });

  it("too_many_attempts after MAX_ATTEMPTS wrong tries · code invalidated", () => {
    const { code } = issueCode(PHONE);
    // 5 wrong tries · each returns wrong_code
    for (let i = 0; i < 5; i++) {
      const r = consumeCode(PHONE, "000000");
      expect(r.ok).toBe(false);
    }
    // 6th try — even with the CORRECT code — must fail because attempts exhausted
    const r6 = consumeCode(PHONE, code);
    expect(r6.ok).toBe(false);
    if (!r6.ok) expect(r6.reason).toBe("too_many_attempts");
    // Follow-up try returns no_code_issued (entry deleted)
    const r7 = consumeCode(PHONE, code);
    if (!r7.ok) expect(r7.reason).toBe("no_code_issued");
  });

  it("code_expired when past expiry · entry deleted", () => {
    const now = 1_700_000_000_000;
    const { code } = issueCode(PHONE, now);
    const later = now + 6 * 60 * 1000; // 6 minutes later · past 5-min TTL
    const r = consumeCode(PHONE, code, later);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("code_expired");
    // Follow-up returns no_code_issued
    const r2 = consumeCode(PHONE, code);
    if (!r2.ok) expect(r2.reason).toBe("no_code_issued");
  });
});
