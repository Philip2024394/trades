// src/lib/nex/entity-universe/entity-universe.test.ts
//
// NEX Entity Universe · Phase B tests (§35)

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  rateFreshness,
  DEFAULT_FRESHNESS_TTL_MS,
  type BusinessIdentity,
  type BusinessPlacement,
  type CategoryAssignment,
  type LocationRef,
} from "./types";
import { matchBusiness, _internal } from "./identity-matching";
import {
  decidePlacementIntent,
  diffPlacementAttributes,
  diffBusinessIdentity,
  evolveCategory,
  canPlacementStatusTransition,
  assertPlacementStatusTransition,
} from "./lifecycle";
import {
  recordEvidence,
  upsertBusiness,
  upsertPlacement,
  demotePlacementsToHistorical,
  readBusiness,
  readActivePlacementsForBusiness,
  readAllPlacementsForBusiness,
  buildCandidatePool,
  readChangesForBusiness,
  readChangesForPlacement,
} from "./persistence";
import {
  readBusinessDetail,
  findActiveBusinessesByCity,
  findActiveBusinessesByProvince,
  findActiveBusinessesByCategory,
  siblingActiveLocations,
  historicalLocations,
} from "./query";

const NOW = "2026-09-06T12:00:00.000Z";

function isolate() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nex-entity-universe-"));
  process.env.NEX_ENTITY_UNIVERSE_DATA_ROOT = tmp;
}

function makeIdentity(overrides: Partial<BusinessIdentity> = {}): BusinessIdentity {
  return {
    business_id: overrides.business_id ?? `biz_${randomUUID()}`,
    name: overrides.name ?? "Test Business",
    alternate_names: overrides.alternate_names ?? [],
    identity_confidence: overrides.identity_confidence ?? "MEDIUM",
    owner_nex_id: overrides.owner_nex_id ?? null,
    registered_at_iso: overrides.registered_at_iso ?? NOW,
    last_evidence_at_iso: overrides.last_evidence_at_iso ?? NOW,
  };
}
function makeLocation(city: string, province: string | null = null, address: string | null = null): LocationRef {
  return { city_slug: city, province_code: province, area: null, address, coordinates: null };
}
function makeCategory(vertical: "food" | "accommodation" | "service" | "commerce" | "transport" | "places" = "food", sub = "restaurant"): CategoryAssignment {
  return {
    vertical,
    sub_category: sub,
    additional_sub_categories: [],
    specificity: "SUB_CATEGORY_KNOWN",
    effective_from_iso: NOW,
    superseded_at_iso: null,
    evidence_ids: [],
  };
}
function makePlacement(overrides: Partial<BusinessPlacement>): BusinessPlacement {
  return {
    placement_id: overrides.placement_id ?? `pmt_${randomUUID()}`,
    business_id: overrides.business_id ?? "biz_missing",
    world_record_ref: overrides.world_record_ref ?? null,
    location: overrides.location ?? makeLocation("yogyakarta", "ID-YO"),
    category: overrides.category ?? makeCategory(),
    phone: overrides.phone ?? null,
    whatsapp: overrides.whatsapp ?? null,
    website: overrides.website ?? null,
    email: overrides.email ?? null,
    opening_hours: overrides.opening_hours ?? null,
    status: overrides.status ?? "ACTIVE",
    effective_from_iso: overrides.effective_from_iso ?? NOW,
    effective_to_iso: overrides.effective_to_iso ?? null,
    evidence_ids: overrides.evidence_ids ?? [],
    registered_at_iso: overrides.registered_at_iso ?? NOW,
  };
}

// ── §12 freshness rating ─────────────────────────────────────────

describe("freshness rating", () => {
  it("null last_observed → UNKNOWN (never guesses)", () => {
    expect(rateFreshness({ klass: "DYNAMIC_CAPABILITY", last_observed_iso: null, now_iso: NOW })).toBe("UNKNOWN");
  });
  it("fresh within TTL → CURRENT", () => {
    const observed = new Date(Date.parse(NOW) - 60_000).toISOString();
    expect(rateFreshness({ klass: "DYNAMIC_CAPABILITY", last_observed_iso: observed, now_iso: NOW })).toBe("CURRENT");
  });
  it("older than TTL → STALE", () => {
    const observed = new Date(Date.parse(NOW) - DEFAULT_FRESHNESS_TTL_MS.LIVE_STATUS - 60_000).toISOString();
    expect(rateFreshness({ klass: "LIVE_STATUS", last_observed_iso: observed, now_iso: NOW })).toBe("STALE");
  });
  it("is_conflicting → CONFLICTING regardless of age", () => {
    expect(rateFreshness({ klass: "STABLE_LOCATION", last_observed_iso: NOW, now_iso: NOW, is_conflicting: true })).toBe("CONFLICTING");
  });
  it("STABLE_IDENTITY has longer TTL than DYNAMIC_CAPABILITY", () => {
    expect(DEFAULT_FRESHNESS_TTL_MS.STABLE_IDENTITY).toBeGreaterThan(DEFAULT_FRESHNESS_TTL_MS.DYNAMIC_CAPABILITY);
    expect(DEFAULT_FRESHNESS_TTL_MS.DYNAMIC_CAPABILITY).toBeGreaterThan(DEFAULT_FRESHNESS_TTL_MS.LIVE_STATUS);
  });
});

// ── §10 identity matching ────────────────────────────────────────

describe("identity-matching · §10 immutable", () => {
  it("owner_nex_id exact match → MATCH", () => {
    const identity = makeIdentity({ owner_nex_id: "u1" });
    const placement = makePlacement({ business_id: identity.business_id });
    const result = matchBusiness({
      candidate: { name: "Completely Different Name", location: makeLocation("jakarta"), phone: null, whatsapp: null, website: null, owner_nex_id: "u1" },
      pool: [{ identity, placements: [placement] }],
    });
    expect(result.verdict).toBe("MATCH");
    expect(result.best_business_id).toBe(identity.business_id);
  });
  it("high name overlap + same city + shared phone → MATCH", () => {
    const identity = makeIdentity({ name: "Example Restaurant" });
    const placement = makePlacement({
      business_id: identity.business_id,
      location: makeLocation("yogyakarta", "ID-YO"),
      phone: "+62 812 3456 7890",
    });
    const result = matchBusiness({
      candidate: {
        name: "Example Restaurant",
        location: makeLocation("yogyakarta", "ID-YO"),
        phone: "081234567890",   // same digits, different format
        whatsapp: null, website: null, owner_nex_id: null,
      },
      pool: [{ identity, placements: [placement] }],
    });
    expect(result.verdict).toBe("MATCH");
  });
  it("cross-city name-only match → AMBIGUOUS not MATCH (§25)", () => {
    const identity = makeIdentity({ name: "Cafe A" });
    const placement = makePlacement({
      business_id: identity.business_id,
      location: makeLocation("yogyakarta", "ID-YO"),
    });
    const result = matchBusiness({
      candidate: {
        name: "Cafe A",
        location: makeLocation("jakarta", "ID-JK"),
        phone: null, whatsapp: null, website: null, owner_nex_id: null,
      },
      pool: [{ identity, placements: [placement] }],
    });
    expect(["AMBIGUOUS", "NO_MATCH"]).toContain(result.verdict);
    expect(result.verdict).not.toBe("MATCH");
  });
  it("two candidates within 0.10 score → force AMBIGUOUS (never silently prefers first)", () => {
    const id1 = makeIdentity({ business_id: "biz_1", name: "Golden Palace" });
    const id2 = makeIdentity({ business_id: "biz_2", name: "Golden Palace" });
    const p1 = makePlacement({ business_id: "biz_1", location: makeLocation("yogyakarta", "ID-YO") });
    const p2 = makePlacement({ business_id: "biz_2", location: makeLocation("yogyakarta", "ID-YO") });
    const result = matchBusiness({
      candidate: {
        name: "Golden Palace", location: makeLocation("yogyakarta", "ID-YO"),
        phone: null, whatsapp: null, website: null, owner_nex_id: null,
      },
      pool: [{ identity: id1, placements: [p1] }, { identity: id2, placements: [p2] }],
    });
    expect(result.verdict).toBe("AMBIGUOUS");
    expect(result.competing_matches.length).toBeGreaterThanOrEqual(2);
  });
  it("NO_MATCH when pool is empty", () => {
    const result = matchBusiness({
      candidate: { name: "Anything", location: makeLocation("yogyakarta"), phone: null, whatsapp: null, website: null, owner_nex_id: null },
      pool: [],
    });
    expect(result.verdict).toBe("NO_MATCH");
    expect(result.best_business_id).toBeNull();
  });
  it("thresholds are conservative (MATCH ≥ 0.85, AMBIGUOUS ≥ 0.55)", () => {
    expect(_internal.MATCH_THRESHOLD).toBeGreaterThanOrEqual(0.85);
    expect(_internal.AMBIGUOUS_THRESHOLD).toBeGreaterThanOrEqual(0.5);
  });
});

// ── §4 §5 movement / multi-location intent ──────────────────────

describe("lifecycle · decidePlacementIntent", () => {
  it("multi-location signal + new city → APPEND_NEW_ACTIVE (§5)", () => {
    const existing = [makePlacement({ business_id: "b1", location: makeLocation("yogyakarta", "ID-YO") })];
    const intent = decidePlacementIntent({
      existing_active_placements: existing,
      new_location: makeLocation("jakarta", "ID-JK"),
      signal: { prior_closed: false, prior_moved: false, is_multi_location_signal: true, identity_confidence: "HIGH" },
    });
    expect(intent).toBe("APPEND_NEW_ACTIVE");
  });
  it("prior_moved + new city → MOVE_MARK_PRIOR_HISTORICAL (§4)", () => {
    const existing = [makePlacement({ business_id: "b1", location: makeLocation("yogyakarta", "ID-YO") })];
    const intent = decidePlacementIntent({
      existing_active_placements: existing,
      new_location: makeLocation("jakarta", "ID-JK"),
      signal: { prior_closed: false, prior_moved: true, is_multi_location_signal: false, identity_confidence: "HIGH" },
    });
    expect(intent).toBe("MOVE_MARK_PRIOR_HISTORICAL");
  });
  it("prior_closed + no expansion → CLOSE_PRIOR", () => {
    const existing = [makePlacement({ business_id: "b1", location: makeLocation("yogyakarta", "ID-YO") })];
    const intent = decidePlacementIntent({
      existing_active_placements: existing,
      new_location: makeLocation("yogyakarta", "ID-YO"),
      signal: { prior_closed: true, prior_moved: false, is_multi_location_signal: false, identity_confidence: "HIGH" },
    });
    expect(intent).toBe("CLOSE_PRIOR");
  });
  it("AMBIGUOUS identity → MARK_AMBIGUOUS (never merges on uncertainty)", () => {
    const intent = decidePlacementIntent({
      existing_active_placements: [],
      new_location: makeLocation("yogyakarta"),
      signal: { prior_closed: false, prior_moved: false, is_multi_location_signal: false, identity_confidence: "AMBIGUOUS" },
    });
    expect(intent).toBe("MARK_AMBIGUOUS");
  });
  it("same city + no signal → NO_CHANGE", () => {
    const existing = [makePlacement({ business_id: "b1", location: makeLocation("yogyakarta", "ID-YO") })];
    const intent = decidePlacementIntent({
      existing_active_placements: existing,
      new_location: makeLocation("yogyakarta", "ID-YO"),
      signal: { prior_closed: false, prior_moved: false, is_multi_location_signal: false, identity_confidence: "HIGH" },
    });
    expect(intent).toBe("NO_CHANGE");
  });
});

// ── §11 no blind overwrite · diff → change records ─────────────

describe("lifecycle · diffPlacementAttributes", () => {
  it("phone change produces a PHONE_CHANGED record with prev+new+evidence", () => {
    const prev = makePlacement({ business_id: "b1", phone: "+62 12 old" });
    const changes = diffPlacementAttributes({
      previous: prev,
      incoming: { phone: "+62 12 new" },
      change_reason: "source_x_observed_new_phone",
      evidence_ids: ["ev1"],
      confidence: "HIGH",
    });
    expect(changes.length).toBe(1);
    expect(changes[0].kind).toBe("PHONE_CHANGED");
    expect(changes[0].previous_value).toBe("+62 12 old");
    expect(changes[0].new_value).toBe("+62 12 new");
    expect(changes[0].evidence_ids).toEqual(["ev1"]);
  });
  it("no-op when value unchanged", () => {
    const prev = makePlacement({ business_id: "b1", phone: "same" });
    const changes = diffPlacementAttributes({
      previous: prev, incoming: { phone: "same" },
      change_reason: "x", evidence_ids: [], confidence: "HIGH",
    });
    expect(changes.length).toBe(0);
  });
  it("category evolution recorded (§7)", () => {
    const prev = makePlacement({ business_id: "b1", category: makeCategory("food", "cafe") });
    const changes = diffPlacementAttributes({
      previous: prev,
      incoming: { category: makeCategory("food", "cafe_restaurant") },
      change_reason: "expanded_menu", evidence_ids: ["ev2"], confidence: "MEDIUM",
    });
    expect(changes.some((c) => c.kind === "CATEGORY_CHANGED")).toBe(true);
  });
});

describe("lifecycle · diffBusinessIdentity", () => {
  it("NAME_CHANGED recorded", () => {
    const prev = makeIdentity({ business_id: "b1", name: "Old Name" });
    const changes = diffBusinessIdentity({
      previous: prev,
      incoming: { name: "New Name" },
      change_reason: "rename",
      evidence_ids: ["ev"],
      confidence: "HIGH",
    });
    expect(changes.length).toBe(1);
    expect(changes[0].kind).toBe("NAME_CHANGED");
    expect(changes[0].previous_value).toBe("Old Name");
    expect(changes[0].new_value).toBe("New Name");
  });
  it("ALTERNATE_NAME_ADDED for each new alias", () => {
    const prev = makeIdentity({ business_id: "b1", name: "X", alternate_names: ["X Group"] });
    const changes = diffBusinessIdentity({
      previous: prev, incoming: { alternate_names: ["X Group", "X International"] },
      change_reason: "observed_new_alias", evidence_ids: [], confidence: "MEDIUM",
    });
    const added = changes.filter((c) => c.kind === "ALTERNATE_NAME_ADDED");
    expect(added.length).toBe(1);
    expect(added[0].new_value).toBe("X International");
  });
});

describe("lifecycle · evolveCategory", () => {
  it("no evolution when nothing changed", () => {
    const cur = makeCategory("food", "restaurant");
    const r = evolveCategory({
      current: cur, incoming_vertical: "food",
      incoming_sub_category: "restaurant", evidence_ids: [],
    });
    expect(r.evolved).toBe(false);
    expect(r.next).toBeNull();
  });
  it("sub_category evolution retains prior as additional (§7)", () => {
    const cur = makeCategory("food", "cafe");
    const r = evolveCategory({
      current: cur, incoming_vertical: "food",
      incoming_sub_category: "restaurant", evidence_ids: ["ev"],
    });
    expect(r.evolved).toBe(true);
    expect(r.next?.sub_category).toBe("restaurant");
    expect(r.next?.additional_sub_categories).toContain("cafe");
  });
  it("additional sub-categories retained cumulatively", () => {
    const cur = makeCategory("service", "repair");
    cur.additional_sub_categories = ["installation"];
    const r = evolveCategory({
      current: cur, incoming_vertical: "service",
      incoming_sub_category: "repair",
      additional_sub_categories: ["consulting"], evidence_ids: [],
    });
    expect(r.next?.additional_sub_categories.sort()).toEqual(["consulting", "installation"]);
  });
});

describe("lifecycle · placement status transitions", () => {
  it("ACTIVE → HISTORICAL allowed", () => expect(canPlacementStatusTransition("ACTIVE", "HISTORICAL")).toBe(true));
  it("ACTIVE → CLOSED allowed", () => expect(canPlacementStatusTransition("ACTIVE", "CLOSED")).toBe(true));
  it("HISTORICAL → ACTIVE allowed (reactivation with new evidence)", () => expect(canPlacementStatusTransition("HISTORICAL", "ACTIVE")).toBe(true));
  it("CLOSED → HISTORICAL FORBIDDEN", () => expect(canPlacementStatusTransition("CLOSED", "HISTORICAL")).toBe(false));
  it("assertPlacementStatusTransition throws on illegal", () => {
    expect(() => assertPlacementStatusTransition("CLOSED", "HISTORICAL")).toThrow(/invalid_placement_status_transition:CLOSED->HISTORICAL/);
  });
});

// ── Persistence + query · full round-trip ────────────────────────

describe("persistence + query · full round-trip", () => {
  beforeEach(() => isolate());
  it("upsert business + placement + read back via detail", () => {
    const b = makeIdentity({ business_id: "biz_1", name: "Example Restaurant" });
    upsertBusiness({ business: b, change: null });
    const p = makePlacement({
      business_id: b.business_id,
      location: makeLocation("yogyakarta", "ID-YO", "Jl. Test 1"),
    });
    upsertPlacement({ placement: p, changes: [] });
    const detail = readBusinessDetail(b.business_id);
    expect(detail).not.toBeNull();
    expect(detail?.identity.name).toBe("Example Restaurant");
    expect(detail?.active_placements.length).toBe(1);
    expect(detail?.discovery_flags.has_active_location).toBe(true);
    expect(detail?.discovery_flags.has_multiple_active_locations).toBe(false);
  });
  it("multi-location: same business, two active placements (§5)", () => {
    const b = makeIdentity({ business_id: "biz_gym", name: "Example Gym" });
    upsertBusiness({ business: b, change: null });
    upsertPlacement({ placement: makePlacement({ business_id: b.business_id, placement_id: "p1", location: makeLocation("yogyakarta", "ID-YO") }), changes: [] });
    upsertPlacement({ placement: makePlacement({ business_id: b.business_id, placement_id: "p2", location: makeLocation("jakarta", "ID-JK") }), changes: [] });
    upsertPlacement({ placement: makePlacement({ business_id: b.business_id, placement_id: "p3", location: makeLocation("bandung", "ID-JB") }), changes: [] });
    const siblings = siblingActiveLocations(b.business_id);
    expect(siblings.length).toBe(3);
    const cities = siblings.map((s) => s.location.city_slug).sort();
    expect(cities).toEqual(["bandung", "jakarta", "yogyakarta"]);
  });
  it("movement · demote prior to HISTORICAL, keep identity (§4)", () => {
    const b = makeIdentity({ business_id: "biz_move", name: "Example Cafe" });
    upsertBusiness({ business: b, change: null });
    const oldP = makePlacement({ business_id: b.business_id, placement_id: "p_old", location: makeLocation("yogyakarta", "ID-YO") });
    const newP = makePlacement({ business_id: b.business_id, placement_id: "p_new", location: makeLocation("jakarta", "ID-JK") });
    upsertPlacement({ placement: oldP, changes: [] });
    upsertPlacement({ placement: newP, changes: [] });
    demotePlacementsToHistorical({
      business_id: b.business_id,
      demote_placement_ids: ["p_old"],
      reason: "relocation_evidence",
      evidence_ids: ["ev_relocation"],
    });
    const historical = historicalLocations(b.business_id);
    const active = readActivePlacementsForBusiness(b.business_id);
    expect(historical.length).toBe(1);
    expect(historical[0].location.city_slug).toBe("yogyakarta");
    expect(active.length).toBe(1);
    expect(active[0].location.city_slug).toBe("jakarta");
    const changes = readChangesForPlacement("p_old");
    expect(changes.some((c) => c.kind === "STATUS_CHANGED" && c.new_value === "HISTORICAL")).toBe(true);
  });
  it("findActiveBusinessesByCity does NOT surface HISTORICAL placements (§4 §22)", () => {
    const b = makeIdentity({ business_id: "biz_x", name: "X" });
    upsertBusiness({ business: b, change: null });
    upsertPlacement({ placement: makePlacement({ business_id: b.business_id, placement_id: "old", location: makeLocation("yogyakarta", "ID-YO") }), changes: [] });
    upsertPlacement({ placement: makePlacement({ business_id: b.business_id, placement_id: "new", location: makeLocation("jakarta", "ID-JK") }), changes: [] });
    demotePlacementsToHistorical({ business_id: b.business_id, demote_placement_ids: ["old"], reason: "moved", evidence_ids: [] });
    const yog = findActiveBusinessesByCity("yogyakarta");
    const jak = findActiveBusinessesByCity("jakarta");
    expect(yog.length).toBe(0);
    expect(jak.length).toBe(1);
  });
  it("findActiveBusinessesByProvince works across cities in same province", () => {
    const b = makeIdentity({ business_id: "biz_reg", name: "Regional Business" });
    upsertBusiness({ business: b, change: null });
    upsertPlacement({ placement: makePlacement({ business_id: b.business_id, placement_id: "p1", location: makeLocation("bandung", "ID-JB") }), changes: [] });
    upsertPlacement({ placement: makePlacement({ business_id: b.business_id, placement_id: "p2", location: makeLocation("bekasi", "ID-JB") }), changes: [] });
    const results = findActiveBusinessesByProvince("ID-JB");
    expect(results.length).toBe(2);
  });
  it("findActiveBusinessesByCategory filters by vertical + city + sub_category", () => {
    const restaurant = makeIdentity({ business_id: "biz_r", name: "R" });
    const gym = makeIdentity({ business_id: "biz_g", name: "G" });
    upsertBusiness({ business: restaurant, change: null });
    upsertBusiness({ business: gym, change: null });
    upsertPlacement({ placement: makePlacement({ business_id: "biz_r", placement_id: "pr", location: makeLocation("jakarta", "ID-JK"), category: makeCategory("food", "restaurant") }), changes: [] });
    upsertPlacement({ placement: makePlacement({ business_id: "biz_g", placement_id: "pg", location: makeLocation("jakarta", "ID-JK"), category: makeCategory("service", "gym") }), changes: [] });
    const foodInJakarta = findActiveBusinessesByCategory({ vertical: "food", city_slug: "jakarta" });
    expect(foodInJakarta.length).toBe(1);
    expect(foodInJakarta[0].business.business_id).toBe("biz_r");
    const gymsInJakarta = findActiveBusinessesByCategory({ vertical: "service", sub_category: "gym", city_slug: "jakarta" });
    expect(gymsInJakarta.length).toBe(1);
    expect(gymsInJakarta[0].business.business_id).toBe("biz_g");
  });
  it("candidate pool built from persistence for matching", () => {
    const b = makeIdentity({ business_id: "biz_pool", name: "Pool" });
    upsertBusiness({ business: b, change: null });
    upsertPlacement({ placement: makePlacement({ business_id: b.business_id, location: makeLocation("yogyakarta", "ID-YO") }), changes: [] });
    const pool = buildCandidatePool();
    expect(pool.length).toBe(1);
    expect(pool[0].placements.length).toBe(1);
  });
  it("evidence records are addressable by id", () => {
    const ev = recordEvidence({ source_key: "osm", source_url: null, tier: "SECONDARY_SOURCE", observed_at_iso: NOW, excerpt: null });
    expect(ev.evidence_id.length).toBeGreaterThan(0);
  });
  it("upsertBusiness change record written alongside", () => {
    const b = makeIdentity({ business_id: "biz_c" });
    const change = diffBusinessIdentity({
      previous: b,
      incoming: { name: "New Legal Name" },
      change_reason: "legal_rename",
      evidence_ids: [],
      confidence: "HIGH",
    })[0];
    upsertBusiness({ business: { ...b, name: "New Legal Name" }, change });
    const history = readChangesForBusiness(b.business_id);
    expect(history.length).toBe(1);
    expect(history[0].kind).toBe("NAME_CHANGED");
  });
});

// ── §22 discovery flags (customer-facing truth) ─────────────────

describe("discovery flags surface truth", () => {
  beforeEach(() => isolate());
  it("business with 2 active locations flags multiple_active", () => {
    const b = makeIdentity({ business_id: "biz_multi" });
    upsertBusiness({ business: b, change: null });
    upsertPlacement({ placement: makePlacement({ business_id: b.business_id, placement_id: "a", location: makeLocation("yogyakarta", "ID-YO") }), changes: [] });
    upsertPlacement({ placement: makePlacement({ business_id: b.business_id, placement_id: "b", location: makeLocation("jakarta", "ID-JK") }), changes: [] });
    const d = readBusinessDetail(b.business_id);
    expect(d?.discovery_flags.has_multiple_active_locations).toBe(true);
  });
  it("business with only historical flags no_active + has_historical", () => {
    const b = makeIdentity({ business_id: "biz_hist" });
    upsertBusiness({ business: b, change: null });
    upsertPlacement({
      placement: makePlacement({ business_id: b.business_id, status: "HISTORICAL", effective_to_iso: NOW }),
      changes: [],
    });
    const d = readBusinessDetail(b.business_id);
    expect(d?.discovery_flags.has_active_location).toBe(false);
    expect(d?.discovery_flags.has_any_historical_location).toBe(true);
  });
});
