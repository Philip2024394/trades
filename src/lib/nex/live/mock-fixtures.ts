// src/lib/nex/live/mock-fixtures.ts
//
// NEX LIVE · Master Experience · Mock content fixture registry
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Master Build
//
// PURPOSE (§17 · §18 · §19 · §20 · §21 · §22 · §55)
//   The canonical list of mock content the seed script installs into
//   the dev environment. Every fixture MUST:
//     · be clearly marked `is_mock_fixture: true` in extras
//     · reference either a real existing nex.media_object row OR a
//       synthetic asset the seed script creates
//     · carry a real rights declaration (never UNKNOWN → PUBLISHED)
//     · attach to a stable mock_entity_id + creator_id for §71 identity
//     · declare timing so live-status can derive LIVE_NOW/STARTING_SOON
//
// §17 immutable · mock content is dev/demo only · never presented to
// real users as real businesses/events.
//
// This is a PURE DATA MODULE. The seed script reads this list and
// performs the actual insertions. Read-side code (discovery) reads
// nothing from this file directly.

import type { NexLiveMode } from "./discovery";
import type { DeclaredRightsKind } from "./rights-declaration";

export type MockFixtureCategory =
  | "music_track"
  | "music_video"
  | "restaurant"
  | "gym"
  | "venue"
  | "event"
  | "activity"
  | "artist"
  | "creator"
  | "hotel";

export type MockFixture = {
  fixture_id: string;                        // stable identifier for the fixture
  mode: NexLiveMode;                         // MUSIC or VIDEO
  category: MockFixtureCategory;
  title: string;
  description: string;
  creator_id: string;                        // mock creator NEX ID
  entity_id: string;                         // mock entity id (business/artist/venue)
  entity_name: string;
  city_slug: string;                         // e.g. "yogyakarta"
  province_code: string | null;              // ISO 3166-2 (e.g. "ID-YO")
  /** Relative to seed-time now. Positive = future, negative = past. */
  started_at_offset_min: number;
  end_at_offset_min: number | null;
  /** Content state per Phase A lifecycle. */
  content_state: "PUBLISHED" | "LIVE";
  /** Rights declaration state · always OWNER_DECLARED for mocks. */
  rights_kind: DeclaredRightsKind;
  rights_statement: string;
  /** Which media asset to attach:
   *   · "existing_sample_video" reuses the real 23ddb66f... row.
   *   · "seed_wav_silence:<ms>" tells seed to create a silent WAV. */
  media_asset: "existing_sample_video" | `seed_wav_silence:${number}`;
};

// ── The canonical mock roster ────────────────────────────────────
// §55 target: ≥3 of each · this delivers a coverage-adequate baseline.
// Timing: mix of LIVE_NOW (started 10 min ago), STARTING_SOON (starts
// in 30 min), TONIGHT (starts at 20:00-ish · adjusted at seed time),
// ENDED (started 3 hours ago and ended 30 min ago) so the discovery
// filters have real variety.

export const MOCK_FIXTURES: ReadonlyArray<MockFixture> = [
  // ── MUSIC · 3 mock tracks · WAV silence ────────────────────────
  {
    fixture_id: "mock_music_maya_midnight",
    mode: "MUSIC",
    category: "music_track",
    title: "Midnight Yogyakarta",
    description: "MOCK · Synthetic silent test track · demonstrates music playback path.",
    creator_id: "mock_artist_maya",
    entity_id: "mock_entity_artist_maya",
    entity_name: "Maya (mock artist)",
    city_slug: "yogyakarta",
    province_code: "ID-YO",
    started_at_offset_min: -10,
    end_at_offset_min: null,
    content_state: "LIVE",
    rights_kind: "OWNER_DECLARED",
    rights_statement: "Synthetic silent test audio · owned by NEX for demo purposes.",
    media_asset: "seed_wav_silence:2000",
  },
  {
    fixture_id: "mock_music_river_acoustic",
    mode: "MUSIC",
    category: "music_track",
    title: "Sunrise Acoustic",
    description: "MOCK · Synthetic test audio · demonstrates STARTING_SOON state.",
    creator_id: "mock_artist_river",
    entity_id: "mock_entity_artist_river",
    entity_name: "River (mock artist)",
    city_slug: "yogyakarta",
    province_code: "ID-YO",
    started_at_offset_min: 30,
    end_at_offset_min: null,
    content_state: "PUBLISHED",
    rights_kind: "OWNER_DECLARED",
    rights_statement: "Synthetic silent test audio · owned by NEX for demo purposes.",
    media_asset: "seed_wav_silence:1500",
  },
  {
    fixture_id: "mock_music_kota_ensemble",
    mode: "MUSIC",
    category: "music_track",
    title: "Kota Ensemble · Evening Set",
    description: "MOCK · Synthetic test audio · demonstrates TONIGHT category · Jakarta.",
    creator_id: "mock_group_kota",
    entity_id: "mock_entity_group_kota",
    entity_name: "Kota Ensemble (mock group)",
    city_slug: "jakarta",
    province_code: "ID-JK",
    started_at_offset_min: 240,   // adjusted by seed to today's 20:00 local
    end_at_offset_min: null,
    content_state: "PUBLISHED",
    rights_kind: "OWNER_DECLARED",
    rights_statement: "Synthetic silent test audio · owned by NEX for demo purposes.",
    media_asset: "seed_wav_silence:2500",
  },

  // ── VIDEO · reuses real existing sample_video for real playback ──
  {
    fixture_id: "mock_video_kitchen_warung_melati",
    mode: "VIDEO",
    category: "restaurant",
    title: "Tonight at Warung Melati · Kitchen",
    description: "MOCK · Uses existing test sample video · demo restaurant Live.",
    creator_id: "mock_business_warung_melati",
    entity_id: "mock_entity_warung_melati",
    entity_name: "Warung Melati (mock restaurant)",
    city_slug: "yogyakarta",
    province_code: "ID-YO",
    started_at_offset_min: -4,
    end_at_offset_min: null,
    content_state: "LIVE",
    rights_kind: "OWNER_DECLARED",
    rights_statement: "Sample video reused for demo purposes · public developer sample.",
    media_asset: "existing_sample_video",
  },
  {
    fixture_id: "mock_video_boxing_night_gym",
    mode: "VIDEO",
    category: "gym",
    title: "Boxing Night · Evening Training",
    description: "MOCK · Uses existing test sample video · demo gym Live.",
    creator_id: "mock_business_iron_gym",
    entity_id: "mock_entity_iron_gym",
    entity_name: "Iron Gym Yogyakarta (mock)",
    city_slug: "yogyakarta",
    province_code: "ID-YO",
    started_at_offset_min: -11,
    end_at_offset_min: null,
    content_state: "LIVE",
    rights_kind: "OWNER_DECLARED",
    rights_statement: "Sample video reused for demo purposes.",
    media_asset: "existing_sample_video",
  },
  {
    fixture_id: "mock_video_rooftop_friday",
    mode: "VIDEO",
    category: "venue",
    title: "Friday at the Rooftop · Doors Opening",
    description: "MOCK · Uses existing test sample video · demo venue starting soon.",
    creator_id: "mock_business_rooftop",
    entity_id: "mock_entity_rooftop",
    entity_name: "Rooftop Yogyakarta (mock venue)",
    city_slug: "yogyakarta",
    province_code: "ID-YO",
    started_at_offset_min: 20,
    end_at_offset_min: null,
    content_state: "PUBLISHED",
    rights_kind: "OWNER_DECLARED",
    rights_statement: "Sample video reused for demo purposes.",
    media_asset: "existing_sample_video",
  },
  {
    fixture_id: "mock_video_sunset_ride",
    mode: "VIDEO",
    category: "activity",
    title: "Sunset Ride · Departing Soon",
    description: "MOCK · Uses existing test sample video · demo activity/event Live.",
    creator_id: "mock_creator_ride_co",
    entity_id: "mock_entity_ride_co",
    entity_name: "Yogya Rides (mock activity)",
    city_slug: "yogyakarta",
    province_code: "ID-YO",
    started_at_offset_min: 15,
    end_at_offset_min: null,
    content_state: "PUBLISHED",
    rights_kind: "OWNER_DECLARED",
    rights_statement: "Sample video reused for demo purposes.",
    media_asset: "existing_sample_video",
  },
  {
    fixture_id: "mock_video_hotel_room_tour",
    mode: "VIDEO",
    category: "hotel",
    title: "Hotel Room Tour · Deluxe Suite",
    description: "MOCK · Uses existing test sample video · demo hotel entity Live.",
    creator_id: "mock_business_gaotama_hotel",
    entity_id: "mock_entity_gaotama_hotel",
    entity_name: "Gaotama Hotel (mock entity)",
    city_slug: "yogyakarta",
    province_code: "ID-YO",
    started_at_offset_min: -6,
    end_at_offset_min: null,
    content_state: "LIVE",
    rights_kind: "OWNER_DECLARED",
    rights_statement: "Sample video reused for demo purposes.",
    media_asset: "existing_sample_video",
  },
  {
    fixture_id: "mock_video_hotel_pool",
    mode: "VIDEO",
    category: "hotel",
    title: "Pool · Afternoon",
    description: "MOCK · Uses existing test sample video · demo hotel · secondary Live.",
    creator_id: "mock_business_gaotama_hotel",
    entity_id: "mock_entity_gaotama_hotel",
    entity_name: "Gaotama Hotel (mock entity)",
    city_slug: "yogyakarta",
    province_code: "ID-YO",
    started_at_offset_min: -4,
    end_at_offset_min: null,
    content_state: "LIVE",
    rights_kind: "OWNER_DECLARED",
    rights_statement: "Sample video reused for demo purposes.",
    media_asset: "existing_sample_video",
  },
  {
    fixture_id: "mock_video_hotel_dinner",
    mode: "VIDEO",
    category: "hotel",
    title: "Dinner Tonight · Rooftop",
    description: "MOCK · Uses existing test sample video · demo hotel · tonight event.",
    creator_id: "mock_business_gaotama_hotel",
    entity_id: "mock_entity_gaotama_hotel",
    entity_name: "Gaotama Hotel (mock entity)",
    city_slug: "yogyakarta",
    province_code: "ID-YO",
    started_at_offset_min: 240,   // pinned by seed to today's 20:00 local
    end_at_offset_min: null,
    content_state: "PUBLISHED",
    rights_kind: "OWNER_DECLARED",
    rights_statement: "Sample video reused for demo purposes.",
    media_asset: "existing_sample_video",
  },
];

// ── Public helpers · read fixtures without I/O ────────────────────

/** All fixture entity_ids · used by tests + seed script. */
export function fixtureEntityIds(): string[] {
  return Array.from(new Set(MOCK_FIXTURES.map((f) => f.entity_id)));
}

/** Fixtures for a given entity · used by EntityLiveCarousel resolvers. */
export function fixturesForEntity(entity_id: string): MockFixture[] {
  return MOCK_FIXTURES.filter((f) => f.entity_id === entity_id);
}

/** Fixtures for a given city · used by /api/nex-live/tonight. */
export function fixturesForCity(city_slug: string): MockFixture[] {
  return MOCK_FIXTURES.filter((f) => f.city_slug === city_slug);
}

/** Every mock fixture is is_mock_fixture=true · never confused with real content. */
export const IS_MOCK_FIXTURE_MARKER = { is_mock_fixture: true } as const;
