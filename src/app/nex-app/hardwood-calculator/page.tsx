// /nex-app/hardwood-calculator — Hardwood Calculator module (placeholder).
//
// This is a separate Layer 2 Application Module — NOT part of the Stock
// module. It will grow in two phases:
//   Phase 1 · generic timber math (cubic metres · board feet · volume ·
//            weight · unit conversions). Pure math · no trade knowledge.
//   Phase 2 · integration with the Stock module (measure once here, then
//            hand off to inventory).
//
// Staircase-specific requirement rules will NEVER live here — those are
// Layer 1 (Reference Brain) knowledge authored by an expert and consumed
// by the separate Staircase Calculator module.

import { Calculator } from "lucide-react";
import { ModulePlaceholder } from "@/components/nex-app/materials/_ModulePlaceholder";
import "../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hardwood Calculator · NEX", robots: { index: false } };

export default function HardwoodCalculatorPage() {
  return (
    <div className="nex-app-root">
      <ModulePlaceholder
        icon={Calculator}
        title="Hardwood Calculator"
        subtitle="Generic timber math for the workshop."
        intro="Cubic metres, board feet, volume, weight and unit conversions. Pure calculations — no trade knowledge, no staircase rules. Enter dimensions, get numbers."
        phases={[
          {
            state: "next",
            label: "Phase 1 · Generic calculations",
            body:
              "Cubic metres · board feet · linear metres · weight (from species density) · imperial ↔ metric conversions. Ships as a standalone module — no dependency on the Stock database.",
          },
          {
            state: "later",
            label: "Phase 2 · Stock integration",
            body:
              "Reuse a saved calculation to pre-fill a new pack measurement · or match calculated dimensions against boards you already own. Ships once Phase 1 is stable and workers have adopted it.",
          },
        ]}
        ruleNote="Any staircase-specific requirement rules (e.g. “14-riser oak flight needs 6 boards”) will NOT live here. Those are Layer 1 knowledge and belong in the Staircase Reference Brain — consumed by the Staircase Calculator, not the Hardwood Calculator. Rule B compliance."
      />
    </div>
  );
}
