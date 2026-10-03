// src/lib/nex-native/__tests__/surface-health.test.ts
//
// Contract tests for §12 Item 1 of the Chat Surfaces × Visual Themes
// × HQ Diagnostics doctrine (sealed 2026-10-03). Covers the four
// invariants the foundation layer must enforce:
//
//   1. failure_signature derivation is deterministic across callers
//      and dimensions (same input → same hash; no raw error text or
//      conversation content enters the computation at the type level).
//   2. Lifecycle legal-transition set matches the sealed doctrine §7.3
//      exactly (closed set · terminal states terminal).
//   3. recordFailure() dedups against non-terminal rows for the same
//      failure_signature.
//   4. transitionLifecycle() rejects illegal transitions and the
//      verify-while-active guard refuses verified when another row
//      with the same signature is still fallback-active or ongoing.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Supabase admin mock (hoisted BEFORE service import) ────────────

interface MockRow {
  id: string;
  correlation_id: string | null;
  surface: string;
  visual_theme: string;
  component_module: string;
  occurred_at: string;
  error_classification: string;
  recovery_action: string;
  app_version: string | null;
  theme_version: string | null;
  client_environment: unknown | null;
  failure_signature: string;
  lifecycle_state: string;
  state_history: unknown[];
  occurrence_count: number;
  created_at: string;
  updated_at: string;
}

interface MockStore {
  rows: MockRow[];
}

const store: MockStore = { rows: [] };

vi.mock("../supabase-admin", () => {
  // Minimal query builder that supports the two shapes used by the
  // service: insert().select().single(), update().eq().select().single(),
  // select().eq().maybeSingle(), select().eq().in().order().
  const makeBuilder = () => {
    const state: {
      op: "select" | "insert" | "update";
      payload: Record<string, unknown> | null;
      filters: { col: string; val: unknown }[];
      inFilter: { col: string; values: unknown[] } | null;
      orderCol: string | null;
    } = {
      op: "select",
      payload: null,
      filters: [],
      inFilter: null,
      orderCol: null,
    };
    const resolveQuery = (): MockRow[] => {
      let rows = [...store.rows];
      for (const f of state.filters) {
        rows = rows.filter(
          (r) => (r as unknown as Record<string, unknown>)[f.col] === f.val,
        );
      }
      if (state.inFilter) {
        rows = rows.filter((r) =>
          state.inFilter!.values.includes(
            (r as unknown as Record<string, unknown>)[state.inFilter!.col],
          ),
        );
      }
      if (state.orderCol === "occurred_at") {
        rows.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
      }
      return rows;
    };
    const builder: {
      insert: (p: Record<string, unknown>) => typeof builder;
      update: (p: Record<string, unknown>) => typeof builder;
      select: (cols?: string) => typeof builder;
      eq: (col: string, val: unknown) => typeof builder;
      in: (col: string, values: unknown[]) => typeof builder;
      order: (col: string, opts?: { ascending?: boolean }) => typeof builder;
      maybeSingle: () => { data: MockRow | null; error: null };
      single: () => { data: MockRow | null; error: { message: string } | null };
      then: (resolve: (v: { data: MockRow[]; error: null }) => void) => void;
    } = {
      insert(p) {
        state.op = "insert";
        state.payload = p;
        return builder;
      },
      update(p) {
        state.op = "update";
        state.payload = p;
        return builder;
      },
      select() {
        return builder;
      },
      eq(col, val) {
        state.filters.push({ col, val });
        return builder;
      },
      in(col, values) {
        state.inFilter = { col, values };
        return builder;
      },
      order(col) {
        state.orderCol = col;
        return builder;
      },
      maybeSingle() {
        const rows = resolveQuery();
        return { data: rows[0] ?? null, error: null };
      },
      single() {
        if (state.op === "insert" && state.payload) {
          const now = new Date().toISOString();
          const row: MockRow = {
            id: `row-${store.rows.length + 1}`,
            correlation_id:
              (state.payload.correlation_id as string | null | undefined) ?? null,
            surface: state.payload.surface as string,
            visual_theme: state.payload.visual_theme as string,
            component_module: state.payload.component_module as string,
            occurred_at: now,
            error_classification: state.payload.error_classification as string,
            recovery_action: state.payload.recovery_action as string,
            app_version:
              (state.payload.app_version as string | null | undefined) ?? null,
            theme_version:
              (state.payload.theme_version as string | null | undefined) ?? null,
            client_environment:
              (state.payload.client_environment as unknown) ?? null,
            failure_signature: state.payload.failure_signature as string,
            lifecycle_state: state.payload.lifecycle_state as string,
            state_history: (state.payload.state_history as unknown[]) ?? [],
            occurrence_count:
              (state.payload.occurrence_count as number | undefined) ?? 1,
            created_at: now,
            updated_at: now,
          };
          store.rows.push(row);
          return { data: row, error: null };
        }
        if (state.op === "update" && state.payload) {
          const rows = resolveQuery();
          const target = rows[0];
          if (!target) return { data: null, error: { message: "no row" } };
          const now = new Date().toISOString();
          Object.assign(target, state.payload, { updated_at: now });
          return { data: target, error: null };
        }
        const rows = resolveQuery();
        return { data: rows[0] ?? null, error: null };
      },
      then(resolve) {
        resolve({ data: resolveQuery(), error: null });
      },
    };
    return builder;
  };
  return {
    nexSupabaseAdmin: {
      from: vi.fn(() => makeBuilder()),
    },
    nexSupabaseProjectRef: () => "test-project",
  };
});

// Mock correlation module so the service doesn't need an ALS scope.
vi.mock("@/lib/nex/observability/correlation", () => ({
  getCorrelationId: () => "test-correlation-id",
}));

// Silence the logger during tests.
vi.mock("@/lib/nex/observability/logger", () => ({
  logger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

import {
  deriveFailureSignature,
  recordFailure,
  transitionLifecycle,
  getById,
  listNonTerminalBySignature,
} from "../surface-health-service";
import {
  LIFECYCLE_STATES,
  LEGAL_TRANSITIONS,
  TERMINAL_STATES,
  isLegalTransition,
  type LifecycleState,
} from "../surface-health/lifecycle";

beforeEach(() => {
  store.rows = [];
  vi.clearAllMocks();
});

// ─── 1. failure_signature determinism ───────────────────────────────

describe("surface-health · failure_signature derivation", () => {
  it("is deterministic across identical inputs", () => {
    const input = {
      surface: "peer-chat",
      visual_theme: "pink-dream",
      component_module: "bubble-renderer",
      error_classification: "render_runtime_error" as const,
      app_version: "1.0.0",
      theme_version: "2026-09-30",
    };
    expect(deriveFailureSignature(input)).toBe(deriveFailureSignature(input));
  });

  it("normalises case + whitespace so cosmetic differences dedup together", () => {
    const a = deriveFailureSignature({
      surface: "PEER-CHAT",
      visual_theme: "pink-dream",
      component_module: " bubble-renderer ",
      error_classification: "render_runtime_error",
      app_version: null,
      theme_version: null,
    });
    const b = deriveFailureSignature({
      surface: "peer-chat",
      visual_theme: "pink-dream",
      component_module: "bubble-renderer",
      error_classification: "render_runtime_error",
      app_version: null,
      theme_version: null,
    });
    expect(a).toBe(b);
  });

  it("differs when any sealed dimension differs", () => {
    const base = {
      surface: "peer-chat",
      visual_theme: "pink-dream",
      component_module: "bubble-renderer",
      error_classification: "render_runtime_error" as const,
      app_version: "1.0.0",
      theme_version: "2026-09-30",
    };
    expect(deriveFailureSignature(base)).not.toBe(
      deriveFailureSignature({ ...base, surface: "depth-cards" }),
    );
    expect(deriveFailureSignature(base)).not.toBe(
      deriveFailureSignature({ ...base, visual_theme: "night-sky" }),
    );
    expect(deriveFailureSignature(base)).not.toBe(
      deriveFailureSignature({
        ...base,
        error_classification: "animation_runtime_error",
      }),
    );
    expect(deriveFailureSignature(base)).not.toBe(
      deriveFailureSignature({ ...base, app_version: "1.0.1" }),
    );
    expect(deriveFailureSignature(base)).not.toBe(
      deriveFailureSignature({ ...base, theme_version: "2026-10-01" }),
    );
  });

  it("returns a 32-char hex opaque identifier · no input leakage", () => {
    const sig = deriveFailureSignature({
      surface: "peer-chat",
      visual_theme: "pink-dream",
      component_module: "bubble-renderer",
      error_classification: "render_runtime_error",
      app_version: null,
      theme_version: null,
    });
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    expect(sig).not.toContain("peer-chat");
    expect(sig).not.toContain("pink-dream");
  });
});

// ─── 2. Lifecycle state machine contract ────────────────────────────

describe("surface-health · lifecycle contract", () => {
  it("has exactly seven states", () => {
    expect(LIFECYCLE_STATES.length).toBe(7);
  });

  it("marks recovered and verified as terminal", () => {
    expect(TERMINAL_STATES.has("recovered")).toBe(true);
    expect(TERMINAL_STATES.has("verified")).toBe(true);
    expect(TERMINAL_STATES.size).toBe(2);
  });

  it("permits exactly the sealed-doctrine transitions and no others", () => {
    const expected: Record<LifecycleState, LifecycleState[]> = {
      detected: ["recovered", "fallback-active"],
      recovered: [],
      "fallback-active": ["ongoing", "investigating"],
      ongoing: ["investigating"],
      investigating: ["fixed"],
      fixed: ["verified"],
      verified: [],
    };
    for (const s of LIFECYCLE_STATES) {
      expect([...LEGAL_TRANSITIONS[s]].sort()).toEqual(expected[s].sort());
    }
  });

  it("rejects transitions outside the closed set", () => {
    expect(isLegalTransition("detected", "investigating")).toBe(false);
    expect(isLegalTransition("fallback-active", "verified")).toBe(false);
    expect(isLegalTransition("recovered", "detected")).toBe(false);
    expect(isLegalTransition("verified", "ongoing")).toBe(false);
  });
});

// ─── 3. recordFailure dedup ─────────────────────────────────────────

describe("surface-health · recordFailure dedup", () => {
  const sampleInput = {
    surface: "peer-chat",
    visual_theme: "pink-dream",
    component_module: "bubble-renderer",
    error_classification: "render_runtime_error" as const,
    recovery_action: "fallback" as const,
  };

  it("inserts a new row on first occurrence", async () => {
    const row = await recordFailure(sampleInput);
    expect(row.occurrence_count).toBe(1);
    expect(row.lifecycle_state).toBe("fallback-active");
    expect(row.state_history.length).toBe(2); // detected → fallback-active
    expect(row.correlation_id).toBe("test-correlation-id");
    expect(store.rows.length).toBe(1);
  });

  it("dedup-updates when the same signature is still non-terminal", async () => {
    await recordFailure(sampleInput);
    const second = await recordFailure(sampleInput);
    expect(store.rows.length).toBe(1);
    expect(second.occurrence_count).toBe(2);
    expect(second.lifecycle_state).toBe("fallback-active");
  });

  it("inserts a NEW row when the prior incident has terminated", async () => {
    const first = await recordFailure({
      ...sampleInput,
      recovery_action: "retry",
    });
    expect(first.lifecycle_state).toBe("recovered"); // terminal
    const second = await recordFailure(sampleInput);
    expect(store.rows.length).toBe(2);
    expect(second.occurrence_count).toBe(1);
  });

  it("rejects an unknown error_classification", async () => {
    await expect(
      recordFailure({
        ...sampleInput,
        // @ts-expect-error — testing runtime validation
        error_classification: "not_a_real_classification",
      }),
    ).rejects.toThrow(/unknown error_classification/);
  });

  it("rejects an unknown recovery_action", async () => {
    await expect(
      recordFailure({
        ...sampleInput,
        // @ts-expect-error — testing runtime validation
        recovery_action: "panic",
      }),
    ).rejects.toThrow(/unknown recovery_action/);
  });
});

// ─── 4. transitionLifecycle guards ──────────────────────────────────

describe("surface-health · transitionLifecycle", () => {
  const sampleInput = {
    surface: "peer-chat",
    visual_theme: "pink-dream",
    component_module: "bubble-renderer",
    error_classification: "render_runtime_error" as const,
    recovery_action: "fallback" as const,
  };

  it("walks the full happy path: fallback-active → ongoing → investigating → fixed → verified", async () => {
    const row = await recordFailure(sampleInput);
    const r1 = await transitionLifecycle(row.id, "ongoing");
    expect(r1.lifecycle_state).toBe("ongoing");
    const r2 = await transitionLifecycle(row.id, "investigating");
    expect(r2.lifecycle_state).toBe("investigating");
    const r3 = await transitionLifecycle(row.id, "fixed");
    expect(r3.lifecycle_state).toBe("fixed");
    const r4 = await transitionLifecycle(row.id, "verified");
    expect(r4.lifecycle_state).toBe("verified");
    expect(r4.state_history.length).toBeGreaterThanOrEqual(6);
  });

  it("rejects illegal transitions", async () => {
    const row = await recordFailure(sampleInput);
    await expect(
      transitionLifecycle(row.id, "verified"),
    ).rejects.toThrow(/illegal fallback-active → verified/);
    await expect(
      transitionLifecycle(row.id, "detected"),
    ).rejects.toThrow(/illegal fallback-active → detected/);
  });

  it("rejects transitions out of a terminal state", async () => {
    const row = await recordFailure({
      ...sampleInput,
      recovery_action: "retry",
    });
    expect(row.lifecycle_state).toBe("recovered");
    await expect(
      transitionLifecycle(row.id, "ongoing"),
    ).rejects.toThrow(/recovered is terminal/);
  });

  it("verify-while-active guard: refuses verified while another row of the same signature is fallback-active", async () => {
    // Row A: full path to fixed · ready to verify.
    const a = await recordFailure(sampleInput);
    await transitionLifecycle(a.id, "ongoing");
    await transitionLifecycle(a.id, "investigating");
    await transitionLifecycle(a.id, "fixed");

    // Row B: a NEW incident with the SAME signature pops up on another
    // environment. To exercise this scenario we flip row A's signature
    // temporarily so the dedup miss creates a second row, then restore
    // it to prove the guard activates.
    const bRow = { ...a, id: "row-synthetic", lifecycle_state: "fallback-active" };
    store.rows.push({
      ...bRow,
      state_history: [],
      occurrence_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      occurred_at: new Date().toISOString(),
    });

    await expect(
      transitionLifecycle(a.id, "verified"),
    ).rejects.toThrow(/cannot verify while 1 row\(s\)/);
  });

  it("rejects raw error text (>240 chars) in the reason field", async () => {
    const row = await recordFailure(sampleInput);
    await transitionLifecycle(row.id, "ongoing");
    const longReason = "x".repeat(241);
    await expect(
      transitionLifecycle(row.id, "investigating", longReason),
    ).rejects.toThrow(/raw error text or conversation content is forbidden/);
  });
});

// ─── 5. listNonTerminalBySignature ──────────────────────────────────

describe("surface-health · listNonTerminalBySignature", () => {
  it("returns only non-terminal rows", async () => {
    const sampleInput = {
      surface: "peer-chat",
      visual_theme: "pink-dream",
      component_module: "bubble-renderer",
      error_classification: "render_runtime_error" as const,
      recovery_action: "fallback" as const,
    };
    const r1 = await recordFailure(sampleInput);
    const r2 = await recordFailure({ ...sampleInput, visual_theme: "night-sky" });
    // Walk r2 to terminal state.
    await transitionLifecycle(r2.id, "ongoing");
    await transitionLifecycle(r2.id, "investigating");
    await transitionLifecycle(r2.id, "fixed");
    await transitionLifecycle(r2.id, "verified");

    const r1Signature = (await getById(r1.id))!.failure_signature;
    const r2Signature = (await getById(r2.id))!.failure_signature;

    const activeR1 = await listNonTerminalBySignature(r1Signature);
    const activeR2 = await listNonTerminalBySignature(r2Signature);
    expect(activeR1.length).toBe(1);
    expect(activeR2.length).toBe(0);
  });
});
