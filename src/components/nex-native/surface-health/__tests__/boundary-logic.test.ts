// src/components/nex-native/surface-health/__tests__/boundary-logic.test.ts
//
// §12 Item 2 contract tests for the three boundary tiers and the
// shared boundary helpers. These tests exercise the class methods and
// pure logic directly · no DOM renderer is required (the repo does
// not install jsdom/happy-dom).
//
// Covers:
//   · classifyBoundaryError mapping is deterministic and closed-set.
//   · getDerivedStateFromError transitions each boundary to errored.
//   · componentDidCatch emits a NORMALIZED payload (no error.message,
//     no stack, no componentStack, no caller-supplied private text)
//     to the ingestion endpoint via fetch.
//   · Private content from caught errors never appears in the emitted
//     payload — proven with a distinctive synthetic private string
//     stuffed into error.message, error.stack and componentStack.
//   · emitSurfaceHealthEvent is fire-and-forget and swallows errors.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyBoundaryError,
  type BoundaryEmission,
} from "../boundary-shared";
import { ChatCoreBoundary } from "../ChatCoreBoundary";
import { VisualThemeBoundary } from "../VisualThemeBoundary";
import { OptionalVisualModuleBoundary } from "../OptionalVisualModuleBoundary";
import { ERROR_CLASSIFICATIONS } from "@/lib/nex-native/surface-health/classification";

const DISTINCTIVE_PRIVATE = "CONVERSATION_LEAK_CANARY_7E6F2A91";

interface CapturedCall {
  url: string;
  body: BoundaryEmission;
}

let captured: CapturedCall[] = [];

beforeEach(() => {
  captured = [];
  // Install a global fetch mock that records all boundary emissions.
  (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(
    async (url: unknown, init?: unknown) => {
      const i = init as { body?: string } | undefined;
      captured.push({
        url: String(url),
        body: JSON.parse(i?.body ?? "{}") as BoundaryEmission,
      });
      return new Response(null, { status: 202 });
    },
  ) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── classifyBoundaryError ─────────────────────────────────────────

describe("classifyBoundaryError", () => {
  it("maps module names to closed-set classifications", () => {
    expect(classifyBoundaryError("optional-visual-module", "bubble-renderer"))
      .toBe("bubble_renderer_error");
    expect(classifyBoundaryError("optional-visual-module", "haunted-smoke"))
      .toBe("animation_runtime_error");
    expect(classifyBoundaryError("optional-visual-module", "sticker-picker"))
      .toBe("sticker_renderer_error");
    expect(classifyBoundaryError("optional-visual-module", "emoji-picker"))
      .toBe("emoji_renderer_error");
    expect(classifyBoundaryError("chat-core", "composer-root"))
      .toBe("composer_render_error");
  });

  it("falls back to theme_bundle_load_failure for a Tier 2 unknown module", () => {
    expect(classifyBoundaryError("visual-theme", "theme-root"))
      .toBe("theme_bundle_load_failure");
  });

  it("falls back to render_runtime_error for Tier 1 unknown module", () => {
    expect(classifyBoundaryError("chat-core", "surface-root"))
      .toBe("render_runtime_error");
  });

  it("only returns values that are in the Item 1 closed set", () => {
    const modules = [
      "bubble-renderer",
      "haunted-smoke",
      "sticker-picker",
      "emoji-picker",
      "composer-root",
      "theme-root",
      "surface-root",
      "unknown-module",
    ];
    for (const m of modules) {
      for (const t of ["chat-core", "visual-theme", "optional-visual-module"] as const) {
        expect(ERROR_CLASSIFICATIONS).toContain(classifyBoundaryError(t, m));
      }
    }
  });
});

// ─── Boundary state transitions ────────────────────────────────────

describe("Boundary state transitions", () => {
  it("ChatCoreBoundary.getDerivedStateFromError returns errored=true", () => {
    expect(ChatCoreBoundary.getDerivedStateFromError(new Error("x"))).toEqual({
      errored: true,
    });
  });

  it("VisualThemeBoundary.getDerivedStateFromError returns errored=true", () => {
    expect(VisualThemeBoundary.getDerivedStateFromError(new Error("x"))).toEqual({
      errored: true,
    });
  });

  it("OptionalVisualModuleBoundary.getDerivedStateFromError returns errored=true", () => {
    expect(
      OptionalVisualModuleBoundary.getDerivedStateFromError(new Error("x")),
    ).toEqual({ errored: true });
  });
});

// ─── componentDidCatch · emission shape + content safety ───────────

describe("componentDidCatch emission (Tier 1)", () => {
  it("emits a normalized payload with no raw error text", () => {
    const b = new ChatCoreBoundary({
      children: null,
      surface: "depth-cards",
      visual_theme: "depth-cards-hotel",
    });
    const privateErr = new Error(`boom at message="${DISTINCTIVE_PRIVATE}"`);
    privateErr.stack = `fake stack line referencing ${DISTINCTIVE_PRIVATE}`;
    b.componentDidCatch(privateErr, {
      componentStack: `in <Composer> rendering ${DISTINCTIVE_PRIVATE}`,
    });

    expect(captured.length).toBe(1);
    const call = captured[0]!;
    expect(call.url).toBe("/api/nex-native/surface-health");
    expect(call.body.tier).toBe("chat-core");
    expect(call.body.surface).toBe("depth-cards");
    expect(call.body.visual_theme).toBe("depth-cards-hotel");
    expect(call.body.component_module).toBe("surface-root");
    expect(call.body.error_classification).toBe("render_runtime_error");
    expect(call.body.recovery_action).toBe("degrade");

    // Private-content canary MUST NOT appear anywhere in the emitted
    // payload — not in top-level keys, nested keys, or values.
    const serialised = JSON.stringify(call.body);
    expect(serialised).not.toContain(DISTINCTIVE_PRIVATE);
    expect(serialised).not.toContain("stack");
    expect(serialised).not.toContain("componentStack");
    expect(serialised).not.toContain("message");
  });
});

describe("componentDidCatch emission (Tier 2)", () => {
  it("emits classification=theme_bundle_load_failure + recovery_action=fallback", () => {
    const b = new VisualThemeBoundary({
      children: null,
      surface: "depth-cards",
      visual_theme: "depth-cards-hotel",
      fallbackMessages: [],
      viewerAccountId: "test-viewer",
    });
    b.componentDidCatch(new Error("theme broke"), { componentStack: "" });
    expect(captured.length).toBe(1);
    const body = captured[0]!.body;
    expect(body.tier).toBe("visual-theme");
    expect(body.error_classification).toBe("theme_bundle_load_failure");
    expect(body.recovery_action).toBe("fallback");
    expect(body.component_module).toBe("theme-root");
  });
});

describe("componentDidCatch emission (Tier 3)", () => {
  it("uses the component_module prop to classify + recovery_action=degrade", () => {
    const b = new OptionalVisualModuleBoundary({
      children: null,
      surface: "depth-cards",
      visual_theme: "depth-cards-hotel",
      component_module: "haunted-smoke",
    });
    b.componentDidCatch(new Error("smoke broke"), { componentStack: "" });
    expect(captured.length).toBe(1);
    const body = captured[0]!.body;
    expect(body.tier).toBe("optional-visual-module");
    expect(body.component_module).toBe("haunted-smoke");
    expect(body.error_classification).toBe("animation_runtime_error");
    expect(body.recovery_action).toBe("degrade");
  });

  it("falls back to render_runtime_error for an unrecognised module name", () => {
    const b = new OptionalVisualModuleBoundary({
      children: null,
      surface: "depth-cards",
      visual_theme: "depth-cards-hotel",
      component_module: "unknown-slot",
    });
    b.componentDidCatch(new Error("x"), { componentStack: "" });
    expect(captured[0]!.body.error_classification).toBe("render_runtime_error");
  });
});

// ─── Telemetry client · fire-and-forget safety ─────────────────────

// ─── §5a scope · boundaries don't catch service/network failures ───

describe("§5a scope · boundary cannot be triggered by service failures", () => {
  it("constructing a boundary and never invoking componentDidCatch emits nothing", () => {
    new ChatCoreBoundary({
      children: null,
      surface: "depth-cards",
      visual_theme: "depth-cards-hotel",
    });
    new VisualThemeBoundary({
      children: null,
      surface: "depth-cards",
      visual_theme: "depth-cards-hotel",
      fallbackMessages: [],
      viewerAccountId: "v",
    });
    new OptionalVisualModuleBoundary({
      children: null,
      surface: "depth-cards",
      visual_theme: "depth-cards-hotel",
      component_module: "haunted-smoke",
    });
    // A simulated service failure manifests as a rejected promise OR an
    // event-handler exception · neither invokes componentDidCatch (React
    // contract). We prove the proxy: without componentDidCatch, no emit.
    expect(captured.length).toBe(0);
  });

  it("boundary modules import no service/network client (static proof)", async () => {
    // Verify the compiled module graph of the boundaries does not pull
    // in any service module. We check this by inspecting source files.
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, resolve } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const files = [
      "ChatCoreBoundary.tsx",
      "VisualThemeBoundary.tsx",
      "OptionalVisualModuleBoundary.tsx",
    ];
    const forbidden = [
      "supabase",
      "peer-conversation-service",
      "peer-message-service",
      "account-service",
      "chat-theme-service",
    ];
    for (const f of files) {
      const src = readFileSync(resolve(here, "..", f), "utf8");
      for (const token of forbidden) {
        expect(src).not.toContain(token);
      }
    }
  });
});

describe("telemetry client", () => {
  it("never throws even if fetch is undefined", async () => {
    const g = globalThis as unknown as { fetch?: typeof fetch };
    const original = g.fetch;
    g.fetch = undefined;
    try {
      const { emitSurfaceHealthEvent } = await import("../telemetry-client");
      expect(() =>
        emitSurfaceHealthEvent({
          tier: "chat-core",
          surface: "x",
          visual_theme: "y",
          component_module: "z",
          error_classification: "render_runtime_error",
          recovery_action: "none",
        }),
      ).not.toThrow();
    } finally {
      g.fetch = original;
    }
  });

  it("never throws even when fetch rejects", async () => {
    const g = globalThis as unknown as { fetch: typeof fetch };
    g.fetch = (() => Promise.reject(new Error("network down"))) as unknown as typeof fetch;
    const { emitSurfaceHealthEvent } = await import("../telemetry-client");
    expect(() =>
      emitSurfaceHealthEvent({
        tier: "chat-core",
        surface: "x",
        visual_theme: "y",
        component_module: "z",
        error_classification: "render_runtime_error",
        recovery_action: "none",
      }),
    ).not.toThrow();
  });
});
