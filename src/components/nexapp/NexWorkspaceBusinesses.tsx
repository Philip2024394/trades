"use client";
// NexWorkspaceBusinesses · Philip 2026-08-30
//
// After the Directory Surface extraction (project_nex_directory_surface_
// architecture_2026_08_30) this file is a thin adapter that renders the
// Food vertical against the shared NexDirectorySurface primitive.
//
// BusinessContext + AskNexHandler are re-exported so the shell's import
// path stays byte-identical while the primitive + verticals live in their
// own modules underneath.

import {
  NexDirectorySurface,
  type BusinessContext,
  type AskNexHandler,
} from "@/components/nexapp/NexDirectorySurface";
import { foodVertical } from "@/lib/nexapp/verticals/food";

export type { BusinessContext, AskNexHandler };

export function NexWorkspaceBusinesses({ onAskNex }: { onAskNex: AskNexHandler }) {
  return <NexDirectorySurface vertical={foodVertical} onAskNex={onAskNex} />;
}
