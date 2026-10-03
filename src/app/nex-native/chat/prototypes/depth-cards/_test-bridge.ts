// src/app/nex-native/chat/prototypes/depth-cards/_test-bridge.ts
//
// Development/test-only fault-injection bridge for the depth-cards
// pilot. Exposes the existing `__faultInject` React prop to the
// running browser so Playwright can drive the already-authorised
// Item 2 boundary catch paths.
//
// Double-gated so the bridge is dead in production:
//   1. process.env.NODE_ENV must NOT be "production"
//   2. process.env.NEX_SURFACE_HEALTH_TEST_BRIDGE must equal "1"
//
// Even with both gates satisfied, nothing happens unless the request
// also carries the opt-in `?__inject=<tier>` query param.
//
// Values accepted: "theme" (Tier 2), "smoke" (Tier 3), "core" (Tier 1).
//
// This file introduces NO production feature, NO user-facing control,
// NO database column, NO migration. It only maps an existing
// development env + opt-in URL param → the existing `__faultInject`
// prop that already exists on DepthDeck and HauntedSmokeClient.

export type TestBridgeTarget = "theme" | "smoke" | "core" | null;

export interface TestBridgeFaults {
  theme: boolean;
  smoke: boolean;
  core: boolean;
}

const EMPTY: TestBridgeFaults = { theme: false, smoke: false, core: false };

function bridgeActive(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEX_SURFACE_HEALTH_TEST_BRIDGE === "1"
  );
}

function parseTarget(raw: unknown): TestBridgeTarget {
  if (typeof raw !== "string") return null;
  const v = raw.toLowerCase().trim();
  if (v === "theme" || v === "smoke" || v === "core") return v;
  return null;
}

/** Resolve which (if any) tier should be fault-injected for this
 *  request. Returns {theme:false, smoke:false, core:false} when the
 *  bridge is off or when no valid opt-in param is present. */
export function resolveFaultInjection(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): TestBridgeFaults {
  if (!bridgeActive()) return EMPTY;
  if (!searchParams) return EMPTY;
  const raw = searchParams.__inject;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const target = parseTarget(value);
  if (!target) return EMPTY;
  return {
    theme: target === "theme",
    smoke: target === "smoke",
    core: target === "core",
  };
}
