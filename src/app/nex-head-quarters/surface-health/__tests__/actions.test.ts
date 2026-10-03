// src/app/nex-head-quarters/surface-health/__tests__/actions.test.ts
//
// §12 Item 3 · Server-Action contract tests for the HQ Surface-Health
// mutations. Covers:
//   · admin-token gate (missing env → rejected · wrong token → rejected
//     · correct token → ok)
//   · transition flows through Item 1 transitionLifecycle(id, 'investigating')
//   · kill-switch flows through theme-kill-switch service
//   · never surfaces raw error text to the caller

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transitionMock = vi.fn();
const setKillSwitchMock = vi.fn();

vi.mock("@/lib/nex-native/surface-health-service", () => ({
  transitionLifecycle: (...args: unknown[]) => transitionMock(...args),
}));
vi.mock("@/lib/nex-native/theme-kill-switch", () => ({
  setThemeKillSwitched: (...args: unknown[]) => setKillSwitchMock(...args),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { transitionAction, setKillSwitchAction } from "../_actions";

const CANARY = "LEAK_CANARY_7F3A";
const TOKEN = "test-admin-token-abc123";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  transitionMock.mockReset();
  setKillSwitchMock.mockReset();
  transitionMock.mockResolvedValue({});
  setKillSwitchMock.mockResolvedValue({});
});

afterEach(() => {
  delete process.env.NEX_HQ_ADMIN_TOKEN;
});

// ── admin-token gate ──────────────────────────────────────────────

describe("Server Actions · admin-token gate", () => {
  it("rejects when NEX_HQ_ADMIN_TOKEN is not set in env", async () => {
    delete process.env.NEX_HQ_ADMIN_TOKEN;
    const res = await transitionAction(null, fd({ id: "row-1", admin_token: "whatever" }));
    expect(res).toEqual({ ok: false, error: "admin_token_missing_in_env" });
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it("rejects when the submitted token does not match the env token", async () => {
    process.env.NEX_HQ_ADMIN_TOKEN = TOKEN;
    const res = await transitionAction(null, fd({ id: "row-1", admin_token: "wrong" }));
    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it("rejects when the admin_token field is missing", async () => {
    process.env.NEX_HQ_ADMIN_TOKEN = TOKEN;
    const res = await transitionAction(null, fd({ id: "row-1" }));
    expect(res.ok).toBe(false);
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it("accepts and routes to transitionLifecycle when the token matches", async () => {
    process.env.NEX_HQ_ADMIN_TOKEN = TOKEN;
    const res = await transitionAction(
      null,
      fd({ id: "row-1", admin_token: TOKEN, reason: "admin review" }),
    );
    expect(res).toEqual({ ok: true });
    expect(transitionMock).toHaveBeenCalledOnce();
    expect(transitionMock).toHaveBeenCalledWith("row-1", "investigating", "admin review");
  });
});

// ── transitionAction behaviour ─────────────────────────────────────

describe("transitionAction", () => {
  beforeEach(() => {
    process.env.NEX_HQ_ADMIN_TOKEN = TOKEN;
  });

  it("rejects when id is missing", async () => {
    const res = await transitionAction(null, fd({ admin_token: TOKEN }));
    expect(res).toEqual({ ok: false, error: "id_required" });
  });

  it("passes null reason when the field is empty", async () => {
    await transitionAction(null, fd({ id: "row-1", admin_token: TOKEN }));
    expect(transitionMock).toHaveBeenCalledWith("row-1", "investigating", null);
  });

  it("never surfaces raw error text when the service throws", async () => {
    transitionMock.mockRejectedValueOnce(
      new Error(`internal detail with ${CANARY} that should not leak`),
    );
    const res = await transitionAction(null, fd({ id: "row-1", admin_token: TOKEN }));
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res)).not.toContain(CANARY);
  });
});

// ── setKillSwitchAction behaviour ──────────────────────────────────

describe("setKillSwitchAction", () => {
  beforeEach(() => {
    process.env.NEX_HQ_ADMIN_TOKEN = TOKEN;
  });

  it("rejects when theme_id is missing", async () => {
    const res = await setKillSwitchAction(null, fd({ admin_token: TOKEN, actor: "admin" }));
    expect(res).toEqual({ ok: false, error: "theme_id_required" });
    expect(setKillSwitchMock).not.toHaveBeenCalled();
  });

  it("rejects when actor is missing", async () => {
    const res = await setKillSwitchAction(
      null,
      fd({ admin_token: TOKEN, theme_id: "pink-dream", disabled: "true" }),
    );
    expect(res).toEqual({ ok: false, error: "actor_required" });
    expect(setKillSwitchMock).not.toHaveBeenCalled();
  });

  it("parses disabled=true from the form", async () => {
    await setKillSwitchAction(
      null,
      fd({ admin_token: TOKEN, theme_id: "pink-dream", disabled: "true", actor: "admin" }),
    );
    expect(setKillSwitchMock).toHaveBeenCalledWith({
      theme_id: "pink-dream",
      disabled: true,
      actor: "admin",
      reason: null,
    });
  });

  it("parses disabled=false from the form", async () => {
    await setKillSwitchAction(
      null,
      fd({ admin_token: TOKEN, theme_id: "pink-dream", disabled: "false", actor: "admin" }),
    );
    expect(setKillSwitchMock).toHaveBeenCalledWith({
      theme_id: "pink-dream",
      disabled: false,
      actor: "admin",
      reason: null,
    });
  });

  it("forwards an optional reason", async () => {
    await setKillSwitchAction(
      null,
      fd({
        admin_token: TOKEN,
        theme_id: "pink-dream",
        disabled: "true",
        actor: "admin",
        reason: "temporary pause for investigation",
      }),
    );
    expect(setKillSwitchMock).toHaveBeenCalledWith({
      theme_id: "pink-dream",
      disabled: true,
      actor: "admin",
      reason: "temporary pause for investigation",
    });
  });

  it("never surfaces raw error text when the service throws (error containing · separators)", async () => {
    setKillSwitchMock.mockRejectedValueOnce(
      new Error(`db error · ${CANARY} · stack: foo`),
    );
    const res = await setKillSwitchAction(
      null,
      fd({ admin_token: TOKEN, theme_id: "pink-dream", disabled: "true", actor: "admin" }),
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("service_error");
    expect(JSON.stringify(res)).not.toContain(CANARY);
  });

  // Finding #1 strengthened coverage · the previous test coincidentally
  // passed only because the mocked error contained a '·' separator. This
  // case uses a canary-bearing message with NO separators to prove the
  // Server Action returns only the generic contract value and never
  // reflects any portion of error.message.
  it("never surfaces raw error text when the service throws (plain message · no separators)", async () => {
    const PLAIN_CANARY = "PLAIN_LEAK_CANARY_B49A2F";
    setKillSwitchMock.mockRejectedValueOnce(
      new Error(`Supabase connection refused ${PLAIN_CANARY} at table nex_chat_theme`),
    );
    const res = await setKillSwitchAction(
      null,
      fd({ admin_token: TOKEN, theme_id: "pink-dream", disabled: "true", actor: "admin" }),
    );
    expect(res).toEqual({ ok: false, error: "service_error" });
    expect(JSON.stringify(res)).not.toContain(PLAIN_CANARY);
    expect(JSON.stringify(res)).not.toContain("Supabase");
    expect(JSON.stringify(res)).not.toContain("nex_chat_theme");
    expect(JSON.stringify(res)).not.toContain("connection refused");
  });
});
