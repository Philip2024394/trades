// src/lib/nex-native/__tests__/theme-kill-switch.test.ts
//
// §12 Item 3 · theme-kill-switch service contract tests.
// Mocks nexSupabaseAdmin · no real DB needed.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  name: string;
  is_active: boolean;
  updated_at: string;
}

const store: { rows: Row[]; failNextMaybeSingle: boolean } = {
  rows: [],
  failNextMaybeSingle: false,
};

vi.mock("../supabase-admin", () => {
  const makeBuilder = () => {
    const state: {
      op: "select" | "update";
      payload: Record<string, unknown> | null;
      filters: Array<{ col: string; val: unknown }>;
      orderCol: string | null;
      orderAsc: boolean;
    } = {
      op: "select",
      payload: null,
      filters: [],
      orderCol: null,
      orderAsc: true,
    };
    const resolve = (): Row[] => {
      let rows = [...store.rows];
      for (const f of state.filters) {
        rows = rows.filter((r) => (r as unknown as Record<string, unknown>)[f.col] === f.val);
      }
      if (state.orderCol === "name") {
        rows.sort((a, b) => (state.orderAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
      }
      return rows;
    };
    const builder: {
      select: (c?: string) => typeof builder;
      update: (p: Record<string, unknown>) => typeof builder;
      eq: (col: string, val: unknown) => typeof builder;
      order: (col: string, opts?: { ascending?: boolean }) => typeof builder;
      maybeSingle: () => { data: Row | null; error: null };
      single: () => { data: Row | null; error: { message: string } | null };
      then: (resolver: (v: { data: Row[]; error: null }) => void) => void;
    } = {
      select() { return builder; },
      update(p) { state.op = "update"; state.payload = p; return builder; },
      eq(col, val) { state.filters.push({ col, val }); return builder; },
      order(col, opts) { state.orderCol = col; state.orderAsc = opts?.ascending ?? true; return builder; },
      maybeSingle() {
        if (store.failNextMaybeSingle) {
          store.failNextMaybeSingle = false;
          return {
            data: null,
            error: { message: "simulated DB failure DB_RAW_CANARY_9A4F2B at nex_chat_theme" },
          } as unknown as { data: Row | null; error: null };
        }
        const rows = resolve();
        return { data: rows[0] ?? null, error: null };
      },
      single() {
        if (state.op === "update" && state.payload) {
          const rows = resolve();
          const target = rows[0];
          if (!target) return { data: null, error: { message: "no row" } };
          Object.assign(target, state.payload, { updated_at: new Date().toISOString() });
          return { data: target, error: null };
        }
        return { data: resolve()[0] ?? null, error: null };
      },
      then(resolver) {
        resolver({ data: resolve(), error: null });
      },
    };
    return builder;
  };
  return {
    nexSupabaseAdmin: { from: vi.fn(() => makeBuilder()) },
    nexSupabaseProjectRef: () => "test-project",
  };
});

// Spyable logger mock · tests can inspect what the service logged.
const loggerCalls: { level: string; msg: string; fields: Record<string, unknown> | undefined }[] = [];
vi.mock("@/lib/nex/observability/logger", () => ({
  logger: () => ({
    debug: (msg: string, fields?: Record<string, unknown>) => {
      loggerCalls.push({ level: "debug", msg, fields });
    },
    info: (msg: string, fields?: Record<string, unknown>) => {
      loggerCalls.push({ level: "info", msg, fields });
    },
    warn: (msg: string, fields?: Record<string, unknown>) => {
      loggerCalls.push({ level: "warn", msg, fields });
    },
    error: (msg: string, fields?: Record<string, unknown>) => {
      loggerCalls.push({ level: "error", msg, fields });
    },
  }),
}));
const fetchCalls: unknown[] = [];
beforeEach(() => {
  fetchCalls.length = 0;
  loggerCalls.length = 0;
  (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(async (...args: unknown[]) => {
    fetchCalls.push(args);
    return new Response(null, { status: 202 });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  vi.restoreAllMocks();
});

import {
  isThemeKillSwitched,
  isThemeKillSwitchedSafe,
  listThemeKillSwitchStatus,
  setThemeKillSwitched,
} from "../theme-kill-switch";

beforeEach(() => {
  store.rows = [
    { id: "pink-dream", name: "Pink Dream", is_active: true, updated_at: "2026-10-03T00:00:00Z" },
    { id: "night-sky", name: "Night Sky", is_active: true, updated_at: "2026-10-03T00:00:00Z" },
    { id: "theme-0", name: "Joker", is_active: false, updated_at: "2026-10-03T00:00:00Z" },
  ];
});

describe("theme-kill-switch · read helpers", () => {
  it("isThemeKillSwitched returns false for an active theme", async () => {
    expect(await isThemeKillSwitched("pink-dream")).toBe(false);
  });

  it("isThemeKillSwitched returns true for an inactive theme", async () => {
    expect(await isThemeKillSwitched("theme-0")).toBe(true);
  });

  it("isThemeKillSwitched returns false for an unknown theme (safe default)", async () => {
    expect(await isThemeKillSwitched("does-not-exist")).toBe(false);
  });

  it("listThemeKillSwitchStatus reports every theme with is_kill_switched derived from is_active", async () => {
    const rows = await listThemeKillSwitchStatus();
    const byId = Object.fromEntries(rows.map((r) => [r.theme_id, r]));
    expect(byId["pink-dream"]?.is_kill_switched).toBe(false);
    expect(byId["night-sky"]?.is_kill_switched).toBe(false);
    expect(byId["theme-0"]?.is_kill_switched).toBe(true);
  });
});

// Finding #2 · isThemeKillSwitchedSafe is the fail-safe wrapper the
// pilot page uses. Must never throw. On lookup failure must return
// `false` (safe default · theme not kill-switched) AND emit a
// normalized error log containing no raw error.message or stack.
describe("theme-kill-switch · isThemeKillSwitchedSafe (Finding #2 fail-safe)", () => {
  it("returns the real value when the service succeeds (identity for active theme)", async () => {
    expect(await isThemeKillSwitchedSafe("pink-dream")).toBe(false);
  });

  it("returns true when the service resolves to a kill-switched theme", async () => {
    expect(await isThemeKillSwitchedSafe("theme-0")).toBe(true);
  });

  it("returns false (safe default) when the underlying lookup fails", async () => {
    store.failNextMaybeSingle = true;
    expect(await isThemeKillSwitchedSafe("pink-dream")).toBe(false);
  });

  it("emits a normalized error log · structured fields only · no raw message", async () => {
    store.failNextMaybeSingle = true;
    await isThemeKillSwitchedSafe("pink-dream");
    const errorLogs = loggerCalls.filter((l) => l.level === "error");
    expect(errorLogs.length).toBeGreaterThanOrEqual(1);
    const log = errorLogs[0]!;
    expect(log.msg).toBe("kill_switch_lookup_failed");
    expect(log.fields).toEqual({ theme_id: "pink-dream", safe_default: "not_kill_switched" });
    // Raw error-text canaries from the mock must not appear in the log fields.
    const serialised = JSON.stringify(log);
    expect(serialised).not.toContain("DB_RAW_CANARY_9A4F2B");
    expect(serialised).not.toContain("simulated DB failure");
    expect(serialised).not.toContain("nex_chat_theme");
  });

  it("does not propagate the throw · the caller continues normally", async () => {
    store.failNextMaybeSingle = true;
    // No try/catch here · if the function throws, the test fails.
    const value = await isThemeKillSwitchedSafe("pink-dream");
    expect(typeof value).toBe("boolean");
  });

  it("does not mutate the database on failure", async () => {
    const before = store.rows.map((r) => ({ id: r.id, is_active: r.is_active }));
    store.failNextMaybeSingle = true;
    await isThemeKillSwitchedSafe("pink-dream");
    const after = store.rows.map((r) => ({ id: r.id, is_active: r.is_active }));
    expect(after).toEqual(before);
  });
});

describe("theme-kill-switch · setThemeKillSwitched", () => {
  it("flips is_active to false when disabled=true and emits the audit event", async () => {
    const status = await setThemeKillSwitched({
      theme_id: "pink-dream",
      disabled: true,
      actor: "admin",
      reason: "unit test",
    });
    expect(status.is_kill_switched).toBe(true);
    expect(status.is_active).toBe(false);
    // Audit event emitted via fetch to /api/nex/events.
    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
    const [url, init] = fetchCalls[0] as [string, { body?: string }];
    expect(url).toContain("/api/nex/events");
    const body = JSON.parse(init.body ?? "{}");
    expect(body.event_type).toBe("theme_kill_switch");
    expect(body.payload.theme_id).toBe("pink-dream");
    expect(body.payload.disabled).toBe(true);
    expect(body.payload.reason).toBe("unit test");
  });

  it("flips is_active to true when disabled=false (re-enabling)", async () => {
    const status = await setThemeKillSwitched({
      theme_id: "theme-0",
      disabled: false,
      actor: "admin",
    });
    expect(status.is_kill_switched).toBe(false);
    expect(status.is_active).toBe(true);
  });

  it("rejects missing theme_id", async () => {
    await expect(
      // @ts-expect-error — testing runtime guard
      setThemeKillSwitched({ disabled: true, actor: "admin" }),
    ).rejects.toThrow(/theme_id required/);
  });

  it("rejects non-boolean disabled", async () => {
    await expect(
      // @ts-expect-error — testing runtime guard
      setThemeKillSwitched({ theme_id: "pink-dream", disabled: "yes", actor: "admin" }),
    ).rejects.toThrow(/disabled must be boolean/);
  });

  it("rejects missing actor", async () => {
    await expect(
      // @ts-expect-error — testing runtime guard
      setThemeKillSwitched({ theme_id: "pink-dream", disabled: true }),
    ).rejects.toThrow(/actor required/);
  });

  it("rejects reason longer than 240 chars (content-safety guard)", async () => {
    const longReason = "x".repeat(241);
    await expect(
      setThemeKillSwitched({
        theme_id: "pink-dream",
        disabled: true,
        actor: "admin",
        reason: longReason,
      }),
    ).rejects.toThrow(/raw error text or conversation content is forbidden/);
  });
});
