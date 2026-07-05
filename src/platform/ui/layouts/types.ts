// Layout Recipes — shared types.
//
// A layout section is a discriminated union — every possible section
// the platform can render. Consumers describe pages as arrays of
// these; the layout renders each one via SectionRenderer.

import type { ReactNode } from "react";
import type { CtaBandProps } from "../bands/CtaBand";
import type { ProcessBandProps } from "../bands/ProcessBand";
import type { StatsBandProps } from "../bands/StatsBand";
import type { TestimonialBandProps } from "../bands/TestimonialBand";
import type { TrustBarProps } from "../bands/TrustBar";
import type { EmergencyHeroProps } from "../heroes/EmergencyHero";
import type { MinimalHeroProps } from "../heroes/MinimalHero";
import type { SplitHeroProps } from "../heroes/SplitHero";

/** Discriminated section descriptor. Add new kinds here; the
 *  SectionRenderer switch will type-error until it handles them. */
export type LayoutSection =
  | { id: string; kind: "hero"; props: SplitHeroProps }
  | { id: string; kind: "minimal-hero"; props: MinimalHeroProps }
  | { id: string; kind: "emergency-hero"; props: EmergencyHeroProps }
  | { id: string; kind: "stats-band"; props: StatsBandProps }
  | { id: string; kind: "trust-bar"; props: TrustBarProps }
  | { id: string; kind: "process-band"; props: ProcessBandProps }
  | { id: string; kind: "testimonial-band"; props: TestimonialBandProps }
  | { id: string; kind: "cta-band"; props: CtaBandProps }
  | { id: string; kind: "spacer"; height?: number }
  | { id: string; kind: "custom"; render: () => ReactNode };
