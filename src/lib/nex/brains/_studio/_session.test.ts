import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Server-only import guard — vitest reads server-only via a
// no-op shim. Force it manually here.
vi.mock("server-only", () => ({}));

const ORIGINALS = {
  allow:  process.env.NEX_AUTHOR_ALLOWLIST,
  invite: process.env.NEX_AUTHOR_INVITE_SECRET,
  cookie: process.env.NEX_AUTHOR_COOKIE_SECRET
};

beforeEach(() => {
  process.env.NEX_AUTHOR_ALLOWLIST      = "alice@example.com, bob@example.com";
  process.env.NEX_AUTHOR_INVITE_SECRET  = "a".repeat(48);
  process.env.NEX_AUTHOR_COOKIE_SECRET  = "b".repeat(48);
});
afterEach(() => {
  for (const [name, val] of Object.entries({
    NEX_AUTHOR_ALLOWLIST:     ORIGINALS.allow,
    NEX_AUTHOR_INVITE_SECRET: ORIGINALS.invite,
    NEX_AUTHOR_COOKIE_SECRET: ORIGINALS.cookie
  })) {
    if (val == null) delete process.env[name];
    else process.env[name] = val;
  }
});

async function importSession() {
  const mod = await import("./_session");
  return mod;
}

describe("Author Studio session", () => {
  it("rejects invite for un-allowlisted Author id", async () => {
    const { issueInviteToken } = await importSession();
    expect(() => issueInviteToken("stranger@example.com")).toThrow();
  });

  it("issues a valid invite token for allowlisted Author id", async () => {
    const { issueInviteToken, verifyInviteToken } = await importSession();
    const token = issueInviteToken("alice@example.com");
    const result = verifyInviteToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.authorId).toBe("alice@example.com");
  });

  it("rejects a tampered token", async () => {
    const { issueInviteToken, verifyInviteToken } = await importSession();
    const token = issueInviteToken("alice@example.com");
    const tampered = token.slice(0, -3) + "aaa";
    const result = verifyInviteToken(tampered);
    expect(result.ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    const { issueInviteToken, verifyInviteToken } = await importSession();
    const token = issueInviteToken("alice@example.com", -1);
    const result = verifyInviteToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("cookie value round-trips for allowlisted Author", async () => {
    const { authorCookieValue, verifyAuthorCookie } = await importSession();
    const cookie = authorCookieValue("bob@example.com");
    expect(verifyAuthorCookie(cookie)).toBe("bob@example.com");
  });

  it("cookie value rejected for tampered signature", async () => {
    const { authorCookieValue, verifyAuthorCookie } = await importSession();
    const cookie = authorCookieValue("bob@example.com");
    expect(verifyAuthorCookie(cookie.slice(0, -3) + "aaa")).toBeNull();
  });

  it("rejects cookies for Authors no longer on the allowlist", async () => {
    const { authorCookieValue, verifyAuthorCookie } = await importSession();
    const cookie = authorCookieValue("bob@example.com");
    // Rotate: remove bob from allowlist.
    process.env.NEX_AUTHOR_ALLOWLIST = "alice@example.com";
    expect(verifyAuthorCookie(cookie)).toBeNull();
  });
});
