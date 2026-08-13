// NDIP · Render Planner.
//
// Sits between the Reasoning Layer (Campaign Engine · Recommendation Engine) and
// the Rendering Layer. Takes a RenderBrief (marketing intent) → produces a fully
// specified DesignDocument with every design decision RESOLVED. The renderer
// receives NO ambiguity.
//
// Constitutional rule: the Render Planner is the LAST place aesthetic decisions
// are made. Once a DesignDocument leaves the planner, no further decisions occur.
//
// Doctrine: docs/brains/nex-design-intelligence-platform-ndip-philip-2026-08-04.md

import type { BannerSpecification } from "./types";
import { bannerToDocument, type BannerDocument, type Provenance } from "./design-document";

const PLANNER_VERSION = "e0.1_render_planner_v1";

export type BannerRenderBrief = {
  brief_kind: "banner";
  banner_specification: BannerSpecification;
  provenance?: Provenance;
};

export type RenderBrief = BannerRenderBrief;   // union grows: WebsiteRenderBrief · BrochureRenderBrief · etc.

/** The Render Planner. Takes a brief · returns a fully-specified DesignDocument.
 *  MVP behaviour · wraps the incoming BannerSpecification into a BannerDocument
 *  with scene graph seeded and provenance stamped with the planner version. */
export function planRenderDocument(brief: RenderBrief): BannerDocument {
  if (brief.brief_kind !== "banner") {
    // Unreachable today · exhaustive when new brief kinds are added.
    throw new Error(`Render Planner does not yet support brief_kind=${(brief as { brief_kind: string }).brief_kind}`);
  }
  const provenance: Provenance = {
    ...(brief.provenance ?? {}),
    render_planner_version: PLANNER_VERSION,
  };
  return bannerToDocument(brief.banner_specification, { provenance });
}
