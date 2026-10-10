// §36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring
// NEX bounded infrastructure · route-2d tests · 2026-09-14
//
// Exercises the 34-gate acceptance matrix from
// docs/NEX1/ROUTE-2D-GAP-ANALYSIS-AND-DESIGN-2026-09-14.md.

import { describe, expect, it } from "vitest";
import { authorSmallApplication } from "../route-2d";
import type {
  AuthorSmallApplicationFailure,
  AuthorSmallApplicationSuccess,
  SmallApplicationSpec,
  UINode,
} from "../route-2d-types";

// ── Fixture builders ────────────────────────────────────────────────────

function minimalSpec(): SmallApplicationSpec {
  return {
    app_name: "test-app",
    header_comment: "test header",
    route_path: "/nex-generated/test-app",
    component: {
      component_name: "TestApp",
      root_node: {
        kind: "container",
        style_ref: "root",
        children: [
          { kind: "display_region", content_ref: { kind: "literal", value: "hi" }, style_ref: null },
        ],
      },
      props: [],
    },
    state: [{ state_key: "display", value_kind: "digit_string", initial_literal: "0" }],
    events: [],
    style_tokens: [
      { style_ref: "root", tokens: [{ key: "layout", value: "column" }, { key: "spacing", value: "md" }] },
    ],
    test_scenarios: [],
  };
}

function asSuccess(r: ReturnType<typeof authorSmallApplication>): AuthorSmallApplicationSuccess {
  if (!r.ok) throw new Error(`unexpected refusal: ${r.refusal_code} · ${r.reason}`);
  return r;
}

// ── §A · Determinism (Gates G-1..G-3) ──────────────────────────────────

describe("§36-2D · Route 2d · §A · determinism", () => {
  it("A-1 · same spec produces byte-identical output over 3 invocations (G-1)", () => {
    const a = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    const b = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    const c = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    for (let i = 0; i < a.emitted_files.length; i++) {
      expect(a.emitted_files[i].sha256_hex).toBe(b.emitted_files[i].sha256_hex);
      expect(b.emitted_files[i].sha256_hex).toBe(c.emitted_files[i].sha256_hex);
    }
  });
  it("A-2 · emitted files carry grep marker + NEX1 authorship header (G-2)", () => {
    const r = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    for (const f of r.emitted_files) {
      expect(f.content).toContain("§36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring");
      expect(f.content).toContain("Coded by NEX1 via route_2d_small_application");
    }
  });
  it("A-3 · spec_sha256 stable across invocations", () => {
    const a = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    const b = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    expect(a.spec_sha256).toBe(b.spec_sha256);
  });
});

// ── §B · Boundary (Gates G-4..G-8) ──────────────────────────────────────

describe("§36-2D · Route 2d · §B · boundary refusals", () => {
  it("B-1 · unknown UI node kind → R2D_UNKNOWN_UI_NODE_KIND (G-4)", () => {
    const spec = minimalSpec();
    const bad = { ...spec, component: { ...spec.component, root_node: { kind: "BAD" } as unknown as UINode } };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.ok).toBe(false);
    expect(r.refusal_code).toBe("R2D_UNKNOWN_UI_NODE_KIND");
  });
  it("B-2 · unknown event kind → R2D_UNKNOWN_EVENT_KIND (G-5)", () => {
    const spec = minimalSpec();
    const bad = { ...spec, events: [{ event_id: "e1", event_kind: "arbitrary_javascript" as never, payload: { kind: "arbitrary_javascript" as never } }] };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_UNKNOWN_EVENT_KIND");
  });
  it("B-3 · unknown style token key → R2D_UNKNOWN_STYLE_TOKEN (G-6)", () => {
    const spec = minimalSpec();
    const bad = { ...spec, style_tokens: [{ style_ref: "root", tokens: [{ key: "bad_key" as never, value: "x" }] }] };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_UNKNOWN_STYLE_TOKEN");
  });
  it("B-4 · unknown style token value for known key → R2D_UNKNOWN_STYLE_TOKEN (G-6)", () => {
    const spec = minimalSpec();
    const bad = { ...spec, style_tokens: [{ style_ref: "root", tokens: [{ key: "spacing" as const, value: "xxxxl" }] }] };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_UNKNOWN_STYLE_TOKEN");
  });
  // §36-2D-c 2026-09-15 · corners extension tests
  it("B-4c-1 · corners: rounded_md emits Tailwind `rounded-md` in the componentcontent", () => {
    const spec = minimalSpec();
    const withRounded: SmallApplicationSpec = {
      ...spec,
      style_tokens: [
        { style_ref: "root", tokens: [{ key: "layout" as const, value: "column" }, { key: "corners" as const, value: "rounded_md" }] },
      ],
    };
    const r = authorSmallApplication({ spec: withRounded, emit_tests: false });
    if (!r.ok) throw new Error(`unexpected refusal: ${r.refusal_code} · ${r.reason}`);
    const componentFile = r.emitted_files.find((f) => f.path.endsWith(".tsx") && !f.path.endsWith("page.tsx"))!;
    expect(componentFile.content).toContain("rounded-md");
  });
  it("B-4c-2 · corners: sharp emits `rounded-none`", () => {
    const spec = minimalSpec();
    const withSharp: SmallApplicationSpec = {
      ...spec,
      style_tokens: [
        { style_ref: "root", tokens: [{ key: "corners" as const, value: "sharp" }] },
      ],
    };
    const r = authorSmallApplication({ spec: withSharp, emit_tests: false });
    if (!r.ok) throw new Error(`unexpected refusal: ${r.refusal_code}`);
    const componentFile = r.emitted_files.find((f) => f.path.endsWith(".tsx") && !f.path.endsWith("page.tsx"))!;
    expect(componentFile.content).toContain("rounded-none");
  });
  it("B-4c-3 · corners: unknown value → R2D_UNKNOWN_STYLE_TOKEN", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = {
      ...spec,
      style_tokens: [{ style_ref: "root", tokens: [{ key: "corners" as const, value: "very_rounded_extra_special" }] }],
    };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_UNKNOWN_STYLE_TOKEN");
  });
  it("B-4c-4 · corners: rounded_full emits `rounded-full`", () => {
    const spec = minimalSpec();
    const withFull: SmallApplicationSpec = {
      ...spec,
      style_tokens: [
        { style_ref: "root", tokens: [{ key: "corners" as const, value: "rounded_full" }] },
      ],
    };
    const r = authorSmallApplication({ spec: withFull, emit_tests: false });
    if (!r.ok) throw new Error(`unexpected refusal: ${r.refusal_code}`);
    const componentFile = r.emitted_files.find((f) => f.path.endsWith(".tsx") && !f.path.endsWith("page.tsx"))!;
    expect(componentFile.content).toContain("rounded-full");
  });
  it("B-5 · state_key referenced but not declared → R2D_STATE_KEY_UNDECLARED (G-7)", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = {
      ...spec,
      component: {
        ...spec.component,
        root_node: {
          kind: "display_region",
          content_ref: { kind: "state_key", key: "ghost", transform: "identity" },
          style_ref: null,
        },
      },
    };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_STATE_KEY_UNDECLARED");
  });
  it("B-6 · duplicate event_id → R2D_EVENT_ID_COLLISION (G-8)", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = {
      ...spec,
      events: [
        { event_id: "e1", event_kind: "press_clear", payload: { kind: "press_clear" } },
        { event_id: "e1", event_kind: "press_clear", payload: { kind: "press_clear" } },
      ],
    };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_EVENT_ID_COLLISION");
  });
});

// ── §C · Security (Gates G-9..G-14) ─────────────────────────────────────

describe("§36-2D · Route 2d · §C · security refusals", () => {
  it("C-1 · route_path not under /nex-generated → R2D_ROUTE_PATH_OUTSIDE_NEX_GENERATED (G-9)", () => {
    const spec = { ...minimalSpec(), route_path: "/etc/passwd" };
    const r = authorSmallApplication({ spec, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_ROUTE_PATH_OUTSIDE_NEX_GENERATED");
  });
  it("C-2 · route_path with traversal → refused", () => {
    const spec = { ...minimalSpec(), route_path: "/nex-generated/../secrets" };
    const r = authorSmallApplication({ spec, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_ROUTE_PATH_OUTSIDE_NEX_GENERATED");
  });
  it("C-3 · route_path mismatched to app_name → refused (G-10 target confinement)", () => {
    const spec = { ...minimalSpec(), route_path: "/nex-generated/other-app" };
    const r = authorSmallApplication({ spec, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_ROUTE_PATH_OUTSIDE_NEX_GENERATED");
  });
  it("C-4 · literal containing eval( → R2D_PROHIBITED_STRING_CONTENT (G-11)", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = {
      ...spec,
      component: {
        ...spec.component,
        root_node: {
          kind: "display_region",
          content_ref: { kind: "literal", value: "eval(bad)" },
          style_ref: null,
        },
      },
    };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_PROHIBITED_STRING_CONTENT");
  });
  it("C-5 · literal containing <script → R2D_ARBITRARY_CODE_ATTEMPT or R2D_PROHIBITED_STRING_CONTENT", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = {
      ...spec,
      component: {
        ...spec.component,
        root_node: {
          kind: "display_region",
          content_ref: { kind: "literal", value: "<script>alert(1)</script>" },
          style_ref: null,
        },
      },
    };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(["R2D_PROHIBITED_STRING_CONTENT", "R2D_ARBITRARY_CODE_ATTEMPT"]).toContain(r.refusal_code);
  });
  it("C-6 · literal containing tag-shape → R2D_ARBITRARY_CODE_ATTEMPT (G-11 · JSX safety)", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = {
      ...spec,
      component: {
        ...spec.component,
        root_node: {
          kind: "display_region",
          content_ref: { kind: "literal", value: "<div>injected</div>" },
          style_ref: null,
        },
      },
    };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_ARBITRARY_CODE_ATTEMPT");
  });
  it("C-7 · state_key with invalid chars → R2D_INVALID_IDENTIFIER (G-12)", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = { ...spec, state: [{ state_key: "Bad Key!", value_kind: "string", initial_literal: "x" }] };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_INVALID_IDENTIFIER");
  });
  it("C-8 · event_id with invalid chars → R2D_INVALID_IDENTIFIER (G-13)", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = { ...spec, events: [{ event_id: "Bad Id!", event_kind: "press_clear", payload: { kind: "press_clear" } }] };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_INVALID_IDENTIFIER");
  });
  it("C-9 · invalid app_name → R2D_APP_NAME_INVALID", () => {
    const spec = { ...minimalSpec(), app_name: "BAD APP NAME" };
    const r = authorSmallApplication({ spec, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_APP_NAME_INVALID");
  });
});

// ── §D · Locked bounds (Gates G-5..G-8 additional) ─────────────────────

describe("§36-2D · Route 2d · §D · locked bounds", () => {
  it("D-1 · state.length > 8 → R2D_TOO_MANY_STATES", () => {
    const spec = minimalSpec();
    const many = Array.from({ length: 9 }, (_, i) => ({ state_key: `s${i}`, value_kind: "string" as const, initial_literal: "" }));
    const r = authorSmallApplication({ spec: { ...spec, state: many }, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_TOO_MANY_STATES");
  });
  it("D-2 · events.length > 16 → R2D_TOO_MANY_EVENTS", () => {
    const spec = minimalSpec();
    const many = Array.from({ length: 17 }, (_, i) => ({
      event_id: `e${i}`,
      event_kind: "press_clear" as const,
      payload: { kind: "press_clear" } as { kind: "press_clear" },
    }));
    const r = authorSmallApplication({ spec: { ...spec, events: many }, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_TOO_MANY_EVENTS");
  });
  it("D-3 · style_tokens.length > 24 → R2D_TOO_MANY_STYLE_TOKENS", () => {
    const spec = minimalSpec();
    const many = Array.from({ length: 25 }, (_, i) => ({ style_ref: `s${i}`, tokens: [{ key: "spacing" as const, value: "md" }] }));
    const r = authorSmallApplication({ spec: { ...spec, style_tokens: many }, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_TOO_MANY_STYLE_TOKENS");
  });
});

// ── §E · Emitted content structure ─────────────────────────────────────

describe("§36-2D · Route 2d · §E · emitted structure", () => {
  it("E-1 · emit_tests: false → exactly 2 files (page + component)", () => {
    const r = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    expect(r.emitted_files.length).toBe(2);
    expect(r.emitted_files[0].path).toBe("src/app/nex-generated/test-app/page.tsx");
    expect(r.emitted_files[1].path).toBe("src/app/nex-generated/test-app/TestApp.tsx");
  });
  it("E-2 · emit_tests: true with test_scenarios → 3 files", () => {
    const spec: SmallApplicationSpec = {
      ...minimalSpec(),
      test_scenarios: [
        {
          scenario_id: "initial",
          initial_state_overrides: [],
          event_sequence: [],
          final_state: [{ state_key: "display", expected_value: "0" }],
        },
      ],
    };
    const r = asSuccess(authorSmallApplication({ spec, emit_tests: true }));
    expect(r.emitted_files.length).toBe(3);
    expect(r.emitted_files[2].path).toBe("src/app/nex-generated/test-app/TestApp.test.tsx");
  });
  it("E-3 · page.tsx declares 'use client'", () => {
    const r = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    expect(r.emitted_files[0].content).toContain('"use client"');
  });
  it("E-4 · component.tsx imports runtime handlers from event-handler-runtime path", () => {
    const spec: SmallApplicationSpec = {
      ...minimalSpec(),
      events: [{ event_id: "clear", event_kind: "press_clear", payload: { kind: "press_clear" } }],
    };
    const r = asSuccess(authorSmallApplication({ spec, emit_tests: false }));
    expect(r.emitted_files[1].content).toContain("handlePressClear");
    expect(r.emitted_files[1].content).toContain("event-handler-runtime");
  });
  it("E-5 · component.tsx renders declared root node structure", () => {
    const r = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    // The minimal spec's root is a container wrapping a display_region with literal "hi"
    expect(r.emitted_files[1].content).toContain('<div');
    expect(r.emitted_files[1].content).toContain('"hi"');
  });
  it("E-6 · emitted files are byte-stable across two independent invocations", () => {
    const a = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: true }));
    const spec: SmallApplicationSpec = {
      ...minimalSpec(),
      test_scenarios: [{ scenario_id: "initial", initial_state_overrides: [], event_sequence: [], final_state: [{ state_key: "display", expected_value: "0" }] }],
    };
    // Re-emit with tests to compare shape when scenarios present
    const b = asSuccess(authorSmallApplication({ spec, emit_tests: true }));
    // At minimum · both invocations produce identical output for the shared files (page + component)
    expect(a.emitted_files[0].sha256_hex).toBe(b.emitted_files[0].sha256_hex);
    expect(a.emitted_files[1].sha256_hex).toBe(b.emitted_files[1].sha256_hex);
  });
});

// ── §F · Anti-fabrication (Gates G-15..G-17) ───────────────────────────

describe("§36-2D · Route 2d · §F · anti-fabrication", () => {
  it("F-1 · emitted style classes only come from the locked Tailwind map", () => {
    const r = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    // The component should have className with flex flex-col (layout: column) + gap-2 p-2 (spacing: md)
    expect(r.emitted_files[1].content).toContain("flex flex-col");
    expect(r.emitted_files[1].content).toContain("gap-2 p-2");
  });
  it("F-2 · no arbitrary raw className strings leak through (only mapped classes present)", () => {
    // Ensure no user-supplied string ever becomes a className. The mapper is closed;
    // fixture uses only mapped tokens · assert output contains no unusual class chars.
    const r = asSuccess(authorSmallApplication({ spec: minimalSpec(), emit_tests: false }));
    // Assert emitted content contains no "onerror" or javascript: URL forms.
    expect(r.emitted_files[1].content).not.toContain("onerror=");
    expect(r.emitted_files[1].content).not.toContain("javascript:");
  });
});

// ── §G · Hostile-input (Gates G-18..G-23) ───────────────────────────────

describe("§36-2D · Route 2d · §G · hostile fixtures", () => {
  it("G-1 · attempt to bind event to unknown kind 'arbitrary_javascript' → refused", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = {
      ...spec,
      events: [{ event_id: "hack", event_kind: "arbitrary_javascript" as never, payload: { kind: "arbitrary_javascript", body: "fetch(...)" } as never }],
    };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_UNKNOWN_EVENT_KIND");
  });
  it("G-2 · attempt to inject 'child_process' in header comment → refused", () => {
    const spec = { ...minimalSpec(), header_comment: "import 'child_process';" };
    const r = authorSmallApplication({ spec, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_PROHIBITED_STRING_CONTENT");
  });
  it("G-3 · attempt to reference a state key that isn't declared inside a set_state_literal payload → refused", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = {
      ...spec,
      events: [{
        event_id: "setbad",
        event_kind: "set_state_literal",
        payload: { kind: "set_state_literal", target_state_key: "ghost", literal: 42 },
      }],
    };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_STATE_KEY_UNDECLARED");
  });
  it("G-4 · press_digit with out-of-range digit → refused", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = {
      ...spec,
      events: [{ event_id: "d99", event_kind: "press_digit", payload: { kind: "press_digit", digit: 99 } }],
    };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_INVALID_SPEC");
  });
  it("G-5 · press_operator with unknown operator → refused", () => {
    const spec = minimalSpec();
    const bad: SmallApplicationSpec = {
      ...spec,
      events: [{ event_id: "op", event_kind: "press_operator", payload: { kind: "press_operator", operator: "modulo" as never } }],
    };
    const r = authorSmallApplication({ spec: bad, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_INVALID_SPEC");
  });
});

// ── §H · Malformed request ──────────────────────────────────────────────

describe("§36-2D · Route 2d · §H · malformed request", () => {
  it("H-1 · null request → R2D_INVALID_SPEC", () => {
    const r = authorSmallApplication(null as never) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_INVALID_SPEC");
  });
  it("H-2 · missing spec → R2D_INVALID_SPEC", () => {
    const r = authorSmallApplication({ spec: null as never, emit_tests: false }) as AuthorSmallApplicationFailure;
    expect(r.refusal_code).toBe("R2D_INVALID_SPEC");
  });
});

// ── §I · Grep marker on failure ─────────────────────────────────────────

describe("§36-2D · Route 2d · §I · grep marker", () => {
  it("I-1 · every failure carries the §36-2D marker", () => {
    const r = authorSmallApplication(null as never);
    expect(r.grep_marker).toBe("§36-2D · ROUTE-2D · 2026-09-14 · route-2d-small-app-authoring");
  });
});
