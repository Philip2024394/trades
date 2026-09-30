// src/lib/nex-native/first-conversation/__tests__/provisional-fingerprint.test.ts
//
// Bridge 99 · Stage 5a · provisional-fingerprint pure tests.
// No DB, no framework. Exercises every §7A whitelist / rotation /
// verify property.

import { describe, it, expect } from "vitest";

import {
  __ALLOWED_KEYS_FOR_TESTS,
  assertProvisionalFingerprintConfig,
  computeProvisionalFingerprint,
  loadProvisionalFingerprintConfigFromEnv,
  verifyProvisionalFingerprint,
  type ProvisionalFingerprintConfig,
  type ProvisionalFingerprintInput,
} from "../provisional-fingerprint";

const SALT_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; // 32 chars
const SALT_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SALT_C = "cccccccccccccccccccccccccccccccc";

function cfg(activeSalt: string, accepted: string[]): ProvisionalFingerprintConfig {
  return { activeSalt, acceptedSalts: accepted };
}

function makeInput(
  overrides: Partial<ProvisionalFingerprintInput> = {},
): ProvisionalFingerprintInput {
  return {
    device_id: "device-1",
    ua_class: "chromium",
    ip_24_bucket: "203.0.113",
    tz_offset_minutes: -480,
    accept_language_primary: "en",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// §7A whitelist enforcement
// ---------------------------------------------------------------------------

describe("§7A whitelist · structural authority", () => {
  it("exposes exactly the five sealed signals · no more no less", () => {
    // If this test fails, someone added or removed a signal without
    // updating the sealed doctrine. Treat as blocking.
    expect(__ALLOWED_KEYS_FOR_TESTS()).toEqual(
      [
        "accept_language_primary",
        "device_id",
        "ip_24_bucket",
        "tz_offset_minutes",
        "ua_class",
      ].sort(),
    );
  });

  it("throws with the doctrine-amendment message when an unknown key is supplied", () => {
    const withExtra = {
      ...makeInput(),
      // Unknown field · doctrinally forbidden
      canvas_hash: "abc123",
    } as unknown as ProvisionalFingerprintInput;
    expect(() =>
      computeProvisionalFingerprint(withExtra, cfg(SALT_A, [SALT_A])),
    ).toThrow(/signal whitelist violation per §7A/);
  });

  it("throws when a required whitelist key is missing", () => {
    const missing = {
      ua_class: "chromium",
      ip_24_bucket: "203.0.113",
      tz_offset_minutes: -480,
      accept_language_primary: "en",
    } as unknown as ProvisionalFingerprintInput;
    expect(() =>
      computeProvisionalFingerprint(missing, cfg(SALT_A, [SALT_A])),
    ).toThrow(/missing required signal 'device_id'/);
  });
});

// ---------------------------------------------------------------------------
// Individual signal validation
// ---------------------------------------------------------------------------

describe("input shape · per-signal validation", () => {
  const c = cfg(SALT_A, [SALT_A]);
  it("rejects empty device_id", () => {
    expect(() =>
      computeProvisionalFingerprint(makeInput({ device_id: "" }), c),
    ).toThrow(/device_id/);
  });
  it("rejects ua_class outside the four-value enum", () => {
    expect(() =>
      computeProvisionalFingerprint(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeInput({ ua_class: "safari" as any }),
        c,
      ),
    ).toThrow(/ua_class/);
  });
  it("rejects full IP (four octets) in ip_24_bucket", () => {
    expect(() =>
      computeProvisionalFingerprint(
        makeInput({ ip_24_bucket: "203.0.113.42" }),
        c,
      ),
    ).toThrow(/ip_24_bucket/);
  });
  it("rejects non-integer tz_offset_minutes", () => {
    expect(() =>
      computeProvisionalFingerprint(
        makeInput({ tz_offset_minutes: 4.5 }),
        c,
      ),
    ).toThrow(/tz_offset_minutes/);
  });
  it("rejects accept_language_primary with a region subtag", () => {
    expect(() =>
      computeProvisionalFingerprint(
        makeInput({ accept_language_primary: "en-US" }),
        c,
      ),
    ).toThrow(/accept_language_primary/);
  });
  it("rejects primitive/array inputs", () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      computeProvisionalFingerprint("not-an-object" as any, c),
    ).toThrow(/plain object/);
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      computeProvisionalFingerprint([] as any, c),
    ).toThrow(/plain object/);
  });
});

// ---------------------------------------------------------------------------
// Config guards
// ---------------------------------------------------------------------------

describe("assertProvisionalFingerprintConfig", () => {
  it("accepts a valid config", () => {
    expect(() =>
      assertProvisionalFingerprintConfig(cfg(SALT_A, [SALT_A])),
    ).not.toThrow();
    expect(() =>
      assertProvisionalFingerprintConfig(cfg(SALT_A, [SALT_A, SALT_B])),
    ).not.toThrow();
  });
  it("rejects short activeSalt", () => {
    expect(() =>
      assertProvisionalFingerprintConfig({
        activeSalt: "shortsalt",
        acceptedSalts: ["shortsalt"],
      }),
    ).toThrow(/at least 32/);
  });
  it("rejects activeSalt missing from acceptedSalts", () => {
    expect(() =>
      assertProvisionalFingerprintConfig(cfg(SALT_A, [SALT_B])),
    ).toThrow(/activeSalt must be present in acceptedSalts/);
  });
  it("rejects empty acceptedSalts list", () => {
    expect(() =>
      assertProvisionalFingerprintConfig(cfg(SALT_A, [])),
    ).toThrow(/non-empty array/);
  });
  it("rejects a short accepted-salt entry", () => {
    expect(() =>
      assertProvisionalFingerprintConfig(cfg(SALT_A, [SALT_A, "short"])),
    ).toThrow(/at least 32/);
  });
});

// ---------------------------------------------------------------------------
// Compute · determinism + sensitivity
// ---------------------------------------------------------------------------

describe("computeProvisionalFingerprint · determinism", () => {
  const c = cfg(SALT_A, [SALT_A]);
  it("same input + same salt → same hash", () => {
    const a = computeProvisionalFingerprint(makeInput(), c);
    const b = computeProvisionalFingerprint(makeInput(), c);
    expect(a).toBe(b);
  });

  it("output is url-safe base64 · no '+' '/' '='", () => {
    const h = computeProvisionalFingerprint(makeInput(), c);
    expect(h).not.toMatch(/[=+/]/);
    // SHA-256 → 32 bytes → base64url ~43 chars
    expect(h.length).toBeGreaterThanOrEqual(40);
    expect(h.length).toBeLessThanOrEqual(50);
  });
});

describe("computeProvisionalFingerprint · signal sensitivity (each signal matters)", () => {
  const c = cfg(SALT_A, [SALT_A]);
  const base = makeInput();
  const baseHash = computeProvisionalFingerprint(base, c);
  const cases: Array<[string, Partial<ProvisionalFingerprintInput>]> = [
    ["device_id", { device_id: "device-2" }],
    ["ua_class", { ua_class: "webkit" }],
    ["ip_24_bucket", { ip_24_bucket: "198.51.100" }],
    ["tz_offset_minutes", { tz_offset_minutes: 0 }],
    ["accept_language_primary", { accept_language_primary: "id" }],
  ];
  for (const [name, patch] of cases) {
    it(`changing ${name} changes the hash`, () => {
      const other = computeProvisionalFingerprint(
        makeInput(patch),
        c,
      );
      expect(other).not.toBe(baseHash);
    });
  }

  it("changing the salt changes the hash", () => {
    const withA = computeProvisionalFingerprint(makeInput(), cfg(SALT_A, [SALT_A]));
    const withB = computeProvisionalFingerprint(makeInput(), cfg(SALT_B, [SALT_B]));
    expect(withA).not.toBe(withB);
  });

  it("normalises accept_language_primary case (en == EN)", () => {
    const lower = computeProvisionalFingerprint(
      makeInput({ accept_language_primary: "en" }),
      c,
    );
    const upper = computeProvisionalFingerprint(
      makeInput({ accept_language_primary: "EN" }),
      c,
    );
    expect(lower).toBe(upper);
  });
});

// ---------------------------------------------------------------------------
// Verify · rotation semantics
// ---------------------------------------------------------------------------

describe("verifyProvisionalFingerprint · rotation semantics", () => {
  it("verifies a hash computed under the active salt", () => {
    const c = cfg(SALT_A, [SALT_A]);
    const h = computeProvisionalFingerprint(makeInput(), c);
    expect(verifyProvisionalFingerprint(h, makeInput(), c)).toBe(true);
  });

  it("verifies a hash computed under a PREVIOUS salt during rotation overlap", () => {
    const oldCfg = cfg(SALT_A, [SALT_A]);
    const rotatedCfg = cfg(SALT_B, [SALT_B, SALT_A]);
    const h = computeProvisionalFingerprint(makeInput(), oldCfg);
    expect(verifyProvisionalFingerprint(h, makeInput(), rotatedCfg)).toBe(true);
  });

  it("does NOT verify a hash whose salt was dropped from acceptedSalts", () => {
    const oldCfg = cfg(SALT_A, [SALT_A]);
    const rotatedCfg = cfg(SALT_B, [SALT_B]);
    const h = computeProvisionalFingerprint(makeInput(), oldCfg);
    expect(verifyProvisionalFingerprint(h, makeInput(), rotatedCfg)).toBe(false);
  });

  it("does NOT verify a hash when the input signals differ", () => {
    const c = cfg(SALT_A, [SALT_A]);
    const h = computeProvisionalFingerprint(makeInput(), c);
    expect(
      verifyProvisionalFingerprint(
        h,
        makeInput({ device_id: "different" }),
        c,
      ),
    ).toBe(false);
  });

  it("does NOT verify malformed hash strings", () => {
    const c = cfg(SALT_A, [SALT_A]);
    expect(verifyProvisionalFingerprint("garbage", makeInput(), c)).toBe(false);
    expect(verifyProvisionalFingerprint("", makeInput(), c)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Env loader
// ---------------------------------------------------------------------------

describe("loadProvisionalFingerprintConfigFromEnv", () => {
  it("parses active + accepted list", () => {
    const c = loadProvisionalFingerprintConfigFromEnv({
      NEX_FINGERPRINT_SALT_ACTIVE: SALT_A,
      NEX_FINGERPRINT_SALT_ACCEPTED: `${SALT_A},${SALT_B}`,
    } as NodeJS.ProcessEnv);
    expect(c.activeSalt).toBe(SALT_A);
    expect(c.acceptedSalts).toEqual([SALT_A, SALT_B]);
  });

  it("throws when ACTIVE is missing", () => {
    expect(() =>
      loadProvisionalFingerprintConfigFromEnv({
        NEX_FINGERPRINT_SALT_ACCEPTED: SALT_A,
      } as NodeJS.ProcessEnv),
    ).toThrow(/NEX_FINGERPRINT_SALT_ACTIVE/);
  });

  it("throws when ACCEPTED is missing", () => {
    expect(() =>
      loadProvisionalFingerprintConfigFromEnv({
        NEX_FINGERPRINT_SALT_ACTIVE: SALT_A,
      } as NodeJS.ProcessEnv),
    ).toThrow(/NEX_FINGERPRINT_SALT_ACCEPTED/);
  });

  it("trims whitespace and drops empty entries in accepted list", () => {
    const c = loadProvisionalFingerprintConfigFromEnv({
      NEX_FINGERPRINT_SALT_ACTIVE: SALT_A,
      NEX_FINGERPRINT_SALT_ACCEPTED: ` ${SALT_A} ,,  ${SALT_B}  `,
    } as NodeJS.ProcessEnv);
    expect(c.acceptedSalts).toEqual([SALT_A, SALT_B]);
  });
});

// ---------------------------------------------------------------------------
// Structural · never returns an account_id
// ---------------------------------------------------------------------------

describe("doctrinal isolation · fingerprint module never touches identity", () => {
  it("source does NOT import from nex_account or session-registry or resolver", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/provisional-fingerprint.ts",
      ),
      "utf-8",
    );
    // No account-service import
    expect(src).not.toMatch(/from ["'].*account-service["']/);
    // No session-registry-service import
    expect(src).not.toMatch(/from ["'].*session-registry-service["']/);
    // No provisional-session (resolver) import
    expect(src).not.toMatch(/from ["'].*provisional-session["']/);
    // No supabase-admin import (pure module · no DB)
    expect(src).not.toMatch(/from ["'].*supabase-admin["']/);
    // No .from(...) query builder calls (pure module · no DB)
    expect(src).not.toMatch(/\.from\(["'][a-z_]+["']\)/);
  });

  it("source does NOT expose any function whose name suggests identity resolution", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/provisional-fingerprint.ts",
      ),
      "utf-8",
    );
    // No exported function like getAccountByFingerprint / resolveAccount /
    // findAccountFor / etc.
    expect(src).not.toMatch(/export\s+(async\s+)?function\s+\w*(?:getAccount|findAccount|resolveAccount)\w*/i);
  });
});
