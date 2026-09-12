// src/app/api/nex-live/discover/route.ts
//
// NEX LIVE · MUSIC/VIDEO slice · Discovery feed by mode
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §1 · §2 · §9 · §12 · §13
//
// GET /api/nex-live/discover?mode=MUSIC
// GET /api/nex-live/discover?mode=VIDEO
//
// Returns published-and-visible NEX Live items for the requested mode.
// §9 discipline · RESTRICTED / REMOVED items are filtered mechanically.
// §5 discipline · items without an active rights declaration are
// filtered mechanically.
//
// Public read-only endpoint — no auth required (nothing to mutate).

import { NextResponse } from "next/server";
import { readMediaVisibility } from "@/lib/nex/live/report";
import { readActiveDeclaration, listMediaIdsWithDeclaration } from "@/lib/nex/live/media-declaration-store";
import { mayPublishDeclaredMedia, customerFacingRightsLabel } from "@/lib/nex/live/rights-declaration";
import { isDiscoverableV2 } from "@/lib/nex/live/media-lifecycle-v2";
import { classifyMode, type NexLiveMode } from "@/lib/nex/live/discovery";
import { resolveMediaForPlayback } from "@/lib/nex/live/media-resolver";
import { _readModeIndexForRoute } from "../upload/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawMode = (url.searchParams.get("mode") ?? "").toUpperCase();
  if (rawMode !== "MUSIC" && rawMode !== "VIDEO") {
    return NextResponse.json(
      { ok: false, error: "mode_must_be_MUSIC_or_VIDEO" },
      { status: 400 },
    );
  }
  const mode: NexLiveMode = rawMode;
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));

  const modeIndex = _readModeIndexForRoute();
  const declaredIds = listMediaIdsWithDeclaration();
  const items: Array<{
    media_id: string;
    mode: NexLiveMode;
    visibility: ReturnType<typeof readMediaVisibility>;
    declared_kind: string;
    customer_facing_label: string;
    registered_at_iso: string;
    // Phase 2 · real playback fields · null when storage unresolved
    playback_url: string | null;
    poster_url: string | null;
    mime_type: string | null;
    duration_ms: number | null;
    owner_id: string | null;
    title: string | null;
    description: string | null;
    playback_reason: string;
    // §10 · never claim verification.
    verified: false;
  }> = [];

  // First pass: build the base list per Phase 1 discipline (declaration + visibility).
  type Base = Omit<typeof items[number], "playback_url" | "poster_url" | "mime_type" | "duration_ms" | "owner_id" | "title" | "description" | "playback_reason">;
  const base: Base[] = [];
  for (const media_id of declaredIds) {
    const modeEntry = modeIndex.index[media_id];
    const rowMode = modeEntry?.mode ?? classifyMode({});
    if (rowMode !== mode) continue;
    const visibility = readMediaVisibility(media_id);
    if (!isDiscoverableV2(visibility)) continue;
    const decl = readActiveDeclaration(media_id);
    if (!decl) continue;
    const gate = mayPublishDeclaredMedia(decl.declared_kind);
    if (!gate.allowed) continue;
    base.push({
      media_id,
      mode: rowMode,
      visibility,
      declared_kind: decl.declared_kind,
      customer_facing_label: customerFacingRightsLabel(decl.declared_kind),
      registered_at_iso: modeEntry?.registered_at_iso ?? decl.declared_at_iso,
      verified: false,
    });
    if (base.length >= limit) break;
  }

  // Newest first BEFORE resolution so we only resolve the top N.
  base.sort((a, b) => b.registered_at_iso.localeCompare(a.registered_at_iso));

  // Second pass: resolve real playback URLs · never fabricated · always
  // returns the same count of items (null when unresolved).
  const resolved = await resolveMediaForPlayback(base.map((b) => b.media_id));
  const byId = new Map(resolved.map((r) => [r.media_id, r]));

  for (const b of base) {
    const r = byId.get(b.media_id);
    items.push({
      ...b,
      playback_url: r?.playback_url ?? null,
      poster_url: r?.poster_url ?? null,
      mime_type: r?.mime_type ?? null,
      duration_ms: r?.duration_ms ?? null,
      owner_id: r?.owner_id ?? null,
      title: r?.title ?? null,
      description: r?.description ?? null,
      playback_reason: r?.reason ?? "resolver_missing",
    });
  }

  return NextResponse.json({
    ok: true,
    mode,
    count: items.length,
    items,
    honesty: {
      note: "NEX Live surfaces uploader-declared rights only. NEX has NOT independently verified ownership. When playback_url is null, the underlying media/storage is unavailable — the surface renders 'media temporarily unavailable' rather than a fake URL.",
    },
  });
}
