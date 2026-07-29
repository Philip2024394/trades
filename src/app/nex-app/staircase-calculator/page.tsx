// /nex-app/staircase-calculator — Staircase Calculator module (placeholder).
//
// Separate Layer 2 module. Answers the practical question a staircase
// maker asks: "for this staircase geometry, what timber do I need?"
//
// This module CANNOT ship until the Staircase Reference Brain has an
// authored module for material requirements. That's Rule B (no AI-
// authored trade knowledge). The UI shell can be prepared; the maths
// stays empty until real expert-authored rules exist.
//
// Real-world constraint noted by Philip 2026-07-28: a staircase can
// have multiple goings (e.g. three goings) and multiple rise heights
// (e.g. two heights) on winders / dogleg / half-turn geometries. The
// input form must model that — needs proper research before build.

import { SquareStack } from "lucide-react";
import { ModulePlaceholder } from "@/components/nex-app/materials/_ModulePlaceholder";
import "../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staircase Calculator · NEX", robots: { index: false } };

export default function StaircaseCalculatorPage() {
  return (
    <div className="nex-app-root">
      <ModulePlaceholder
        icon={SquareStack}
        title="Staircase Calculator"
        subtitle="What do I need? Steps, risers, stair-parts."
        intro="Enter a staircase (type · going · rise · height · number of risers · species · thicknesses) and receive the timber and stair-part requirements — boards, handrails, spindles, newels. Answers come from the Staircase Reference Brain, never invented by the app."
        phases={[
          {
            state: "later",
            label: "Phase 0 · Input model research",
            body:
              "Model the geometry properly: straight · quarter-turn · half-turn · winders · doglegs. Some staircases have multiple goings (up to three) and multiple rise heights (up to two). Define the input shape before writing any UI.",
          },
          {
            state: "later",
            label: "Phase 1 · Reference Brain authoring",
            body:
              "Expert authors the staircase_material_requirements module in the Staircase Reference Brain. Rule B — no AI-generated trade content. The calculator returns “unknown” for every geometry until the expert has approved rules for that geometry.",
          },
          {
            state: "later",
            label: "Phase 2 · Composition",
            body:
              "UI reads authored rules from the Reference Brain (Layer 1) · returns requirements as citations · optionally cross-checks against Stock (Layer 2) to answer “can I build this with the timber I own?”",
          },
        ]}
        ruleNote="This module is a Rule B firewall. Every requirement it returns must carry a citation back to an expert-approved module version in the Staircase Reference Brain. No hardcoded formulas, no AI-authored fallbacks, no silent guesses. Silence &gt; fabrication."
      />
    </div>
  );
}
