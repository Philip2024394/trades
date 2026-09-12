// src/lib/nex/live/discovery.ts
//
// NEX LIVE · MUSIC/VIDEO slice · Discovery by mode
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §1 · §2 · §9 · §13
//
// The single question this module answers: "given a mode (MUSIC or
// VIDEO), what media items should the swipe feed present right now?"
//
// Composes:
//   · MediaObject records from src/lib/nex-media/media-object.ts (existing)
//   · MediaRightsDeclaration from media-declaration-store.ts (this slice)
//   · MediaVisibilityState from report.ts (this slice)
//
// §9 discipline: RESTRICTED / REMOVED / BLOCKED / DISPUTED items must
// not appear in normal customer feeds. shouldServeMediaBytes /
// isDiscoverableV2 enforce this mechanically.

import { readMediaVisibility } from "./report";
import { isDiscoverableV2 } from "./media-lifecycle-v2";
import { readActiveDeclaration } from "./media-declaration-store";
import { mayPublishDeclaredMedia } from "./rights-declaration";

export type NexLiveMode = "MUSIC" | "VIDEO";

/** Classify a MediaObject row into a NEX Live mode.
 *
 *  Rules (§1 · §2):
 *    1. If the uploader explicitly tagged mode in extras.nex_live_mode,
 *       trust that. §20 uses the existing MediaObject.extras JSON so
 *       no schema change is required.
 *    2. If object_type === "audio" OR "audio/*" mime → MUSIC.
 *    3. Otherwise → VIDEO.
 *
 *  Never guesses genre. Never fabricates a mode when the row is empty.
 */
export function classifyMode(row: {
  object_type?: string | null;
  mime_type?: string | null;
  extras?: { nex_live_mode?: string } | null;
}): NexLiveMode {
  const explicit = row.extras?.nex_live_mode;
  if (explicit === "MUSIC" || explicit === "VIDEO") return explicit;
  const mime = (row.mime_type ?? "").toLowerCase();
  if (row.object_type === "audio") return "MUSIC";
  if (mime.startsWith("audio/")) return "MUSIC";
  return "VIDEO";
}

/** Minimal shape of a discoverable item. Callers may return WIDER
 *  shapes (playback URLs, thumbnails) — this type is the safety
 *  contract, not the full response. */
export type DiscoverableItem = {
  media_id: string;
  mode: NexLiveMode;
  visibility: ReturnType<typeof readMediaVisibility>;
  has_declaration: boolean;
  declared_kind: string | null;    // customer-facing label caller should render
};

/** Filter a candidate list of rows to those safe to surface in the
 *  given mode. §9: no RESTRICTED / REMOVED / BLOCKED / DISPUTED leaks.
 *
 *  Rows without an active declaration are EXCLUDED — the founder's §5
 *  rule requires an explicit declaration before publication. */
export function filterDiscoverable(input: {
  mode: NexLiveMode;
  rows: ReadonlyArray<{
    media_id: string;
    object_type?: string | null;
    mime_type?: string | null;
    extras?: { nex_live_mode?: string } | null;
  }>;
}): DiscoverableItem[] {
  const out: DiscoverableItem[] = [];
  for (const row of input.rows) {
    const rowMode = classifyMode(row);
    if (rowMode !== input.mode) continue;
    const visibility = readMediaVisibility(row.media_id);
    if (!isDiscoverableV2(visibility)) continue;
    const decl = readActiveDeclaration(row.media_id);
    if (!decl) continue;   // §5 · no declaration → not published under NEX Live
    const gate = mayPublishDeclaredMedia(decl.declared_kind);
    if (!gate.allowed) continue;
    out.push({
      media_id: row.media_id,
      mode: rowMode,
      visibility,
      has_declaration: true,
      declared_kind: decl.declared_kind,
    });
  }
  return out;
}

/** Convenience: does an individual media item currently qualify for
 *  the given mode's public feed? Used by the report/review endpoints
 *  to compute what would happen next. */
export function isDiscoverableForMode(input: {
  mode: NexLiveMode;
  row: {
    media_id: string;
    object_type?: string | null;
    mime_type?: string | null;
    extras?: { nex_live_mode?: string } | null;
  };
}): boolean {
  return filterDiscoverable({ mode: input.mode, rows: [input.row] }).length > 0;
}
