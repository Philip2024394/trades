// data.test.ts · covers the whole data layer.
// Freshness, quality, change detection, conflict resolution, entity
// resolution, geo hierarchy, coverage matrix. All deterministic ·
// no network · no LLM.

import { describe, it, expect } from "vitest";
import { FRESHNESS_WINDOW_MS, computeStaleness, stampVerified, needsRefresh } from "./freshness";
import { scoreEntity } from "./quality";
import { detectChanges } from "./change-detection";
import { resolveConflict } from "./conflict";
import { scoreMerge, shouldMerge, mergeEntities, normalisePhone, normaliseName } from "./entity-resolution";
import { listProvinces, provinceCount, resolveProvince, provincesByIsland, buildCoverageMatrix, summariseByProvince } from "./geo";
import type { EntityRecord, ProvenanceRef } from "./types";

// ─── Geo hierarchy ────────────────────────────────────────────────

describe("geo · 38 provinces registry", () => {
  it("has all 38 provinces of Indonesia (post-2022 Papua split)", () => {
    expect(provinceCount()).toBe(38);
  });

  it("groups provinces into 8 islands", () => {
    const islands = new Set(listProvinces().map((p) => p.island));
    expect(islands.size).toBe(8);
    expect(islands.has("Sumatra")).toBe(true);
    expect(islands.has("Papua")).toBe(true);
    expect(islands.has("Bali")).toBe(true);
  });

  it("Papua now has 6 provinces (post-2022 split)", () => {
    const papua = provincesByIsland("Papua");
    expect(papua.length).toBe(6);
    expect(papua.map((p) => p.name).sort()).toContain("Highland Papua");
  });

  it("resolveProvince accepts slug / name / code / capital", () => {
    expect(resolveProvince("bali")?.code).toBe("ID-BA");
    expect(resolveProvince("Bali")?.code).toBe("ID-BA");
    expect(resolveProvince("ID-BA")?.slug).toBe("bali");
    expect(resolveProvince("Denpasar")?.slug).toBe("bali");
    expect(resolveProvince("nope")).toBeUndefined();
  });
});

describe("geo · coverage matrix", () => {
  it("empty observations → every cell not_covered", () => {
    const m = buildCoverageMatrix([], ["destinations", "food"]);
    expect(m.totals.notCovered).toBe(38 * 2);
    expect(m.totals.covered).toBe(0);
    expect(m.totals.coveragePct).toBe(0);
  });

  it("full observations → every cell covered", () => {
    const obs = listProvinces().flatMap((p) => [
      { province: p.slug, category: "destinations", recordCount: 5 },
      { province: p.slug, category: "food", recordCount: 3 },
    ]);
    const m = buildCoverageMatrix(obs, ["destinations", "food"]);
    expect(m.totals.covered).toBe(38 * 2);
    expect(m.totals.coveragePct).toBe(100);
  });

  it("summariseByProvince returns 38 entries with pct", () => {
    const obs = [
      { province: "bali", category: "destinations", recordCount: 5 },
    ];
    const m = buildCoverageMatrix(obs, ["destinations", "food"]);
    const summary = summariseByProvince(m);
    expect(summary.length).toBe(38);
    const bali = summary.find((s) => s.province === "Bali")!;
    expect(bali.covered).toBe(1);
    expect(bali.total).toBe(2);
    expect(bali.pct).toBe(50);
  });
});

// ─── Freshness engine ─────────────────────────────────────────────

describe("freshness engine", () => {
  it("windows cover live → long_lived in ascending order", () => {
    expect(FRESHNESS_WINDOW_MS.live).toBeLessThan(FRESHNESS_WINDOW_MS.very_fast);
    expect(FRESHNESS_WINDOW_MS.very_fast).toBeLessThan(FRESHNESS_WINDOW_MS.hourly);
    expect(FRESHNESS_WINDOW_MS.hourly).toBeLessThan(FRESHNESS_WINDOW_MS.daily);
    expect(FRESHNESS_WINDOW_MS.daily).toBeLessThan(FRESHNESS_WINDOW_MS.weekly);
    expect(FRESHNESS_WINDOW_MS.weekly).toBeLessThan(FRESHNESS_WINDOW_MS.monthly);
    expect(FRESHNESS_WINDOW_MS.monthly).toBeLessThan(FRESHNESS_WINDOW_MS.long_lived);
  });

  it("never-verified record has staleness 1 (maximally stale)", () => {
    expect(computeStaleness({ policy: "daily" })).toBe(1);
  });

  it("just-verified record has staleness ~0", () => {
    const now = new Date("2026-08-30T12:00:00Z");
    const state = stampVerified("daily", now);
    expect(computeStaleness(state, now)).toBe(0);
  });

  it("halfway through the window → staleness ~0.5", () => {
    const now = new Date("2026-08-30T12:00:00Z");
    const state = stampVerified("daily", now);
    // Advance 12 hours (half of 1 day).
    const later = new Date(now.getTime() + 12 * 60 * 60_000);
    const stale = computeStaleness(state, later);
    expect(stale).toBeGreaterThan(0.45);
    expect(stale).toBeLessThan(0.55);
  });

  it("needsRefresh true once nextRefreshAt has passed", () => {
    const now = new Date("2026-08-30T12:00:00Z");
    const state = stampVerified("hourly", now);
    expect(needsRefresh(state, now)).toBe(false);
    const later = new Date(now.getTime() + 60 * 60_001);
    expect(needsRefresh(state, later)).toBe(true);
  });
});

// ─── Quality scoring ──────────────────────────────────────────────

const baseProv = (source: string, tier: "A" | "B" | "C" | "D" = "A"): ProvenanceRef => ({
  walkerId: "w.test", sourceKey: source, sourceName: source, sourceTier: tier,
  firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30",
  lastChangedAt: "2026-08-30", observedAt: "2026-08-30",
});

const baseEntity = (over: Partial<EntityRecord> = {}): EntityRecord => ({
  id: "e-1", kind: "business", name: "Test Warung",
  keywords: ["warung", "food"],
  lifecycle: "PUBLISHED", lifecycleChangedAt: "2026-08-30",
  provenance: [baseProv("test")],
  freshness: stampVerified("weekly", new Date("2026-08-30T12:00:00Z")),
  ...over,
});

describe("quality scoring", () => {
  it("well-formed business with verified contact + geo scores > 0.7", () => {
    const e = baseEntity({
      description: "A good warung",
      geo: { province: "bali", regency: "denpasar", lat: -8.65, lng: 115.22 },
      contacts: [{ kind: "whatsapp", value: "+628123456789", verified: true }],
      attributes: { menu: [] },
      relations: { near: ["e-2"] },
    });
    const q = scoreEntity(e, new Date("2026-08-30T12:00:00Z"));
    expect(q.overall).toBeGreaterThan(0.7);
    expect(q.freshness).toBe(1);
    expect(q.contact).toBe(1);
    expect(q.location).toBe(1);
  });

  it("no contact + no geo drags business score down", () => {
    const e = baseEntity({ contacts: [] });
    const q = scoreEntity(e);
    expect(q.contact).toBe(0);
    expect(q.overall).toBeLessThan(0.7);
  });

  it("pure knowledge doesn't need geo or contact", () => {
    const k = baseEntity({ kind: "knowledge" });
    const q = scoreEntity(k, new Date("2026-08-30T12:00:00Z"));
    expect(q.location).toBe(1); // N/A treated as satisfied
    expect(q.contact).toBe(1);  // N/A treated as satisfied
  });

  it("multiple sources bump verification score", () => {
    const e = baseEntity({
      provenance: [baseProv("a"), baseProv("b"), baseProv("c")],
    });
    const q = scoreEntity(e);
    expect(q.verification).toBe(1);
  });
});

// ─── Change detection ─────────────────────────────────────────────

describe("change detection", () => {
  it("no diff → empty change list", () => {
    const a = baseEntity({ name: "Warung X" });
    const b = baseEntity({ name: "Warung X" });
    expect(detectChanges(a, b, "test")).toEqual([]);
  });

  it("name change → one ChangeEvent for name", () => {
    const a = baseEntity({ name: "Warung X" });
    const b = baseEntity({ name: "Warung Y" });
    const changes = detectChanges(a, b, "test");
    expect(changes.length).toBe(1);
    expect(changes[0].field).toBe("name");
    expect(changes[0].from).toBe("Warung X");
    expect(changes[0].to).toBe("Warung Y");
  });

  it("phone change on WhatsApp channel → ChangeEvent for contact.whatsapp", () => {
    const a = baseEntity({ contacts: [{ kind: "whatsapp", value: "+628111111111", verified: true }] });
    const b = baseEntity({ contacts: [{ kind: "whatsapp", value: "+628222222222", verified: true }] });
    const changes = detectChanges(a, b, "test");
    expect(changes.some((c) => c.field === "contact.whatsapp")).toBe(true);
  });

  it("adding a phone channel that wasn't there → ChangeEvent", () => {
    const a = baseEntity({ contacts: [] });
    const b = baseEntity({ contacts: [{ kind: "phone", value: "+628123", verified: true }] });
    const changes = detectChanges(a, b, "test");
    expect(changes.some((c) => c.field === "contact.phone" && c.from === null)).toBe(true);
  });

  it("geo.province change → ChangeEvent", () => {
    const a = baseEntity({ geo: { province: "bali" } });
    const b = baseEntity({ geo: { province: "di-yogyakarta" } });
    const changes = detectChanges(a, b, "test");
    expect(changes.some((c) => c.field === "geo.province")).toBe(true);
  });
});

// ─── Conflict resolution ──────────────────────────────────────────

describe("conflict resolution", () => {
  it("no observations → null", () => {
    expect(resolveConflict([])).toBeNull();
  });

  it("all agree → no conflict, one candidate", () => {
    const p = baseProv("a", "A");
    const r = resolveConflict([
      { value: "10:00-22:00", provenance: p },
      { value: "10:00-22:00", provenance: p },
    ]);
    expect(r?.hasConflict).toBe(false);
    expect(r?.candidates.length).toBe(1);
    expect(r?.candidates[0].corroboration).toBe(2);
  });

  it("Tier A single source wins over Tier D single source", () => {
    const r = resolveConflict([
      { value: "gov_hours", provenance: baseProv("gov", "A") },
      { value: "random_ugc", provenance: baseProv("random", "D") },
    ]);
    expect(r?.winner).toBe("gov_hours");
    expect(r?.hasConflict).toBe(true);
  });

  it("2 Tier-C sources corroborating beat 1 Tier-B source", () => {
    const r = resolveConflict([
      { value: "consensus", provenance: baseProv("web1", "C") },
      { value: "consensus", provenance: baseProv("web2", "C") },
      { value: "outlier", provenance: baseProv("commercial", "B") },
    ]);
    expect(r?.winner).toBe("consensus");
    expect(r?.candidates.find((c) => c.value === "consensus")?.corroboration).toBe(2);
  });
});

// ─── Entity resolution ────────────────────────────────────────────

describe("entity resolution · normalisation", () => {
  it("normalisePhone strips punctuation and prefixes 0→+62", () => {
    expect(normalisePhone("0812-3456-7890")).toBe("+62812345678903".slice(0, 14));
    expect(normalisePhone("+62 812 3456 7890")).toBe("+6281234567890");
  });

  it("normaliseName strips honorifics + duplicate whitespace", () => {
    expect(normaliseName("Warung Bu Siti")).toBe("siti");
    expect(normaliseName("Warung Ibu Siti")).toBe("siti");
    expect(normaliseName("The Coffee Roasters Café")).toBe("coffee roasters");
  });
});

describe("entity resolution · merge scoring", () => {
  const withPhone = (name: string, phone: string, lat?: number, lng?: number): EntityRecord => baseEntity({
    id: name.replace(/\s/g, ""), name,
    contacts: [{ kind: "phone", value: phone, verified: true }],
    geo: lat && lng ? { province: "bali", lat, lng } : undefined,
  });

  it("same phone + close coords → merge", () => {
    const a = withPhone("Warung Bu Siti", "+62812111", -8.65, 115.22);
    const b = withPhone("Warung Ibu Siti", "+62812111", -8.6501, 115.2201);
    expect(shouldMerge(a, b)).toBe("merge");
  });

  it("same phone even without coords → strong evidence merge", () => {
    const a = withPhone("Warung Bu Siti", "+62812111");
    const b = withPhone("Something Else Entirely", "+62812111");
    const v = scoreMerge(a, b);
    expect(v.strongEvidence).toBe(true);
  });

  it("different kinds → never merge", () => {
    const a = baseEntity({ kind: "business", name: "X" });
    const b = baseEntity({ kind: "knowledge", name: "X" });
    expect(shouldMerge(a, b)).toBe("no_merge");
  });

  it("similar name in same regency but no phone/coords → review", () => {
    const a = baseEntity({ name: "Warung Bu Siti", geo: { province: "di-yogyakarta", regency: "sleman" } });
    const b = baseEntity({ name: "Warung Ibu Siti", geo: { province: "di-yogyakarta", regency: "sleman" } });
    const verdict = shouldMerge(a, b);
    expect(["review", "merge"]).toContain(verdict);
  });

  it("merge preserves both provenance refs, unions contacts + keywords", () => {
    const a = baseEntity({
      id: "e-1", name: "Warung Bu Siti",
      provenance: [baseProv("google")],
      contacts: [{ kind: "phone", value: "+628123", verified: true }],
      keywords: ["warung", "sundanese"],
      aliases: [],
    });
    const b = baseEntity({
      id: "e-2", name: "Warung Ibu Siti",
      provenance: [baseProv("tripadvisor", "B")],
      contacts: [{ kind: "whatsapp", value: "+628123", verified: true }],
      keywords: ["warung", "lunch"],
      aliases: [],
    });
    const merged = mergeEntities(a, b);
    expect(merged.id).toBe("e-1");
    expect(merged.provenance.length).toBe(2);
    expect(merged.contacts?.length).toBe(2);
    expect(merged.keywords).toEqual(expect.arrayContaining(["warung", "sundanese", "lunch"]));
    // Loser's name becomes an alias.
    expect(merged.aliases).toContain("Warung Ibu Siti");
  });
});
