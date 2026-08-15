// NEX Design Catalogue · Master Template 1 · dev preview (Philip 2026-08-14).
//
// Route: /nex-app/design-catalogue/staircase/master-template-1
//
// Assembles the Master Template as sections get approved. Currently
// contains ONLY the hero (ST-H01) — no trust bar, no collections, no
// other sections until Philip approves the hero composition.
//
// Dev-only. Returns 404 outside development.

import { notFound } from "next/navigation";
import { STN01 } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/sections/ST-N01";
import { STH01 } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/sections/ST-H01";
import { STT01 } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/sections/ST-T01";
import { STC01 } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/sections/ST-C01";
import { STB01 } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/sections/ST-B01";
import { STA01 } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/sections/ST-A01";
import { STF01 } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/sections/ST-F01";
import { Reveal } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/Reveal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Master Template 1 · dev preview", robots: { index: false } };

export default function MasterTemplate1PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main data-testid="mt1-preview">
      {/* Owner-approval bar · replaces itself with the real header once
          ST-N01 is built and approved. Kept minimal so the eye stays on
          the section under review. */}
      <div
        style={{
          background: "#0a0a0a",
          color: "#fff",
          padding: "10px 20px",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <span>
          <strong>NEX Design Catalogue</strong> · Master Template 1 · Premium Architectural · Staircase
        </span>
        <span style={{ opacity: 0.65 }}>
          Awaiting owner approval · sections built so far: <code>ST-N01</code>, <code>ST-H01</code>, <code>ST-T01</code>, <code>ST-C01</code>, <code>ST-A01</code> (with <code>ST-Q01</code> embedded)
        </span>
      </div>

      <STN01 />
      <STH01 />
      <Reveal><STT01 /></Reveal>
      <Reveal><STC01 /></Reveal>
      <Reveal><STB01 /></Reveal>
      {/* ST-A01 removed from the page per Philip 2026-08-14 (still
          exists as a section file for future use). */}
      <Reveal><STF01 /></Reveal>
    </main>
  );
}
