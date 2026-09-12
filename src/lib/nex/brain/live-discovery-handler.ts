// src/lib/nex/brain/live-discovery-handler.ts
//
// NEX · Phase D · LIVE_DISCOVERY_REQUEST server handler
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D §19-§24
//
// PURPOSE
//   Turns a LiveDiscoveryScope (from live-discovery-intent) into an
//   honest, evidence-only answer composed of:
//     · a short conversational summary in the caller's language
//     · a list of Live cards drawn from the SAME primitives that back
//       /api/nex-live/tonight (never fabricated)
//
//   The handler MUST NOT invent an event · MUST NOT round-trip its own
//   HTTP endpoint (uses the same lib primitives directly) · MUST NOT
//   weaken freshness/rights checks · MUST NOT collapse STARTING_SOON
//   into LIVE_NOW.
//
// IMMUTABLE RULES HONORED
//   §19 · Reuses existing Live discovery composition (readActive-
//         Declaration + mayPublishDeclaredMedia + isDiscoverableV2 +
//         deriveLiveDiscoveryStatus + resolveMediaForPlayback).
//   §20 · Response is calm and conversational · never "LIVE_DISCOVERY_
//         REQUEST detected."
//   §21 · Zero-evidence honesty · empty result set produces an honest
//         "nothing verified live tonight" sentence, never a padded card.
//   §22 · Provenance preserved via `is_mock_fixture` + declared-kind
//         labels propagated to the card summary.
//   §23 · Freshness contract preserved by delegating to derive-status.
//   §24 · STARTING_SOON stays labeled STARTING_SOON.
//
// PURE server module (no React · no DOM · no HTTP fetch to /api/*).

import fs from "node:fs";
import path from "node:path";
import { readActiveDeclaration } from "@/lib/nex/live/media-declaration-store";
import { mayPublishDeclaredMedia } from "@/lib/nex/live/rights-declaration";
import { readMediaVisibility } from "@/lib/nex/live/report";
import { isDiscoverableV2 } from "@/lib/nex/live/media-lifecycle-v2";
import { resolveMediaForPlayback } from "@/lib/nex/live/media-resolver";
import {
  deriveLiveDiscoveryStatus,
  labelForStatus,
  discoveryOrderWeight,
  type LiveDiscoveryStatus,
} from "@/lib/nex/live/live-status";
import type { EntityLiveCard } from "@/components/nex-app/live/EntityLiveCarousel";
import type { LiveDiscoveryScope, LiveDiscoveryLanguage, LiveDiscoveryCategoryScope, LiveDiscoveryTimeScope } from "./live-discovery-intent";

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
  } catch { return null; }
}

// ── Category bucketing (mirrors city-live-groupings but private here
//    so the brain does not depend on the app-layer helper) ────────
const CATEGORY_BUCKET: Record<string, LiveDiscoveryCategoryScope> = {
  music_track:  "music",
  music_video:  "music",
  artist:       "any",
  restaurant:   "food",
  gym:          "gym",
  hotel:        "hotel",
  venue:        "venue",
  event:        "events",
  activity:     "activity",
  creator:      "any",
};

function categoryMatches(fixture: FixtureTiming, scope: LiveDiscoveryCategoryScope): boolean {
  if (scope === "any") return true;
  return CATEGORY_BUCKET[fixture.category] === scope;
}

// ── Time-scope → status filter contract ──────────────────────────
function timeToStatuses(time: LiveDiscoveryTimeScope): LiveDiscoveryStatus[] {
  switch (time) {
    case "NOW":       return ["LIVE_NOW"];
    case "TONIGHT":   return ["LIVE_NOW", "STARTING_SOON", "TONIGHT"];
    case "TODAY":     return ["LIVE_NOW", "STARTING_SOON", "TONIGHT"];
    case "UPCOMING":  return ["STARTING_SOON", "TONIGHT", "UPCOMING"];
    case "ANY":       return ["LIVE_NOW", "STARTING_SOON", "TONIGHT"];
  }
}

// ── Public shape ─────────────────────────────────────────────────

export type LiveDiscoveryReply = {
  summary: string;                         // conversational · caller's language
  cards: EntityLiveCard[];                 // real fixtures only · never fabricated
  status_counts: Record<LiveDiscoveryStatus, number>;
  city_used: string | null;                // null when we could not pick a city honestly
  category_used: LiveDiscoveryCategoryScope;
  empty_reason:
    | null
    | "no_city_context"
    | "no_timing_sidecar"
    | "no_fixtures_for_scope"
    | "everything_gated_out";
};

export type LiveDiscoveryHandlerInput = {
  scope: LiveDiscoveryScope;
  /** Fallback city when the scope carried no explicit_city (e.g.
   *  session default). Null means the caller has no city — the
   *  handler will return an honest empty answer rather than invent
   *  one. */
  session_city: string | null;
  now_iso?: string;
};

// ── Handler ──────────────────────────────────────────────────────

export async function runLiveDiscoveryHandler(input: LiveDiscoveryHandlerInput): Promise<LiveDiscoveryReply> {
  const now_iso = input.now_iso ?? new Date().toISOString();
  const city = input.scope.explicit_city ?? input.session_city ?? null;
  const category = input.scope.category_scope;

  const zeroCounts: Record<LiveDiscoveryStatus, number> = {
    LIVE_NOW: 0, STARTING_SOON: 0, TONIGHT: 0, UPCOMING: 0, ENDED: 0, STALE: 0, UNKNOWN: 0,
  };

  if (city === null) {
    return {
      summary: composeSummary({ items: 0, city: null, lang: input.scope.language, time: input.scope.time_scope, category, empty_reason: "no_city_context" }),
      cards: [],
      status_counts: zeroCounts,
      city_used: null,
      category_used: category,
      empty_reason: "no_city_context",
    };
  }

  const timing = readTimingSidecar();
  if (!timing) {
    return {
      summary: composeSummary({ items: 0, city, lang: input.scope.language, time: input.scope.time_scope, category, empty_reason: "no_timing_sidecar" }),
      cards: [],
      status_counts: zeroCounts,
      city_used: city,
      category_used: category,
      empty_reason: "no_timing_sidecar",
    };
  }

  const cityFixtures = Object.values(timing.fixtures).filter((f) => f.city_slug === city);
  const scoped = cityFixtures.filter((f) => categoryMatches(f, category));
  if (scoped.length === 0) {
    return {
      summary: composeSummary({ items: 0, city, lang: input.scope.language, time: input.scope.time_scope, category, empty_reason: "no_fixtures_for_scope" }),
      cards: [],
      status_counts: zeroCounts,
      city_used: city,
      category_used: category,
      empty_reason: "no_fixtures_for_scope",
    };
  }

  const wantedStatuses = new Set<LiveDiscoveryStatus>(timeToStatuses(input.scope.time_scope));

  type Prelim = { fixture: FixtureTiming; live_status: LiveDiscoveryStatus };
  const prelim: Prelim[] = [];
  const counts: Record<LiveDiscoveryStatus, number> = { ...zeroCounts };

  for (const fx of scoped) {
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
    counts[live_status] = (counts[live_status] ?? 0) + 1;
    if (!wantedStatuses.has(live_status)) continue;
    prelim.push({ fixture: fx, live_status });
  }

  if (prelim.length === 0) {
    return {
      summary: composeSummary({ items: 0, city, lang: input.scope.language, time: input.scope.time_scope, category, empty_reason: "everything_gated_out" }),
      cards: [],
      status_counts: counts,
      city_used: city,
      category_used: category,
      empty_reason: "everything_gated_out",
    };
  }

  prelim.sort((a, b) => {
    const wa = discoveryOrderWeight(a.live_status);
    const wb = discoveryOrderWeight(b.live_status);
    if (wa !== wb) return wa - wb;
    return a.fixture.started_at_iso.localeCompare(b.fixture.started_at_iso);
  });

  const uniqueMediaIds = Array.from(new Set(prelim.map((p) => p.fixture.media_id)));
  const resolved = await resolveMediaForPlayback(uniqueMediaIds);
  const byId = new Map(resolved.map((r) => [r.media_id, r]));

  const cards: EntityLiveCard[] = prelim.map((p) => {
    const r = byId.get(p.fixture.media_id) ?? null;
    return {
      media_id: p.fixture.media_id,
      title: p.fixture.entity_name ? `${p.fixture.title} · ${p.fixture.entity_name}` : p.fixture.title,
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
    summary: composeSummary({ items: cards.length, city, lang: input.scope.language, time: input.scope.time_scope, category, counts, empty_reason: null }),
    cards,
    status_counts: counts,
    city_used: city,
    category_used: category,
    empty_reason: null,
  };
}

// ── Conversational summary composer ──────────────────────────────

function composeSummary(args: {
  items: number;
  city: string | null;
  lang: LiveDiscoveryLanguage;
  time: LiveDiscoveryTimeScope;
  category: LiveDiscoveryCategoryScope;
  counts?: Record<LiveDiscoveryStatus, number>;
  empty_reason: LiveDiscoveryReply["empty_reason"];
}): string {
  const isID = args.lang === "ID" || args.lang === "MIXED";
  const cityLabel = args.city ? capitalize(args.city) : null;

  // Honest empty states · never fabricate.
  if (args.empty_reason === "no_city_context") {
    return isID
      ? "Aku belum tahu kota kamu — bilang saja kota mana, dan aku cek apa yang sedang berlangsung."
      : "I don't know which city yet — tell me the city and I'll check what's live.";
  }
  if (args.empty_reason === "no_timing_sidecar") {
    return isID
      ? "Data Live belum tersedia di lingkungan ini."
      : "Live data isn't available in this environment right now.";
  }
  if (args.empty_reason === "no_fixtures_for_scope" || args.empty_reason === "everything_gated_out") {
    const scope = args.category !== "any" ? categoryLabel(args.category, isID) : "";
    const where = cityLabel ? (isID ? ` di ${cityLabel}` : ` in ${cityLabel}`) : "";
    return isID
      ? `Tidak ada ${scope || "acara"} live${where} saat ini. Aku tidak menampilkan sesuatu yang tidak ada.`
      : `Nothing verified ${scope ? scope + " " : ""}live${where} right now. I won't show something that isn't happening.`;
  }

  const timeWord = timeWord_(args.time, isID);
  const where = cityLabel ? (isID ? ` di ${cityLabel}` : ` in ${cityLabel}`) : "";
  const c = args.counts ?? { LIVE_NOW: 0, STARTING_SOON: 0, TONIGHT: 0, UPCOMING: 0, ENDED: 0, STALE: 0, UNKNOWN: 0 };

  const parts: string[] = [];
  if (c.LIVE_NOW > 0)      parts.push(isID ? `${c.LIVE_NOW} sedang live sekarang` : `${c.LIVE_NOW} live now`);
  if (c.STARTING_SOON > 0) parts.push(isID ? `${c.STARTING_SOON} akan mulai segera` : `${c.STARTING_SOON} starting soon`);
  if (c.TONIGHT > 0)       parts.push(isID ? `${c.TONIGHT} nanti malam` : `${c.TONIGHT} later tonight`);

  if (parts.length === 0) {
    return isID
      ? `Ada ${args.items} acara live${where} ${timeWord}.`
      : `There ${args.items === 1 ? "is" : "are"} ${args.items} live ${args.items === 1 ? "experience" : "experiences"}${where} ${timeWord}.`;
  }

  return isID
    ? `Ada beberapa hal live${where} ${timeWord} — ${parts.join(", ")}.`
    : `There are a few things live${where} ${timeWord} — ${parts.join(", ")}.`;
}

function timeWord_(t: LiveDiscoveryTimeScope, isID: boolean): string {
  switch (t) {
    case "NOW":      return isID ? "sekarang"   : "right now";
    case "TONIGHT":  return isID ? "malam ini"  : "tonight";
    case "TODAY":    return isID ? "hari ini"   : "today";
    case "UPCOMING": return isID ? "sebentar lagi" : "soon";
    case "ANY":      return isID ? "sekarang"   : "right now";
  }
}

function categoryLabel(c: LiveDiscoveryCategoryScope, isID: boolean): string {
  switch (c) {
    case "music":    return isID ? "musik"     : "music";
    case "food":     return isID ? "kuliner"   : "restaurant";
    case "gym":      return isID ? "gym"       : "gym";
    case "events":   return isID ? "acara"     : "event";
    case "hotel":    return isID ? "hotel"     : "hotel";
    case "venue":    return isID ? "tempat"    : "venue";
    case "activity": return isID ? "kegiatan"  : "activity";
    case "any":      return "";
  }
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
