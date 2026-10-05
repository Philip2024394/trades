// src/app/nex-native/dev/ocean-animation-prototypes/page.tsx
//
// Dev route · ten Ocean animation prototypes · founder-authorised
// 2026-10-05.
//
// Shows ten advanced ocean animations in a scrollable grid so the
// founder can judge which (if any) are worth absorbing into the
// Theme Engine as general reusable vocabulary.
//
// Current status: PROTOTYPES. None of these are production code.
// They don't participate in the Theme Engine. They live under /dev
// and are gated behind NODE_ENV !== "production" || NEX_DEV_ROUTES=1.
//
// Scope sealed 2026-10-05:
//   1. Chain + Anchor
//   2. Scuba Diver
//   3. Boat on Surface
//   4. Fish School
//   5. Shark Hits Glass + Crack
//   6. Jellyfish Rising
//   7. Whale Passing
//   8. Octopus with Tentacles
//   9. Light Rays + Caustics
//   10. Treasure Chest Glowing

import { notFound } from "next/navigation";
import * as React from "react";
import { OceanAnimationPrototypes } from "./_prototypes-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OceanAnimationPrototypesPage(): Promise<React.JSX.Element> {
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) notFound();

  return (
    <>
      <style>{`
        html, body { background: #020914 !important; color: #F4F7FC; margin: 0; }
        body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
      `}</style>
      <meta name="robots" content="noindex, nofollow" />
      <main
        style={{
          minHeight: "100dvh",
          padding: "24px 16px 60px",
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>
            Ocean · ten advanced animation prototypes
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: 13,
              color: "#8BA9D1",
              lineHeight: 1.5,
            }}
          >
            Evaluation prototypes · pure SVG + CSS · nothing commits to the Theme Engine
            until founder picks the ones worth absorbing as general reusable vocabulary.
          </p>
          <OceanAnimationPrototypes />
        </div>
      </main>
    </>
  );
}
