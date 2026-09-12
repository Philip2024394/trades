// src/lib/nex/live/entity-live-query.ts
//
// NEX LIVE · Phase 3 · Entity Live query
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 3
//
// PURPOSE (§32 · §35 · §41 · §55)
//   Server-side query that returns the Live sessions belonging to a
//   specific NEX entity. Composes the same primitives the /tonight
//   endpoint uses:
//     · timing sidecar keyed by fixture_id
//     · listMediaIdsWithDeclaration for real user content
//     · deriveLiveDiscoveryStatus for calm state derivation
//     · resolveMediaForPlayback for real playback URLs
//
// TRUTH RULES (§4 · §14 · §17 · §41)
//   · Real user content is NOT auto-linked to real WorldRecord entities
//     — the linkage would be fabrication unless the creator explicitly
//     claimed the entity. Until that flow ships, real content only
//     surfaces on its creator's own profile.
//   · Mock fixtures may shadow a real entity for demonstration ONLY
//     when the operator explicitly wires the alias in MOCK_ENTITY_ALIASES.
//   · Zero-length result is an honest empty state — never fabricated.
//
// PURE server module.  No React.  No client I/O.

import fs from "node:fs";
import path from "node:path";
import { readActiveDeclaration } from "./media-declaration-store";
import { mayPublishDeclaredMedia } from "./rights-declaration";
import { readMediaVisibility } from "./report";
import { isDiscoverableV2 } from "./media-lifecycle-v2";
import { resolveMediaForPlayback } from "./media-resolver";
import {
  deriveLiveDiscoveryStatus,
  labelForStatus,
  discoveryOrderWeight,
  type LiveDiscoveryStatus,
} from "./live-status";
import type { EntityLiveCard } from "@/components/nex-app/live/EntityLiveCarousel";

// ── Mock alias registry ──────────────────────────────────────────
//
// Maps a real WorldRecord ref_id to a mock fixture entity_id. This is
// EXPLICIT operator wiring so the demo Live cards appear on the real
// entity's detail page. Never guessed. Never inferred by name similarity.
// Adding a new alias is a deliberate act.
//
// Ref_ids arrive in one of two canonical shapes per parseRefId:
//   · "place:{vertical}:{id}"  (e.g. "place:accommodation:#AC-2026-0000D")
//   · "{id}"                    (bare · used by older callers)
//
// The registry lists BOTH so the lookup is unambiguous. Phase 3.1
// discovered this defect: projectEntityDetail returns the prefixed form
// while the bare form is what an operator would write when wiring an
// alias by hand. The registry now accepts both.
const MOCK_ENTITY_ALIASES: Readonly<Record<string, string>> = {
  // Gaotama Hotel · #AC-2026-0000D
  "place:accommodation:#AC-2026-0000D": "mock_entity_gaotama_hotel",
  "#AC-2026-0000D": "mock_entity_gaotama_hotel",
};

// Shape of the timing sidecar mirrors the tonight route's private type.
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
  fixtures: Record<string, FixtureTiming>;
};

function readTimingSidecar(): TimingSidecar | null {
  try {
    const p = path.join(process.cwd(), "data/nex-live/mock-timing.json");
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8")) as TimingSidecar;
  } catch {
    return null;
  }
}

export type EntityLiveQueryInput = {
  entity_ref_id: string;
  entity_name: string;
  now_iso?: string;
  /** Include ENDED cards in the tail (default false). */
  include_ended?: boolean;
};

export type EntityLiveQueryResult = {
  entity_ref_id: string;
  entity_name: string;
  resolved_mock_entity_id: string | null;
  cards: EntityLiveCard[];
  reason: "mock_alias_matched" | "no_mock_alias" | "no_timing_sidecar" | "no_fixtures_for_entity";
};

export async function queryEntityLiveCards(input: EntityLiveQueryInput): Promise<EntityLiveQueryResult> {
  const now_iso = input.now_iso ?? new Date().toISOString();

  // Short-circuit BEFORE reading the sidecar. Real WorldRecord entities
  // without an explicit alias never surface mock Live cards — no need
  // to touch the filesystem to know that.
  const mockEntityId = MOCK_ENTITY_ALIASES[input.entity_ref_id] ?? null;
  if (mockEntityId === null) {
    return {
      entity_ref_id: input.entity_ref_id,
      entity_name: input.entity_name,
      resolved_mock_entity_id: null,
      cards: [],
      reason: "no_mock_alias",
    };
  }

  const timing = readTimingSidecar();
  if (!timing) {
    return {
      entity_ref_id: input.entity_ref_id,
      entity_name: input.entity_name,
      resolved_mock_entity_id: mockEntityId,
      cards: [],
      reason: "no_timing_sidecar",
    };
  }

  const matching = Object.values(timing.fixtures).filter((f) => f.entity_id === mockEntityId);
  if (matching.length === 0) {
    return {
      entity_ref_id: input.entity_ref_id,
      entity_name: input.entity_name,
      resolved_mock_entity_id: mockEntityId,
      cards: [],
      reason: "no_fixtures_for_entity",
    };
  }

  // Gate each fixture through the same rights + visibility discipline
  // the tonight route uses, then derive status and (optionally) drop
  // ENDED items.
  type Prelim = {
    fixture: FixtureTiming;
    live_status: LiveDiscoveryStatus;
  };
  const prelim: Prelim[] = [];
  for (const fx of matching) {
    const decl = readActiveDeclaration(fx.media_id);
    if (!decl) continue;
    const gate = mayPublishDeclaredMedia(decl.declared_kind);
    if (!gate.allowed) continue;
    const visibility = readMediaVisibility(fx.media_id);
    if (!isDiscoverableV2(visibility)) continue;

    const live_status = deriveLiveDiscoveryStatus({
      content_state: fx.content_state === "LIVE" ? "LIVE" : "PUBLISHED",
      visibility_state: visibility,
      started_at_iso: fx.started_at_iso,
      end_at_iso: fx.end_at_iso,
      last_heartbeat_iso: fx.last_heartbeat_iso,
      now_iso,
    });
    if (!input.include_ended && live_status === "ENDED") continue;
    prelim.push({ fixture: fx, live_status });
  }

  // Sort by discovery priority · LIVE_NOW first
  prelim.sort((a, b) => {
    const wa = discoveryOrderWeight(a.live_status);
    const wb = discoveryOrderWeight(b.live_status);
    if (wa !== wb) return wa - wb;
    return a.fixture.started_at_iso.localeCompare(b.fixture.started_at_iso);
  });

  // Enrich each with real playback fields (posters live off the media)
  const uniqueMediaIds = Array.from(new Set(prelim.map((p) => p.fixture.media_id)));
  const resolved = await resolveMediaForPlayback(uniqueMediaIds);
  const byId = new Map(resolved.map((r) => [r.media_id, r]));

  const cards: EntityLiveCard[] = prelim.map((p) => {
    const r = byId.get(p.fixture.media_id) ?? null;
    return {
      media_id: p.fixture.media_id,
      title: p.fixture.title,
      category: p.fixture.category,
      live_status: p.live_status,
      status_label: labelForStatus(p.live_status),
      poster_url: r?.poster_url ?? null,
      playback_url: r?.playback_url ?? null,
      duration_hint_min: null,
      is_mock_fixture: p.fixture.is_mock_fixture,
    };
  });

  return {
    entity_ref_id: input.entity_ref_id,
    entity_name: input.entity_name,
    resolved_mock_entity_id: mockEntityId,
    cards,
    reason: "mock_alias_matched",
  };
}
