// src/lib/nex-native/directory/related-businesses/__tests__/service-tiered.test.ts
//
// NEX Directory · Related Businesses · tiered-reader composition tests.
//
// Covers
//   · fetchRelatedBusinessesTiered composes all three tiers in sealed order
//   · provided tier is omitted when the anchor has no provided[]/facilities[]
//   · partner tier is omitted when no partners are declared
//   · partner tier drops partner uuids that are not publishable
//   · nearby tier is omitted when the radius query returns zero groups
//   · when all three tiers are empty, returns []
//   · tier-1 self-reference items carry canonicalBusinessId === null
//   · tier-2 items carry the resolved partner uuid
//   · tier-3 flat `items` array mirrors the counts in nearbyGroups
//
// Stubbing strategy
//   `@/lib/nex/db`'s `withClient(fn)` is mocked to invoke `fn` with an
//   in-memory client whose `query(sql, params)` returns a scripted set
//   of rows based on the SQL fragment matched. No real DB is touched.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock state visible to the hoisted vi.mock factory ──────────────

interface MockState {
  readonly radiusRows: Record<string, Record<string, unknown>[]>; // keyed by first entity-type
  readonly partnerRows: Record<string, unknown>[];
  readonly queries: { sql: string; params: readonly unknown[] | undefined }[];
}

declare global {
  // eslint-disable-next-line no-var
  var __NEX_RELATED_SERVICE_TIERED_MOCK__: MockState | undefined;
}

function freshState(): MockState {
  return {
    radiusRows: {},
    partnerRows: [],
    queries: [],
  };
}

globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__ = freshState();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/nex/db", () => {
  return {
    withClient: async <T>(fn: (c: {
      query: (
        text: string,
        params?: unknown[],
      ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
    }) => Promise<T>): Promise<T | null> => {
      const client = {
        query: async (
          text: string,
          params?: unknown[],
        ): Promise<{
          rows: Record<string, unknown>[];
          rowCount: number | null;
        }> => {
          const st = globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__!;
          st.queries.push({ sql: text, params });

          if (text.includes("BEGIN")) return { rows: [], rowCount: null };
          if (text.includes("SET LOCAL")) return { rows: [], rowCount: null };
          if (text.includes("COMMIT")) return { rows: [], rowCount: null };
          if (text.includes("ROLLBACK")) return { rows: [], rowCount: null };

          // Partner-resolve SQL · identified by its unique projection
          if (text.includes("canonical_business_id = ANY($1::uuid[])")) {
            return { rows: st.partnerRows, rowCount: st.partnerRows.length };
          }
          // Radius SELECT · key by the first entity_type requested so
          // each group can return its own set of rows.
          if (text.includes("entity_type = ANY($2::text[])")) {
            const et = params?.[1] as readonly string[] | undefined;
            const key = et?.[0] ?? "";
            const rows = st.radiusRows[key] ?? [];
            return { rows, rowCount: rows.length };
          }
          return { rows: [], rowCount: 0 };
        },
      };
      return fn(client);
    },
  };
});

// Import AFTER mock registration so service.ts picks up the stub.
import {
  fetchRelatedBusinessesTiered,
  type TieredRelatedResult,
} from "../service";

const JAKARTA = { lat: -6.2088, lng: 106.8456 } as const;
const ANCHOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const PARTNER_A = "11111111-1111-4111-8111-111111111111";
const PARTNER_B = "22222222-2222-4222-8222-222222222222";

const FOOD_ROW = (name: string, dist = 300): Record<string, unknown> => ({
  canonical_business_id: `food-${name}`,
  name_canonical: name,
  city: "Jakarta",
  entity_type: "food",
  category_ids: [],
  phone_e164: null,
  website_apex: null,
  lat: -6.21,
  lng: 106.85,
  distance_m: dist,
});

beforeEach(() => {
  globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__ = freshState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("fetchRelatedBusinessesTiered · hotel anchor with all three tiers populated", () => {
  it("returns provided → partner → nearby in sealed order", async () => {
    const st = globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__!;
    // Tier 3 radius rows · hotel anchor's first group is vehicle_rental
    st.radiusRows = {
      vehicle_rental: [], // empty
      transport_driver: [], // empty
      food: [FOOD_ROW("Warung A", 200), FOOD_ROW("Cafe B", 500)],
      service: [], // laundry
      place: [], // attractions
    };
    // Tier 2 partner-resolve rows · partner A publishable, partner B not.
    st.partnerRows = [
      {
        canonical_business_id: PARTNER_A,
        name_canonical: "XYZ Transport",
        city: "Jakarta",
        entity_type: "transport_operator",
        category_ids: [],
        phone_e164: null,
        website_apex: null,
        lat: -6.21,
        lng: 106.85,
      },
      // PARTNER_B absent · simulates view-dropped (unpublishable)
    ];

    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "accommodation",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: {
        provided: ["Airport pickup", "Laundry"],
        facilities: ["Wi-Fi"],
        partners: [
          { canonical_business_id: PARTNER_A, label: "XYZ Airport" },
          { canonical_business_id: PARTNER_B },
        ],
      },
    });

    expect(tiers.map((t) => t.tier)).toEqual([
      "provided_by_business",
      "established_partner",
      "nearby_independent",
    ]);
  });

  it("tier-1 items are self-references (canonicalBusinessId === null)", async () => {
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "accommodation",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: { provided: ["Airport pickup"] },
    });
    const tier1 = tiers.find((t) => t.tier === "provided_by_business")!;
    expect(tier1).toBeDefined();
    expect(tier1.items[0]!.canonicalBusinessId).toBeNull();
    expect(tier1.items[0]!.label).toBe("Airport pickup");
  });

  it("tier-2 items carry the resolved partner uuid + label override", async () => {
    const st = globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__!;
    st.partnerRows = [
      {
        canonical_business_id: PARTNER_A,
        name_canonical: "XYZ Transport",
        city: "Jakarta",
        entity_type: "transport_operator",
        category_ids: [],
        phone_e164: null,
        website_apex: null,
        lat: -6.21,
        lng: 106.85,
      },
    ];
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "accommodation",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: {
        partners: [
          { canonical_business_id: PARTNER_A, label: "Our Airport Transfer" },
        ],
      },
    });
    const tier2 = tiers.find((t) => t.tier === "established_partner")!;
    expect(tier2.items[0]!.canonicalBusinessId).toBe(PARTNER_A);
    expect(tier2.items[0]!.label).toBe("Our Airport Transfer");
    expect(tier2.items[0]!.tier).toBe("established_partner");
  });

  it("tier-2 falls back to resolved name when no label override is declared", async () => {
    const st = globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__!;
    st.partnerRows = [
      {
        canonical_business_id: PARTNER_A,
        name_canonical: "XYZ Transport",
        city: "Jakarta",
        entity_type: "transport_operator",
        category_ids: [],
        phone_e164: null,
        website_apex: null,
        lat: -6.21,
        lng: 106.85,
      },
    ];
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "accommodation",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: {
        partners: [{ canonical_business_id: PARTNER_A }],
      },
    });
    const tier2 = tiers.find((t) => t.tier === "established_partner")!;
    expect(tier2.items[0]!.label).toBe("XYZ Transport");
  });
});

describe("fetchRelatedBusinessesTiered · honest-empty composition", () => {
  it("omits tier-1 when anchor has no provided[]/facilities[]", async () => {
    const st = globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__!;
    st.radiusRows = { food: [FOOD_ROW("Warung A")] };
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "food",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: null,
    });
    expect(tiers.map((t) => t.tier)).not.toContain("provided_by_business");
  });

  it("omits tier-2 when no partners are declared", async () => {
    const st = globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__!;
    st.radiusRows = { food: [FOOD_ROW("Warung A")] };
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "food",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: { provided: ["Delivery"] },
    });
    expect(tiers.map((t) => t.tier)).toEqual([
      "provided_by_business",
      "nearby_independent",
    ]);
  });

  it("omits tier-2 when every declared partner is unpublishable (view-dropped)", async () => {
    const st = globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__!;
    st.radiusRows = { food: [FOOD_ROW("Warung A")] };
    st.partnerRows = []; // view returns zero rows for the declared ids
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "accommodation",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: {
        partners: [{ canonical_business_id: PARTNER_A }],
      },
    });
    expect(tiers.map((t) => t.tier)).not.toContain("established_partner");
  });

  it("omits tier-3 when the radius query returns zero groups", async () => {
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "food",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: { provided: ["Delivery"] },
    });
    expect(tiers.map((t) => t.tier)).toEqual(["provided_by_business"]);
  });

  it("returns [] when all three tiers are empty", async () => {
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "food",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: null,
    });
    expect(tiers).toEqual([]);
  });

  it("current-behaviour preservation · null verticalPayload leaves tier-3 unchanged", async () => {
    const st = globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__!;
    st.radiusRows = {
      food: [FOOD_ROW("Warung A"), FOOD_ROW("Cafe B")],
      place: [],
    };
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "food",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: null,
    });
    expect(tiers).toHaveLength(1);
    expect(tiers[0]!.tier).toBe("nearby_independent");
    expect(tiers[0]!.items.length).toBeGreaterThan(0);
  });
});

describe("fetchRelatedBusinessesTiered · tier-3 flat items mirror nearbyGroups", () => {
  it("flattens nearbyGroups into items with matching counts", async () => {
    const st = globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__!;
    // food anchor relevance order from `relevance.ts`:
    //   vehicle_rental (0.6) · food (0.6) · place (0.8)
    st.radiusRows = {
      vehicle_rental: [],
      food: [FOOD_ROW("A"), FOOD_ROW("B"), FOOD_ROW("C")],
      place: [],
    };
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "food",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: null,
    });
    const tier3 = tiers.find((t) => t.tier === "nearby_independent")!;
    const nearbyGroupsCount = (tier3.nearbyGroups ?? []).reduce(
      (acc, g) => acc + g.results.length,
      0,
    );
    expect(tier3.items).toHaveLength(nearbyGroupsCount);
    expect(tier3.items.every((i) => i.tier === "nearby_independent")).toBe(true);
    expect(tier3.items.every((i) => i.canonicalBusinessId !== null)).toBe(true);
  });

  it("tier-3 flat items carry distanceMeters from the radius query", async () => {
    const st = globalThis.__NEX_RELATED_SERVICE_TIERED_MOCK__!;
    st.radiusRows = {
      vehicle_rental: [],
      food: [FOOD_ROW("Near", 150), FOOD_ROW("Far", 1200)],
      place: [],
    };
    const tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: ANCHOR_ID,
      anchorEntityType: "food",
      anchorCoords: JAKARTA,
      anchorVerticalPayload: null,
    });
    const tier3 = tiers.find((t) => t.tier === "nearby_independent")!;
    const distances = tier3.items.map((i) => i.distanceMeters);
    expect(distances).toContain(150);
    expect(distances).toContain(1200);
  });
});
