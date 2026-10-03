// src/app/api/nex-native/surface-health/__tests__/route.test.ts
//
// §12 Item 2 contract tests for the ingestion route. Mocks the Item 1
// service so no real DB is required · these are route-shape tests.
//
// Covers:
//   · POST with a valid payload routes through recordFailure and
//     returns 202 + the resulting lifecycle row shape.
//   · Invalid payloads (missing fields, bad enum, oversize strings)
//     return 400 before any service call.
//   · Private-content canary stuffed into surface/visual_theme/
//     component_module strings is rejected via length guard.
//   · Private content is NEVER forwarded to the service even if the
//     caller tries to smuggle it in an unknown field.
//   · Service failures surface as 500 with a generic error code; the
//     internal exception text is not reflected in the response body.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mock of the Item 1 service.
const recordFailureMock = vi.fn();
vi.mock("@/lib/nex-native/surface-health-service", () => ({
  recordFailure: (...args: unknown[]) => recordFailureMock(...args),
}));

// Mock the correlation helper so we don't need an HTTP server scope.
vi.mock("@/lib/nex/observability/correlation", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/lib/nex/observability/correlation",
  );
  return {
    ...actual,
    runFromRequest: (<T,>(_req: unknown, fn: () => T) => fn()) as unknown,
  };
});

import { POST } from "../route";

const DISTINCTIVE_PRIVATE = "CONVERSATION_LEAK_CANARY_7E6F2A91";

function makeRequest(body: unknown): Request {
  return new Request("http://test/api/nex-native/surface-health", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  recordFailureMock.mockReset();
  recordFailureMock.mockResolvedValue({
    id: "row-stub",
    failure_signature: "sig-stub",
    lifecycle_state: "fallback-active",
    occurrence_count: 1,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Happy path ────────────────────────────────────────────────────

describe("POST /api/nex-native/surface-health · happy path", () => {
  it("returns 202 and the resulting lifecycle metadata for a well-formed payload", async () => {
    const res = await POST(
      makeRequest({
        tier: "visual-theme",
        surface: "depth-cards",
        visual_theme: "depth-cards-hotel",
        component_module: "theme-root",
        error_classification: "theme_bundle_load_failure",
        recovery_action: "fallback",
        app_version: "1.0.0",
        theme_version: "2026-10-03",
        client_environment: {
          browser: "chrome",
          os: "windows",
          device_class: "desktop",
          runtime: "web",
        },
      }) as never,
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe("row-stub");
    expect(body.failure_signature).toBe("sig-stub");
    expect(body.lifecycle_state).toBe("fallback-active");
    expect(recordFailureMock).toHaveBeenCalledTimes(1);
  });

  it("forwards the normalized ClientEnvironment to recordFailure", async () => {
    await POST(
      makeRequest({
        tier: "chat-core",
        surface: "depth-cards",
        visual_theme: "depth-cards-hotel",
        component_module: "surface-root",
        error_classification: "render_runtime_error",
        recovery_action: "degrade",
        client_environment: {
          browser: "safari",
          os: "ios",
          device_class: "mobile",
          runtime: "pwa",
          locale: "en-GB",
        },
      }) as never,
    );
    const [arg] = recordFailureMock.mock.calls[0]!;
    expect(arg.client_environment).toEqual({
      browser: "safari",
      os: "ios",
      device_class: "mobile",
      runtime: "pwa",
      locale: "en-GB",
    });
  });
});

// ─── Validation + content safety ───────────────────────────────────

describe("POST /api/nex-native/surface-health · validation", () => {
  it("rejects invalid JSON with 400", async () => {
    const req = new Request("http://test/api/nex-native/surface-health", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect(recordFailureMock).not.toHaveBeenCalled();
  });

  it("rejects missing surface/visual_theme/component_module", async () => {
    const res = await POST(
      makeRequest({
        error_classification: "render_runtime_error",
        recovery_action: "none",
      }) as never,
    );
    expect(res.status).toBe(400);
    expect(recordFailureMock).not.toHaveBeenCalled();
  });

  it("rejects an error_classification outside the closed set", async () => {
    const res = await POST(
      makeRequest({
        surface: "x",
        visual_theme: "y",
        component_module: "z",
        error_classification: "not_a_real_classification",
        recovery_action: "none",
      }) as never,
    );
    expect(res.status).toBe(400);
    expect(recordFailureMock).not.toHaveBeenCalled();
  });

  it("rejects a recovery_action outside the closed set", async () => {
    const res = await POST(
      makeRequest({
        surface: "x",
        visual_theme: "y",
        component_module: "z",
        error_classification: "render_runtime_error",
        recovery_action: "panic",
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("rejects a surface string longer than the content-safety length cap", async () => {
    const longPrivate = DISTINCTIVE_PRIVATE.repeat(5); // >64 chars
    const res = await POST(
      makeRequest({
        surface: longPrivate,
        visual_theme: "y",
        component_module: "z",
        error_classification: "render_runtime_error",
        recovery_action: "none",
      }) as never,
    );
    expect(res.status).toBe(400);
    expect(recordFailureMock).not.toHaveBeenCalled();
  });

  it("does not forward unknown fields (private content) to recordFailure", async () => {
    await POST(
      makeRequest({
        tier: "chat-core",
        surface: "depth-cards",
        visual_theme: "depth-cards-hotel",
        component_module: "surface-root",
        error_classification: "render_runtime_error",
        recovery_action: "none",
        // Caller tries to smuggle private content via an unknown field.
        attempted_leak: `This message contains ${DISTINCTIVE_PRIVATE}`,
        error_message: `boom ${DISTINCTIVE_PRIVATE}`,
        stack: `trace ${DISTINCTIVE_PRIVATE}`,
      }) as never,
    );
    const [arg] = recordFailureMock.mock.calls[0]!;
    const serialised = JSON.stringify(arg);
    expect(serialised).not.toContain(DISTINCTIVE_PRIVATE);
    expect(arg).not.toHaveProperty("attempted_leak");
    expect(arg).not.toHaveProperty("error_message");
    expect(arg).not.toHaveProperty("stack");
  });
});

// ─── Service failure handling ──────────────────────────────────────

describe("POST /api/nex-native/surface-health · service failure", () => {
  it("returns 500 with a generic code when the service throws · internal text is not leaked", async () => {
    recordFailureMock.mockRejectedValueOnce(
      new Error(`internal DB detail with ${DISTINCTIVE_PRIVATE}`),
    );
    const res = await POST(
      makeRequest({
        surface: "x",
        visual_theme: "y",
        component_module: "z",
        error_classification: "render_runtime_error",
        recovery_action: "none",
      }) as never,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("surface_health_service_error");
    expect(JSON.stringify(body)).not.toContain(DISTINCTIVE_PRIVATE);
  });
});
