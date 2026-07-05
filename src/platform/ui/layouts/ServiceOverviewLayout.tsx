// ServiceOverviewLayout — the standard trade-website recipe.
//
// Consumers pass:
//   • brand (name / icon / href)
//   • nav links (anchor targets on the same page)
//   • sections (ordered discriminated union of what to render)
//   • bottom-bar CTAs
//
// The layout arranges Shell + sections. No page has to write a
// <SplitHero> next to a <StatsBand> next to a <CtaBand> ever again.

import type { ReactNode } from "react";
import { LayoutShell } from "./LayoutShell";
import type { LayoutShellProps } from "./LayoutShell";
import { SectionRenderer } from "./SectionRenderer";
import type { LayoutSection } from "./types";

export type ServiceOverviewLayoutProps = Omit<
  LayoutShellProps,
  "children"
> & {
  sections: readonly LayoutSection[];
  /** Rendered after the sections but before the footer. Use for
   *  page-specific extras (a demo banner, an active experiment). */
  afterSections?: ReactNode;
};

export function ServiceOverviewLayout({
  sections,
  afterSections,
  ...shellProps
}: ServiceOverviewLayoutProps) {
  return (
    <LayoutShell {...shellProps}>
      {sections.map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
      {afterSections}
    </LayoutShell>
  );
}
