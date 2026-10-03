"use client";

// src/app/nex-native/chat/prototypes/depth-cards/_tier-one-canary.tsx
//
// Development/test-only invisible canary that lives inside the Tier 1
// Chat Core Boundary but OUTSIDE Tier 2 and Tier 3. Exists only so
// Playwright can prove the Tier 1 catch path from a real browser.
//
// Renders nothing visible; occupies no layout space. Throws only when
// its __faultInject prop is explicitly true, which only happens when
// the dev-only bridge in _test-bridge.ts emits ?__inject=core.

import * as React from "react";

interface TierOneCanaryProps {
  __faultInject?: boolean;
}

export function TierOneCanary(props: TierOneCanaryProps): React.ReactElement | null {
  if (props.__faultInject) {
    throw new Error("fault-injection: tier-one canary");
  }
  return null;
}
