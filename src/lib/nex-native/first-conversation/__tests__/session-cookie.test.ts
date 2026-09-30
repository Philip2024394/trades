// src/lib/nex-native/first-conversation/__tests__/session-cookie.test.ts
//
// Bridge 99 · Stage 4c · session-cookie boundary tests (pure, no DB).
// Uses an in-memory NexCookieAdapter fake so every attribute sealed §7
// mandates is asserted deterministically.

import { describe, it, expect } from "vitest";

import {
  NEX_SESSION_COOKIE_NAME,
  writeNexSessionCookie,
  readNexSessionCookieToken,
  readAndVerifyNexSessionCookie,
  clearNexSessionCookie,
  loadNexSessionCookieConfigFromEnv,
  loadNexSessionCryptoConfigFromEnv,
  type NexCookieAdapter,
  type NexCookieWriteOptions,
  type NexCookieScope,
  type NexSessionCookieConfig,
} from "../session-cookie";
import {
  signSessionToken,
  type NexSessionCryptoConfig,
  type NexSessionPayload,
} from "../session-crypto";

// ---------------------------------------------------------------------------
// Fake cookie adapter · records every set/clear for assertion
// ---------------------------------------------------------------------------

interface WriteRecord {
  name: string;
  value: string;
  options: NexCookieWriteOptions;
}
interface ClearRecord {
  name: string;
  scope: NexCookieScope;
}
function makeFakeAdapter(): {
  adapter: NexCookieAdapter;
  writes: WriteRecord[];
  clears: ClearRecord[];
  seed(name: string, value: string): void;
} {
  const jar = new Map<string, string>();
  const writes: WriteRecord[] = [];
  const clears: ClearRecord[] = [];
  return {
    adapter: {
      read: (n) => jar.get(n),
      write: (n, v, o) => {
        jar.set(n, v);
        writes.push({ name: n, value: v, options: o });
      },
      clear: (n, scope) => {
        jar.delete(n);
        clears.push({ name: n, scope });
      },
    },
    writes,
    clears,
    seed: (n, v) => jar.set(n, v),
  };
}

const KEY_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const KEY_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const cryptoCfg: NexSessionCryptoConfig = {
  activeKey: KEY_A,
  acceptedKeys: [KEY_A],
};

function makePayload(
  overrides: Partial<NexSessionPayload> = {},
): NexSessionPayload {
  return {
    account_id: "11111111-1111-4111-8111-111111111111",
    session_id: "22222222-2222-4222-8222-222222222222",
    issued_at_ms: 1_000_000,
    expires_at_ms: 1_000_000 + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Cookie name is fixed
// ---------------------------------------------------------------------------

describe("NEX_SESSION_COOKIE_NAME", () => {
  it("is the sealed 'nex_session' identifier", () => {
    expect(NEX_SESSION_COOKIE_NAME).toBe("nex_session");
  });
});

// ---------------------------------------------------------------------------
// writeNexSessionCookie · attribute discipline
// ---------------------------------------------------------------------------

describe("writeNexSessionCookie · sealed §7 attribute discipline", () => {
  it("writes cookie under the fixed name with signed token as value", () => {
    const { adapter, writes } = makeFakeAdapter();
    const payload = makePayload();
    writeNexSessionCookie(
      adapter,
      payload,
      cryptoCfg,
      { secure: true, path: "/" },
      1_000_000,
    );
    expect(writes).toHaveLength(1);
    expect(writes[0].name).toBe("nex_session");
    // Value is signed via session-crypto · we compare against a fresh sign
    // to prove the module is producing a real signed token, not literal payload
    expect(writes[0].value).toBe(signSessionToken(payload, cryptoCfg));
  });

  it("sets HttpOnly=true (always)", () => {
    const { adapter, writes } = makeFakeAdapter();
    writeNexSessionCookie(
      adapter,
      makePayload(),
      cryptoCfg,
      { secure: true, path: "/" },
      1_000_000,
    );
    expect(writes[0].options.httpOnly).toBe(true);
  });

  it("sets SameSite=lax (always · sealed §7)", () => {
    const { adapter, writes } = makeFakeAdapter();
    writeNexSessionCookie(
      adapter,
      makePayload(),
      cryptoCfg,
      { secure: true, path: "/" },
      1_000_000,
    );
    expect(writes[0].options.sameSite).toBe("lax");
  });

  it("propagates Secure from config", () => {
    const { adapter, writes } = makeFakeAdapter();
    writeNexSessionCookie(
      adapter,
      makePayload(),
      cryptoCfg,
      { secure: false, path: "/" },
      1_000_000,
    );
    expect(writes[0].options.secure).toBe(false);

    writeNexSessionCookie(
      adapter,
      makePayload(),
      cryptoCfg,
      { secure: true, path: "/" },
      1_000_000,
    );
    expect(writes[1].options.secure).toBe(true);
  });

  it("propagates Domain when configured (shared-subdomain trust boundary)", () => {
    const { adapter, writes } = makeFakeAdapter();
    writeNexSessionCookie(
      adapter,
      makePayload(),
      cryptoCfg,
      { secure: true, path: "/", domain: ".nex.com" },
      1_000_000,
    );
    expect(writes[0].options.domain).toBe(".nex.com");
  });

  it("omits Domain when not configured (host-only cookie)", () => {
    const { adapter, writes } = makeFakeAdapter();
    writeNexSessionCookie(
      adapter,
      makePayload(),
      cryptoCfg,
      { secure: true, path: "/" },
      1_000_000,
    );
    expect(writes[0].options.domain).toBeUndefined();
  });

  it("propagates Path", () => {
    const { adapter, writes } = makeFakeAdapter();
    writeNexSessionCookie(
      adapter,
      makePayload(),
      cryptoCfg,
      { secure: true, path: "/scoped" },
      1_000_000,
    );
    expect(writes[0].options.path).toBe("/scoped");
  });

  it("computes Max-Age from expires_at_ms - now_ms (floor to seconds)", () => {
    const { adapter, writes } = makeFakeAdapter();
    const now = 1_000_000;
    const expires = now + 30 * 24 * 60 * 60 * 1000; // 30d
    writeNexSessionCookie(
      adapter,
      makePayload({ issued_at_ms: now, expires_at_ms: expires }),
      cryptoCfg,
      { secure: true, path: "/" },
      now,
    );
    expect(writes[0].options.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("floors Max-Age to seconds (drops sub-second fraction)", () => {
    const { adapter, writes } = makeFakeAdapter();
    const now = 1_000_000;
    // 60_500ms remaining → 60s (floor)
    writeNexSessionCookie(
      adapter,
      makePayload({ issued_at_ms: now, expires_at_ms: now + 60_500 }),
      cryptoCfg,
      { secure: true, path: "/" },
      now,
    );
    expect(writes[0].options.maxAge).toBe(60);
  });

  it("clamps Max-Age to 0 when expires_at_ms <= now_ms (never writes negative)", () => {
    const { adapter, writes } = makeFakeAdapter();
    const now = 1_000_000;
    writeNexSessionCookie(
      adapter,
      makePayload({ issued_at_ms: now - 1000, expires_at_ms: now - 100 }),
      cryptoCfg,
      { secure: true, path: "/" },
      now,
    );
    expect(writes[0].options.maxAge).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// readNexSessionCookieToken
// ---------------------------------------------------------------------------

describe("readNexSessionCookieToken", () => {
  it("returns the raw cookie value when present", () => {
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", "some.token");
    expect(readNexSessionCookieToken(adapter)).toBe("some.token");
  });

  it("returns null when the cookie is absent", () => {
    const { adapter } = makeFakeAdapter();
    expect(readNexSessionCookieToken(adapter)).toBeNull();
  });

  it("returns null when the cookie is present but empty string", () => {
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", "");
    expect(readNexSessionCookieToken(adapter)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readAndVerifyNexSessionCookie · signature + expiry only (no DB)
// ---------------------------------------------------------------------------

describe("readAndVerifyNexSessionCookie · signature + expiry check", () => {
  it("returns null when the cookie is absent", () => {
    const { adapter } = makeFakeAdapter();
    expect(readAndVerifyNexSessionCookie(adapter, cryptoCfg, 1_500_000)).toBeNull();
  });

  it("returns the parsed payload for a valid cookie", () => {
    const { adapter } = makeFakeAdapter();
    const payload = makePayload();
    writeNexSessionCookie(
      adapter,
      payload,
      cryptoCfg,
      { secure: true, path: "/" },
      1_000_000,
    );
    const r = readAndVerifyNexSessionCookie(adapter, cryptoCfg, 1_500_000);
    expect(r).not.toBeNull();
    expect(r?.verify.ok).toBe(true);
    if (r?.verify.ok) expect(r.verify.payload).toEqual(payload);
  });

  it("returns bad_signature when cookie was signed with a key not in acceptedKeys", () => {
    const { adapter } = makeFakeAdapter();
    const otherCfg: NexSessionCryptoConfig = {
      activeKey: KEY_B,
      acceptedKeys: [KEY_B],
    };
    writeNexSessionCookie(
      adapter,
      makePayload(),
      otherCfg,
      { secure: true, path: "/" },
      1_000_000,
    );
    const r = readAndVerifyNexSessionCookie(adapter, cryptoCfg, 1_500_000);
    expect(r).not.toBeNull();
    expect(r?.verify.ok).toBe(false);
    if (r && !r.verify.ok) expect(r.verify.reason).toBe("bad_signature");
  });

  it("returns expired when now >= expires_at_ms", () => {
    const { adapter } = makeFakeAdapter();
    const now = 1_000_000;
    const payload = makePayload({
      issued_at_ms: now,
      expires_at_ms: now + 60_000,
    });
    writeNexSessionCookie(
      adapter,
      payload,
      cryptoCfg,
      { secure: true, path: "/" },
      now,
    );
    const r = readAndVerifyNexSessionCookie(adapter, cryptoCfg, now + 61_000);
    expect(r?.verify.ok).toBe(false);
    if (r && !r.verify.ok) expect(r.verify.reason).toBe("expired");
  });

  it("returns malformed on garbage cookie value", () => {
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", "not-a-token");
    const r = readAndVerifyNexSessionCookie(adapter, cryptoCfg, 1_500_000);
    expect(r?.verify.ok).toBe(false);
    if (r && !r.verify.ok) expect(r.verify.reason).toBe("malformed");
  });

  it("returns the raw token alongside failure reasons for logging", () => {
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", "garbage.value");
    const r = readAndVerifyNexSessionCookie(adapter, cryptoCfg, 1_500_000);
    expect(r?.token).toBe("garbage.value");
  });
});

// ---------------------------------------------------------------------------
// clearNexSessionCookie
// ---------------------------------------------------------------------------

describe("clearNexSessionCookie", () => {
  it("issues a clear call under the fixed name with matching Domain/Path", () => {
    const { adapter, clears, seed } = makeFakeAdapter();
    seed("nex_session", "some.token");
    clearNexSessionCookie(adapter, {
      secure: true,
      domain: ".nex.com",
      path: "/",
    });
    expect(clears).toHaveLength(1);
    expect(clears[0].name).toBe("nex_session");
    expect(clears[0].scope).toEqual({ domain: ".nex.com", path: "/" });
  });

  it("passes undefined Domain through unchanged (host-only cookie)", () => {
    const { adapter, clears } = makeFakeAdapter();
    clearNexSessionCookie(adapter, { secure: true, path: "/" });
    expect(clears[0].scope).toEqual({ domain: undefined, path: "/" });
  });

  it("read after clear returns null", () => {
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", "some.token");
    clearNexSessionCookie(adapter, { secure: true, path: "/" });
    expect(readNexSessionCookieToken(adapter)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// End-to-end · write → read → verify → clear
// ---------------------------------------------------------------------------

describe("end-to-end · write → read → verify → clear", () => {
  it("round-trips a payload through the cookie boundary", () => {
    const { adapter } = makeFakeAdapter();
    const payload = makePayload();
    const now = 1_000_000;

    writeNexSessionCookie(
      adapter,
      payload,
      cryptoCfg,
      { secure: true, path: "/" },
      now,
    );

    const r = readAndVerifyNexSessionCookie(adapter, cryptoCfg, now + 1000);
    expect(r?.verify.ok).toBe(true);
    if (r?.verify.ok) expect(r.verify.payload).toEqual(payload);

    clearNexSessionCookie(adapter, { secure: true, path: "/" });
    const after = readAndVerifyNexSessionCookie(adapter, cryptoCfg, now + 2000);
    expect(after).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadNexSessionCookieConfigFromEnv
// ---------------------------------------------------------------------------

describe("loadNexSessionCookieConfigFromEnv", () => {
  it("defaults path to '/' when NEX_SESSION_COOKIE_PATH unset", () => {
    const cfg = loadNexSessionCookieConfigFromEnv({} as NodeJS.ProcessEnv);
    expect(cfg.path).toBe("/");
  });

  it("respects NEX_SESSION_COOKIE_PATH when set", () => {
    const cfg = loadNexSessionCookieConfigFromEnv({
      NEX_SESSION_COOKIE_PATH: "/scoped",
    } as NodeJS.ProcessEnv);
    expect(cfg.path).toBe("/scoped");
  });

  it("returns undefined domain when NEX_SESSION_COOKIE_DOMAIN unset", () => {
    const cfg = loadNexSessionCookieConfigFromEnv({} as NodeJS.ProcessEnv);
    expect(cfg.domain).toBeUndefined();
  });

  it("accepts a leading-dot domain (shared-subdomain scope)", () => {
    const cfg = loadNexSessionCookieConfigFromEnv({
      NEX_SESSION_COOKIE_DOMAIN: ".nex.com",
    } as NodeJS.ProcessEnv);
    expect(cfg.domain).toBe(".nex.com");
  });

  it("throws when NEX_SESSION_COOKIE_DOMAIN is set without a leading dot", () => {
    expect(() =>
      loadNexSessionCookieConfigFromEnv({
        NEX_SESSION_COOKIE_DOMAIN: "nex.com",
      } as NodeJS.ProcessEnv),
    ).toThrow(/must start with "\."/);
  });

  it("sets secure=true when NODE_ENV=production", () => {
    const cfg = loadNexSessionCookieConfigFromEnv({
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    expect(cfg.secure).toBe(true);
  });

  it("sets secure=false when NODE_ENV != production", () => {
    const cfg = loadNexSessionCookieConfigFromEnv({
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv);
    expect(cfg.secure).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadNexSessionCryptoConfigFromEnv
// ---------------------------------------------------------------------------

describe("loadNexSessionCryptoConfigFromEnv", () => {
  it("returns active + accepted list parsed from env", () => {
    const cfg = loadNexSessionCryptoConfigFromEnv({
      NEX_SESSION_SIGNING_KEY_ACTIVE: KEY_A,
      NEX_SESSION_SIGNING_KEY_ACCEPTED: `${KEY_A},${KEY_B}`,
    } as NodeJS.ProcessEnv);
    expect(cfg.activeKey).toBe(KEY_A);
    expect(cfg.acceptedKeys).toEqual([KEY_A, KEY_B]);
  });

  it("throws when NEX_SESSION_SIGNING_KEY_ACTIVE is unset", () => {
    expect(() =>
      loadNexSessionCryptoConfigFromEnv({
        NEX_SESSION_SIGNING_KEY_ACCEPTED: KEY_A,
      } as NodeJS.ProcessEnv),
    ).toThrow(/NEX_SESSION_SIGNING_KEY_ACTIVE/);
  });

  it("throws when NEX_SESSION_SIGNING_KEY_ACCEPTED is unset", () => {
    expect(() =>
      loadNexSessionCryptoConfigFromEnv({
        NEX_SESSION_SIGNING_KEY_ACTIVE: KEY_A,
      } as NodeJS.ProcessEnv),
    ).toThrow(/NEX_SESSION_SIGNING_KEY_ACCEPTED/);
  });

  it("trims whitespace and drops empty entries in the accepted list", () => {
    const cfg = loadNexSessionCryptoConfigFromEnv({
      NEX_SESSION_SIGNING_KEY_ACTIVE: KEY_A,
      NEX_SESSION_SIGNING_KEY_ACCEPTED: ` ${KEY_A} ,,  ${KEY_B}  `,
    } as NodeJS.ProcessEnv);
    expect(cfg.acceptedKeys).toEqual([KEY_A, KEY_B]);
  });
});
