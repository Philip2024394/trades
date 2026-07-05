// SectionRenderer — maps a LayoutSection descriptor to the correct
// primitive. Exhaustive switch — TypeScript errors if we add a new
// kind without handling it here.

import { CtaBand } from "../bands/CtaBand";
import { ProcessBand } from "../bands/ProcessBand";
import { StatsBand } from "../bands/StatsBand";
import { TestimonialBand } from "../bands/TestimonialBand";
import { TrustBar } from "../bands/TrustBar";
import { EmergencyHero } from "../heroes/EmergencyHero";
import { MinimalHero } from "../heroes/MinimalHero";
import { SplitHero } from "../heroes/SplitHero";
import type { LayoutSection } from "./types";

export function SectionRenderer({ section }: { section: LayoutSection }) {
  switch (section.kind) {
    case "hero":
      return <SplitHero {...section.props} />;
    case "minimal-hero":
      return <MinimalHero {...section.props} />;
    case "emergency-hero":
      return <EmergencyHero {...section.props} />;
    case "stats-band":
      return <StatsBand {...section.props} />;
    case "trust-bar":
      return <TrustBar {...section.props} />;
    case "process-band":
      return <ProcessBand {...section.props} />;
    case "testimonial-band":
      return <TestimonialBand {...section.props} />;
    case "cta-band":
      return <CtaBand {...section.props} />;
    case "spacer":
      return <div style={{ height: section.height ?? 32 }} aria-hidden="true" />;
    case "custom":
      return <>{section.render()}</>;
  }
}
