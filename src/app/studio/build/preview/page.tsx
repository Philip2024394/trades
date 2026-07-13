// Studio Builder — preview iframe target.
//
// This page renders inside the iframe on /studio/build. It reads the
// pipeline result the parent window stashed on `window.__studioBuilderPipeline`,
// and paints a real, high-fidelity preview of the composed plan:
//
//   • Journey-driven page grid (Home / About / Contact / Projects / etc)
//   • Sticky WhatsApp footer with the merchant's number placeholder
//   • Left review rail (per the user's 2026-07-09 spec)
//   • Section skeletons in each page, keyed off the journey's stages
//
// This is preview-fidelity — not the final rendered site. Phase 2
// (SSE streaming) will progressively fill in real section renders.

import { StudioBuilderPreviewCanvas } from "@/components/studio/builder/StudioBuilderPreviewCanvas";

export const dynamic = "force-dynamic";

export default function StudioBuildPreviewPage(): JSX.Element {
  return <StudioBuilderPreviewCanvas />;
}
