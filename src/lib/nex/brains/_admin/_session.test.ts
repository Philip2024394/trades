import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ORIG = {
  allow:  process.env.NEX_BRAIN_ADMIN_ALLOWLIST,
  invite: process.env.NEX_BRAIN_ADMIN_INVITE_SECRET,
  cookie: process.env.NEX_BRAIN_ADMIN_COOKIE_SECRET
};

beforeEach(() => {
  process.env.NEX_BRAIN_ADMIN_ALLOWLIST     = "reviewer1@example.com, reviewer2@example.com";
  process.env.NEX_BRAIN_ADMIN_INVITE_SECRET = "a".repeat(48);
  process.env.NEX_BRAIN_ADMIN_COOKIE_SECRET = "b".repeat(48);
});
afterEach(() => {
  for (const [name, val] of Object.entries({
    NEX_BRAIN_ADMIN_ALLOWLIST:     ORIG.allow,
    NEX_BRAIN_ADMIN_INVITE_SECRET: ORIG.invite,
    NEX_BRAIN_ADMIN_COOKIE_SECRET: ORIG.cookie
  })) {
    if (val == null) delete process.env[name];
    else process.env[name] = val;
  }
});

async function importSession() {
  return import("./_session");
}

describe("Brain Admin session", () => {
  it("rejects invite for un-allowlisted admin id", async () => {
    const { issueBrainAdminInviteToken } = await importSession();
    expect(() => issueBrainAdminInviteToken("stranger@example.com")).toThrow();
  });

  it("issues and verifies a valid invite token", async () => {
    const { issueBrainAdminInviteToken, verifyBrainAdminInviteToken } = await importSession();
    const token = issueBrainAdminInviteToken("reviewer1@example.com");
    const result = verifyBrainAdminInviteToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.adminId).toBe("reviewer1@example.com");
  });

  it("rejects a tampered token", async () => {
    const { issueBrainAdminInviteToken, verifyBrainAdminInviteToken } = await importSession();
    const token = issueBrainAdminInviteToken("reviewer1@example.com");
    expect(verifyBrainAdminInviteToken(token.slice(0, -3) + "aaa").ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    const { issueBrainAdminInviteToken, verifyBrainAdminInviteToken } = await importSession();
    const token = issueBrainAdminInviteToken("reviewer1@example.com", -1);
    expect(verifyBrainAdminInviteToken(token).ok).toBe(false);
  });

  it("round-trips cookie value", async () => {
    const { brainAdminCookieValue, verifyBrainAdminCookie } = await importSession();
    const cookie = brainAdminCookieValue("reviewer2@example.com");
    expect(verifyBrainAdminCookie(cookie)).toBe("reviewer2@example.com");
  });

  it("rejects cookie for admin removed from allowlist", async () => {
    const { brainAdminCookieValue, verifyBrainAdminCookie } = await importSession();
    const cookie = brainAdminCookieValue("reviewer2@example.com");
    process.env.NEX_BRAIN_ADMIN_ALLOWLIST = "reviewer1@example.com";
    expect(verifyBrainAdminCookie(cookie)).toBeNull();
  });
});
