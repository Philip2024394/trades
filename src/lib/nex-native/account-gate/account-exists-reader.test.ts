// src/lib/nex-native/account-gate/account-exists-reader.test.ts
//
// Unit tests for the sealed account-gate reader.
//
// Coverage matrix:
//   1. Anonymous (resolver returns null)              · accountExists=false, signedInWithoutAccount=false
//   2. Signed-in-with-account                         · accountExists=true,  signedInWithoutAccount=false
//   3. Signed-in-no-account (transient)               · accountExists=false, signedInWithoutAccount=true
//   4. Session with account.id null                   · accountExists=false, signedInWithoutAccount=true
//   5. Session with empty-string supabaseUserId       · accountExists=false, signedInWithoutAccount=false
//   6. Session with non-string account.id             · accountExists=false, signedInWithoutAccount=true
//   7. Resolver throws · safe-default                 · accountExists=false, signedInWithoutAccount=false
//   8. Resolver returns garbage object                · accountExists=false, signedInWithoutAccount=false

import { describe, it, expect } from "vitest";
import { readAccountExists } from "./account-exists-reader";

describe("readAccountExists", () => {
  it("anonymous visitor (resolver returns null) → both false", async () => {
    const snap = await readAccountExists({
      resolveSession: async () => null,
    });
    expect(snap).toEqual({ accountExists: false, signedInWithoutAccount: false });
  });

  it("signed-in-with-account → accountExists true", async () => {
    const snap = await readAccountExists({
      resolveSession: async () => ({
        supabaseUserId: "sb-user-123",
        email: "x@y.z",
        account: { id: "11111111-1111-1111-1111-111111111111" },
      }),
    });
    expect(snap.accountExists).toBe(true);
    expect(snap.signedInWithoutAccount).toBe(false);
  });

  it("signed-in-without-account (account null) → signedInWithoutAccount true", async () => {
    const snap = await readAccountExists({
      resolveSession: async () => ({
        supabaseUserId: "sb-user-123",
        email: null,
        account: null,
      }),
    });
    expect(snap.accountExists).toBe(false);
    expect(snap.signedInWithoutAccount).toBe(true);
  });

  it("session with account.id null → signedInWithoutAccount true", async () => {
    const snap = await readAccountExists({
      resolveSession: async () => ({
        supabaseUserId: "sb-user-456",
        account: { id: null },
      }),
    });
    expect(snap).toEqual({ accountExists: false, signedInWithoutAccount: true });
  });

  it("session with empty-string supabaseUserId → both false (treat as unknown)", async () => {
    const snap = await readAccountExists({
      resolveSession: async () => ({
        supabaseUserId: "",
        account: null,
      }),
    });
    expect(snap).toEqual({ accountExists: false, signedInWithoutAccount: false });
  });

  it("session with non-string account.id → treated as missing", async () => {
    const snap = await readAccountExists({
      resolveSession: async () => ({
        supabaseUserId: "sb-user-789",
        // Simulate corrupted shape where id came back as a number
        account: { id: 42 as unknown as string },
      }),
    });
    expect(snap).toEqual({ accountExists: false, signedInWithoutAccount: true });
  });

  it("resolver throws → safe default (both false, lock stays on)", async () => {
    const snap = await readAccountExists({
      resolveSession: async () => {
        throw new Error("boom · DB unreachable");
      },
    });
    expect(snap).toEqual({ accountExists: false, signedInWithoutAccount: false });
  });

  it("resolver returns a garbage object → both false", async () => {
    const snap = await readAccountExists({
      resolveSession: async () => ({ not: "a session" }),
    });
    expect(snap).toEqual({ accountExists: false, signedInWithoutAccount: false });
  });
});
