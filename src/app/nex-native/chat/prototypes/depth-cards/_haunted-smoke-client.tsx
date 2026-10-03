"use client";

// src/app/nex-native/chat/prototypes/depth-cards/_haunted-smoke-client.tsx
//
// Client-component extraction of the Hollywood haunted-smoke overlay
// previously inline in page.tsx. Lifting it to the client tree so the
// Tier 3 OptionalVisualModuleBoundary can catch render-time failures
// originating here.
//
// A `__faultInject` prop allows the fault-injection tests (and only
// those tests) to force a render-time throw. The prop is UI-only and
// has no production call sites.

import * as React from "react";

const SMOKE_PARTICLES: Array<{
  left: string;
  delay: number;
  duration: number;
  size: number;
  drift: number;
}> = [
  { left: "6%", delay: 0, duration: 7.2, size: 110, drift: 6.5 },
  { left: "18%", delay: 2.4, duration: 9.0, size: 70, drift: 5.0 },
  { left: "30%", delay: 4.1, duration: 8.3, size: 130, drift: 7.5 },
  { left: "42%", delay: 1.2, duration: 10.5, size: 90, drift: 6.0 },
  { left: "54%", delay: 5.3, duration: 7.8, size: 100, drift: 5.5 },
  { left: "66%", delay: 3.0, duration: 9.5, size: 85, drift: 7.0 },
  { left: "78%", delay: 6.4, duration: 8.0, size: 115, drift: 6.2 },
  { left: "88%", delay: 0.8, duration: 11.0, size: 75, drift: 5.8 },
  { left: "14%", delay: 7.6, duration: 8.6, size: 95, drift: 6.8 },
  { left: "50%", delay: 8.9, duration: 10.2, size: 120, drift: 7.2 },
  { left: "72%", delay: 10.1, duration: 7.5, size: 80, drift: 5.4 },
];

interface HauntedSmokeClientProps {
  /** Test-only fault-injection switch. In production call sites this
   *  prop is never set. */
  __faultInject?: boolean;
}

export function HauntedSmokeClient(props: HauntedSmokeClientProps): React.ReactElement {
  if (props.__faultInject) {
    throw new Error("fault-injection: haunted-smoke");
  }
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 380,
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 2,
      }}
    >
      {SMOKE_PARTICLES.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.left,
            bottom: -20,
            width: p.size,
            height: p.size,
            marginLeft: -p.size / 2,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(240,245,255,0.42) 32%, rgba(220,230,255,0.15) 60%, rgba(255,255,255,0) 75%)",
            animation: `nex-smoke-rise ${p.duration}s ${p.delay}s infinite ease-out, nex-smoke-drift ${p.drift}s ${p.delay / 2}s infinite ease-in-out`,
            willChange: "transform, opacity, filter",
            mixBlendMode: "screen",
          }}
        />
      ))}
    </div>
  );
}
