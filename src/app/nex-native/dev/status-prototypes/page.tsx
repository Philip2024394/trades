// src/app/nex-native/dev/status-prototypes/page.tsx
//
// Dev route · ten Status Page prototypes + research brief ·
// founder-authorised 2026-10-05.
//
// Shows ten distinct status-page designs for NEX so the founder can
// pick killer features before implementation. Also includes a
// written research brief (reference apps · NEX-unique angles ·
// privacy considerations · what to pull in first).
//
// Status in NEX scope sealed 2026-10-05:
//   - Entry point 1: new "Status" button in the lower-right 3-dots
//     stack (R7 extended to 4 actions)
//   - Entry point 2: tapping the peer avatar in the header opens
//     the full-screen status viewer
//   - Content types: video + image + text overlay
//   - No length limit
//   - Metadata: upload time + approximate location (never exact)
//
// Current status: DESIGN PROTOTYPES ONLY. None of these are wired
// into the live chat. Nothing writes to the DB.

import { notFound } from "next/navigation";
import * as React from "react";
import { StatusPrototypes } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StatusPrototypesPage(): Promise<React.JSX.Element> {
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
          <StatusPrototypes />
        </div>
      </main>
    </>
  );
}
