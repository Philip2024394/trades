// src/app/api/nex-live/tonight/route.ts
//
// NEX LIVE · Master Experience · "What's happening" endpoint
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Master Build
//
// Answers §2 §3 primary question: "What's happening around me tonight?"
//
// Composes:
//   · Fixture roster (data/nex-live/mock-timing.json · keyed by fixture_id)
//     — each fixture points to a real underlying media_id (may be shared
//     between multiple fixtures · e.g. 3 hotel Live cards playing the
//     same sample video)
//   · Real user declarations (listMediaIdsWithDeclaration · Phase 1)
//   · Playback enrichment (resolveMediaForPlayback · Phase 2)
//   · Status derivation (deriveLiveDiscoveryStatus · Master)
//
// GET /api/nex-live/tonight?city=yogyakarta&status=LIVE_NOW,STARTING_SOON,TONIGHT&limit=30

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { readMediaVisibility } from "@/lib/nex/live/report";
import { readActiveDeclaration, listMediaIdsWithDeclaration } from "@/lib/nex/live/media-declaration-store";
import { mayPublishDeclaredMedia, customerFacingRightsLabel } from "@/lib/nex/live/rights-declaration";
import { isDiscoverableV2 } from "@/lib/nex/live/media-lifecycle-v2";
import { resolveMediaForPlayback } from "@/lib/nex/live/media-resolver";
import {
  deriveLiveDiscoveryStatus,
  isDiscoveryVisibleStatus,
  discoveryOrderWeight,
  labelForStatus,
  type LiveDiscoveryStatus,
} from "@/lib/nex/live/live-status";
import { _readModeIndexForRoute } from "../upload/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FixtureTiming = {
  fixture_id: string;
  media_id: string;
  entity_id: string;
  entity_name: string;
  creator_id: string;
  category: string;
  city_slug: string;
  province_code: string | null;
  started_at_iso: string;
  end_at_iso: string | null;
  last_heartbeat_iso: string | null;
  content_state: "PUBLISHED" | "LIVE";
  is_mock_fixture: boolean;
  title: string;
  description: string;
  mode: "MUSIC" | "VIDEO";
};

type TimingSidecar = {
  version: number;
  now_at_seed_iso: string;
  fixtures: Record<string, FixtureTiming>;   // keyed by fixture_id
};

function readTimingSidecar(): TimingSidecar | null {
  try {
    const p = path.join(process.cwd(), "data/nex-live/mock-timing.json");
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8")) as TimingSidecar;
  } catch { return null; }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = (url.searchParams.get("city") ?? "").toLowerCase().trim() || null;
  const statusParam = url.searchParams.get("status");
  const statusFilter: LiveDiscoveryStatus[] | null = statusParam
    ? statusParam.split(",").map((s) => s.trim().toUpperCase() as LiveDiscoveryStatus)
    : null;
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "30", 10) || 30));
  const category = (url.searchParams.get("category") ?? "").trim() || null;

  const nowIso = new Date().toISOString();
  const timing = readTimingSidecar();
  const modeIndex = _readModeIndexForRoute();
  const declaredIds = listMediaIdsWithDeclaration();

  type Item = {
    key: string;                 // stable per-item key (React) · fixture_id OR media_id
    media_id: string;
    fixture_id: string | null;
    entity_id: string | null;
    entity_name: string | null;
    creator_id: string | null;
    category: string | null;
    city_slug: string | null;
    mode: "MUSIC" | "VIDEO";
    live_status: LiveDiscoveryStatus;
    status_label: string;
    started_at_iso: string | null;
    is_mock_fixture: boolean;
    declared_kind: string;
    customer_facing_label: string;
    visibility: string;
    title: string | null;
    playback_url: string | null;
    poster_url: string | null;
    mime_type: string | null;
    playback_reason: string;
    verified: false;
  };

  const seenFixtureIds = new Set<string>();
  const base: Item[] = [];

  // ── 1. Fixture roster (mock content) ─────────────────────────────
  if (timing) {
    for (const [fxId, t] of Object.entries(timing.fixtures)) {
      seenFixtureIds.add(fxId);
      const media_id = t.media_id;
      const decl = readActiveDeclaration(media_id);
      if (!decl) continue;
      const gate = mayPublishDeclaredMedia(decl.declared_kind);
      if (!gate.allowed) continue;
      const visibility = readMediaVisibility(media_id);
      if (!isDiscoverableV2(visibility)) continue;

      const liveStatus = deriveLiveDiscoveryStatus({
        content_state: t.content_state === "LIVE" ? "LIVE" : "PUBLISHED",
        visibility_state: visibility,
        started_at_iso: t.started_at_iso,
        end_at_iso: t.end_at_iso,
        last_heartbeat_iso: t.last_heartbeat_iso,
        now_iso: nowIso,
      });

      if (city && t.city_slug !== city) continue;
      if (category && t.category !== category) continue;
      if (statusFilter && !statusFilter.includes(liveStatus)) continue;
      if (!statusFilter && !isDiscoveryVisibleStatus(liveStatus)) continue;

      base.push({
        key: fxId,
        media_id,
        fixture_id: fxId,
        entity_id: t.entity_id,
        entity_name: t.entity_name,
        creator_id: t.creator_id,
        category: t.category,
        city_slug: t.city_slug,
        mode: t.mode,
        live_status: liveStatus,
        status_label: labelForStatus(liveStatus),
        started_at_iso: t.started_at_iso,
        is_mock_fixture: t.is_mock_fixture,
        declared_kind: decl.declared_kind,
        customer_facing_label: customerFacingRightsLabel(decl.declared_kind),
        visibility,
        title: t.title,
        playback_url: null,
        poster_url: null,
        mime_type: null,
        playback_reason: "pending",
        verified: false,
      });
    }
  }

  // ── 2. Real declared user content (not covered by a fixture) ────
  for (const media_id of declaredIds) {
    // Skip if already surfaced as a fixture
    const alreadyFixture = timing
      && Object.values(timing.fixtures).some((f) => f.media_id === media_id);
    if (alreadyFixture) continue;

    const modeEntry = modeIndex.index[media_id];
    if (!modeEntry) continue;
    const decl = readActiveDeclaration(media_id);
    if (!decl) continue;
    const gate = mayPublishDeclaredMedia(decl.declared_kind);
    if (!gate.allowed) continue;
    const visibility = readMediaVisibility(media_id);
    if (!isDiscoverableV2(visibility)) continue;

    // Real user content has no timing sidecar entry · treat as
    // UNKNOWN status which is filtered out of default discovery.
    const liveStatus: LiveDiscoveryStatus = "UNKNOWN";
    if (city) continue;   // real content isn't yet city-tagged in this slice
    if (category) continue;
    if (statusFilter && !statusFilter.includes(liveStatus)) continue;
    if (!statusFilter) continue;   // exclude from default "what's happening"

    base.push({
      key: `real:${media_id}`,
      media_id,
      fixture_id: null,
      entity_id: null,
      entity_name: null,
      creator_id: decl.uploader_user_id,
      category: null,
      city_slug: null,
      mode: modeEntry.mode,
      live_status: liveStatus,
      status_label: labelForStatus(liveStatus),
      started_at_iso: null,
      is_mock_fixture: false,
      declared_kind: decl.declared_kind,
      customer_facing_label: customerFacingRightsLabel(decl.declared_kind),
      visibility,
      title: null,
      playback_url: null,
      poster_url: null,
      mime_type: null,
      playback_reason: "pending",
      verified: false,
    });
  }

  // Sort · LIVE_NOW first, then STARTING_SOON, then TONIGHT, etc.
  base.sort((a, b) => {
    const wa = discoveryOrderWeight(a.live_status);
    const wb = discoveryOrderWeight(b.live_status);
    if (wa !== wb) return wa - wb;
    if (a.started_at_iso && b.started_at_iso) return a.started_at_iso.localeCompare(b.started_at_iso);
    return 0;
  });

  const capped = base.slice(0, limit);

  // Enrich with real playback fields · dedup by media_id
  const uniqueMediaIds = Array.from(new Set(capped.map((i) => i.media_id)));
  const resolved = await resolveMediaForPlayback(uniqueMediaIds);
  const byId = new Map(resolved.map((r) => [r.media_id, r]));
  for (const item of capped) {
    const r = byId.get(item.media_id);
    if (r) {
      item.playback_url = r.playback_url;
      item.poster_url = r.poster_url;
      item.mime_type = r.mime_type;
      item.playback_reason = r.reason;
      if (!item.title) item.title = r.title;
    }
  }

  const summary: Record<LiveDiscoveryStatus, number> = {
    LIVE_NOW: 0, STARTING_SOON: 0, TONIGHT: 0, UPCOMING: 0, ENDED: 0, STALE: 0, UNKNOWN: 0,
  };
  for (const it of capped) summary[it.live_status]++;

  return NextResponse.json({
    ok: true,
    city,
    category,
    status_filter: statusFilter,
    now_iso: nowIso,
    count: capped.length,
    summary,
    items: capped,
    honesty: {
      note: "Mock fixtures are clearly marked is_mock_fixture=true and share a common test media id in dev. LIVE_NOW requires status=LIVE AND fresh heartbeat AND started_at in past AND not past end_at.",
    },
  });
}
