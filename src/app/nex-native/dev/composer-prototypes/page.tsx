// src/app/nex-native/dev/composer-prototypes/page.tsx
//
// Dev route · six world-class composer footer prototypes · 2026-10-05.
//
// Each prototype is a candidate replacement for the sealed R3 layout.
// Every one meets the 44pt mobile tap-target minimum (WCAG 2.5.5
// level AAA · Apple HIG · Material Design 48dp). Side-by-side so the
// founder can judge visual + ergonomics in one view.
//
// Gated by NODE_ENV !== "production" || NEX_DEV_ROUTES=1.

import { notFound } from "next/navigation";
import * as React from "react";
import { ComposerPrototypes } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ComposerPrototypesPage(): Promise<React.JSX.Element> {
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
        <div style={{ maxWidth: 1600, margin: "0 auto" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>
            Composer footer · six world-class prototypes
          </h1>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: "#8BA9D1",
              lineHeight: 1.5,
            }}
          >
            All prototypes meet 44pt minimum tap targets. Toggle the overlay to
            see the tap zones highlighted. Each one is an alternative to the
            current R3 layout — pick one, or mix elements across them.
          </p>
          <ComposerPrototypes />
        </div>
      </main>
    </>
  );
}
