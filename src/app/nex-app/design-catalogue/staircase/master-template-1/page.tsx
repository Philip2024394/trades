// NEX Design Catalogue · Master Template 1 · dev preview (Philip 2026-08-14).
//
// Route: /nex-app/design-catalogue/staircase/master-template-1
//
// Thin Server Component wrapper. All section composition + activation
// lives in the client-side <Mt1ExperienceStream />. This file only
// renders the dev-only approval bar and mounts the stream.
//
// Section catalogue (as of 2026-08-17 · two-journey doctrine order):
//   Core scroll (always mounted):
//     ST-N01 (nav)
//     ST-H01 (hero)
//     ST-T01 (trust bar)
//     ST-C01 (Staircase Types · 4 curated cards → future style writer)
//     ST-M01 (Choose Your Wood · reads/writes design.wood)
//     [ST-D01 · Design Your Staircase · future component selectors]
//     ST-AB01 (How It's Made · process / team / stats / CTA)
//     ST-B01  (Installation across the UK)
//     ST-P01  (Staircase Parts & Accessories · Customer B gateway)
//     ST-F01  (footer)
//   Append-on-demand (URL-hash deep-link auto-activation):
//     #materials-all-woods → full wood catalogue inside ST-M01
//     #parts-all           → full parts catalogue inside ST-P01
//
// See docstring on Mt1ExperienceStream for how to wire another
// append-on-demand chapter.
//
// Dev-only. Returns 404 outside development.

import { notFound } from "next/navigation";
import { Mt1ExperienceStream } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/Mt1ExperienceStream";

export const dynamic = "force-dynamic";
export const metadata = { title: "Master Template 1 · dev preview", robots: { index: false } };

export default function MasterTemplate1PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main data-testid="mt1-preview">
      {/* Owner-approval bar · dev-only. */}
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
          Order: <code>N01</code> · <code>H01</code> · <code>T01</code> · <code>C01</code> (Types) · <code>M01</code> (Wood) · <em>[D01 · Design · pending]</em> · <code>AB01</code> (Process) · <code>B01</code> (UK cover) · <code>P01</code> (Parts) · <code>F01</code> · append-on-demand: <code>#materials-all-woods</code>, <code>#parts-all</code>
        </span>
      </div>

      <Mt1ExperienceStream />
    </main>
  );
}
