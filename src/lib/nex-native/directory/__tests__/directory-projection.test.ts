// src/lib/nex-native/directory/__tests__/directory-projection.test.ts
//
// NEX Directory · Phase B · projectDirectoryListing permutation tests.
//
// Covers
//   · Complete business row → VM (every field populated)
//   · Missing city / district / coordinates / phone / website / osm /
//     wikidata / aliases / categoryIds / verticalPayload / lastVerifiedAt /
//     supersedesBusinessId / supersededByBusinessId / primaryImage
//   · Each of the 9 sealed entity_types projects to the correct
//     classification + preserves identity
//   · Deterministic projection (byte-stable output over repeated calls)
//   · No fabricated defaults (nullable inputs project to nullable fields)
//   · Readonly contract (projector does not mutate its input)
//   · Supersession graph preserved
//   · Media attachment semantics (null, present, batch map)
//   · Batch projection preserves input order

import { describe, expect, it } from "vitest";
import {
  projectDirectoryListing,
  projectDirectoryListings,
} from "../project-canonical-row";
import type {
  DirectoryCanonicalRow,
  DirectoryCoordinates,
  DirectoryImage,
  DirectoryListingMedia,
  EntityType,
  LifecycleState,
} from "../types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Row fixtures · deterministic · no randomness · no clock
// ═════════════════════════════════════════════════════════════════════

const COORDS_JOGJA_WARUNG: DirectoryCoordinates = {
  lat: -7.797068,
  lng: 110.370529,
};

/** Fully-populated food business row. Phase B treats this as the
 *  "complete" case — every nullable column has a real value. */
function fullyPopulatedFoodRow(): DirectoryCanonicalRow {
  return {
    canonical_business_id: "11111111-1111-4111-8111-111111111111",
    entity_type: "food",
    country: "ID",
    lifecycle_state: "VERIFIED",
    name_canonical: "Warung Nasi Ibu Siti",
    aliases: ["Nasi Siti", "Warung Siti"],
    phone_e164: "+628123456789",
    website_apex: "warungibusiti.id",
    osm_id: "node/987654321",
    wikidata_qid: "Q98765",
    city: "Yogyakarta",
    district: "Umbulharjo",
    coordinates: COORDS_JOGJA_WARUNG,
    category_ids: ["restaurant", "indonesian-cuisine"],
    services_products: {
      menu_sections: [
        { name: "Nasi", items: ["Nasi Rames", "Nasi Pecel"] },
      ],
    },
    supersedes_business_id: null,
    superseded_by_business_id: null,
    last_verified_at: "2026-10-07T10:30:00.000Z",
  };
}

/** Minimal row — only the NOT NULL columns from migration 167.
 *  Every nullable column is null; aliases + category_ids are empty
 *  arrays (reflecting their DB defaults). */
function minimalRow(entityType: EntityType): DirectoryCanonicalRow {
  return {
    canonical_business_id: "22222222-2222-4222-8222-222222222222",
    entity_type: entityType,
    country: "ID",
    lifecycle_state: "DISCOVERED",
    name_canonical: "Minimal Example",
    aliases: [],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: null,
    district: null,
    coordinates: null,
    category_ids: [],
    services_products: null,
    supersedes_business_id: null,
    superseded_by_business_id: null,
    last_verified_at: null,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Complete-row projection
// ═════════════════════════════════════════════════════════════════════

describe("projectDirectoryListing · fully-populated food business", () => {
  const row = fullyPopulatedFoodRow();
  const vm = projectDirectoryListing({ row, media: null });

  it("preserves canonical identity bytes", () => {
    expect(vm.canonicalBusinessId).toBe(row.canonical_business_id);
    expect(vm.entityType).toBe(row.entity_type);
    expect(vm.lifecycleState).toBe(row.lifecycle_state);
    expect(vm.name).toBe(row.name_canonical);
  });

  it("classifies food as business", () => {
    expect(vm.classification).toBe("business");
  });

  it("preserves country / city / district / coordinates verbatim", () => {
    expect(vm.country).toBe("ID");
    expect(vm.city).toBe("Yogyakarta");
    expect(vm.district).toBe("Umbulharjo");
    expect(vm.coordinates).toEqual(COORDS_JOGJA_WARUNG);
  });

  it("coordinates are the exact numbers from the row (not re-rounded)", () => {
    expect(vm.coordinates?.lat).toBe(-7.797068);
    expect(vm.coordinates?.lng).toBe(110.370529);
  });

  it("preserves contact + external identity signals verbatim", () => {
    expect(vm.phoneE164).toBe("+628123456789");
    expect(vm.websiteApex).toBe("warungibusiti.id");
    expect(vm.osmId).toBe("node/987654321");
    expect(vm.wikidataQid).toBe("Q98765");
  });

  it("preserves aliases + categoryIds in input order", () => {
    expect(vm.aliases).toEqual(["Nasi Siti", "Warung Siti"]);
    expect(vm.categoryIds).toEqual(["restaurant", "indonesian-cuisine"]);
  });

  it("preserves verticalPayload by reference-equal passthrough", () => {
    expect(vm.verticalPayload).toBe(row.services_products);
  });

  it("primaryImage is null when no media attachment is provided", () => {
    expect(vm.primaryImage).toBe(null);
  });

  it("preserves lastVerifiedAt ISO string verbatim", () => {
    expect(vm.lastVerifiedAt).toBe("2026-10-07T10:30:00.000Z");
  });

  it("supersession graph passes through as nulls when not superseded", () => {
    expect(vm.supersedesBusinessId).toBe(null);
    expect(vm.supersededByBusinessId).toBe(null);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Missing-field permutations · no fabrication
// ═════════════════════════════════════════════════════════════════════

describe("projectDirectoryListing · missing-field permutations", () => {
  it("missing city stays null in the VM", () => {
    const row = { ...fullyPopulatedFoodRow(), city: null };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.city).toBe(null);
  });

  it("missing district stays null in the VM", () => {
    const row = { ...fullyPopulatedFoodRow(), district: null };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.district).toBe(null);
  });

  it("missing coordinates stays null (no city-centre or country-level fallback)", () => {
    const row = { ...fullyPopulatedFoodRow(), coordinates: null };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.coordinates).toBe(null);
  });

  it("missing phone_e164 stays null", () => {
    const row = { ...fullyPopulatedFoodRow(), phone_e164: null };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.phoneE164).toBe(null);
  });

  it("missing website_apex stays null", () => {
    const row = { ...fullyPopulatedFoodRow(), website_apex: null };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.websiteApex).toBe(null);
  });

  it("missing osm_id stays null", () => {
    const row = { ...fullyPopulatedFoodRow(), osm_id: null };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.osmId).toBe(null);
  });

  it("missing wikidata_qid stays null", () => {
    const row = { ...fullyPopulatedFoodRow(), wikidata_qid: null };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.wikidataQid).toBe(null);
  });

  it("empty aliases projects to an empty readonly array (not fabricated)", () => {
    const row = { ...fullyPopulatedFoodRow(), aliases: [] };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.aliases).toEqual([]);
  });

  it("empty categoryIds projects to an empty readonly array (not fabricated)", () => {
    const row = { ...fullyPopulatedFoodRow(), category_ids: [] };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.categoryIds).toEqual([]);
  });

  it("null services_products stays null in verticalPayload", () => {
    const row = { ...fullyPopulatedFoodRow(), services_products: null };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.verticalPayload).toBe(null);
  });

  it("null last_verified_at stays null", () => {
    const row = { ...fullyPopulatedFoodRow(), last_verified_at: null };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.lastVerifiedAt).toBe(null);
  });

  it("minimal row — every nullable column null — projects every nullable field to null", () => {
    const row = minimalRow("food");
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.city).toBe(null);
    expect(vm.district).toBe(null);
    expect(vm.coordinates).toBe(null);
    expect(vm.phoneE164).toBe(null);
    expect(vm.websiteApex).toBe(null);
    expect(vm.osmId).toBe(null);
    expect(vm.wikidataQid).toBe(null);
    expect(vm.aliases).toEqual([]);
    expect(vm.categoryIds).toEqual([]);
    expect(vm.verticalPayload).toBe(null);
    expect(vm.primaryImage).toBe(null);
    expect(vm.lastVerifiedAt).toBe(null);
    expect(vm.supersedesBusinessId).toBe(null);
    expect(vm.supersededByBusinessId).toBe(null);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Per-entity-type projection
// ═════════════════════════════════════════════════════════════════════

describe("projectDirectoryListing · classification by entity_type", () => {
  const BUSINESS: readonly EntityType[] = [
    "food",
    "accommodation",
    "service",
    "vehicle_rental",
    "marketplace_seller",
    "transport_operator",
  ];
  const PERSON: readonly EntityType[] = ["professional", "transport_driver"];
  const PLACE: readonly EntityType[] = ["place"];

  for (const et of BUSINESS) {
    it(`${et} → business`, () => {
      const row = minimalRow(et);
      const vm = projectDirectoryListing({ row, media: null });
      expect(vm.classification).toBe("business");
      expect(vm.entityType).toBe(et);
    });
  }

  for (const et of PERSON) {
    it(`${et} → person`, () => {
      const row = minimalRow(et);
      const vm = projectDirectoryListing({ row, media: null });
      expect(vm.classification).toBe("person");
      expect(vm.entityType).toBe(et);
    });
  }

  for (const et of PLACE) {
    it(`${et} → place`, () => {
      const row = minimalRow(et);
      const vm = projectDirectoryListing({ row, media: null });
      expect(vm.classification).toBe("place");
      expect(vm.entityType).toBe(et);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Media attachment semantics
// ═════════════════════════════════════════════════════════════════════

describe("projectDirectoryListing · media attachment", () => {
  const image: DirectoryImage = {
    url: "https://cdn.example/warung-siti.jpg",
    altText: "Front of Warung Nasi Ibu Siti",
    sourceId: "owner_upload",
  };

  it("passes primaryImage through verbatim when media is provided", () => {
    const row = fullyPopulatedFoodRow();
    const media: DirectoryListingMedia = { primaryImage: image };
    const vm = projectDirectoryListing({ row, media });
    expect(vm.primaryImage).toEqual(image);
    expect(vm.primaryImage?.url).toBe(image.url);
    expect(vm.primaryImage?.altText).toBe(image.altText);
    expect(vm.primaryImage?.sourceId).toBe(image.sourceId);
  });

  it("preserves a media attachment whose primaryImage is explicitly null", () => {
    const row = fullyPopulatedFoodRow();
    const media: DirectoryListingMedia = { primaryImage: null };
    const vm = projectDirectoryListing({ row, media });
    expect(vm.primaryImage).toBe(null);
  });

  it("preserves sourceId null (owner upload with implicit attribution)", () => {
    const img: DirectoryImage = {
      url: "https://cdn.example/x.jpg",
      altText: "x",
      sourceId: null,
    };
    const vm = projectDirectoryListing({
      row: fullyPopulatedFoodRow(),
      media: { primaryImage: img },
    });
    expect(vm.primaryImage?.sourceId).toBe(null);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Supersession graph
// ═════════════════════════════════════════════════════════════════════

describe("projectDirectoryListing · supersession graph", () => {
  it("preserves supersedes_business_id (this row merged in another)", () => {
    const other = "33333333-3333-4333-8333-333333333333";
    const row = {
      ...fullyPopulatedFoodRow(),
      supersedes_business_id: other,
    };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.supersedesBusinessId).toBe(other);
    expect(vm.supersededByBusinessId).toBe(null);
  });

  it("preserves superseded_by_business_id for SUPERSEDED rows (Phase C redirect target)", () => {
    const successor = "44444444-4444-4444-8444-444444444444";
    const row = {
      ...fullyPopulatedFoodRow(),
      lifecycle_state: "SUPERSEDED" as LifecycleState,
      superseded_by_business_id: successor,
    };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.lifecycleState).toBe("SUPERSEDED");
    expect(vm.supersededByBusinessId).toBe(successor);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Determinism · byte-stable output over repeated calls
// ═════════════════════════════════════════════════════════════════════

describe("projectDirectoryListing · determinism", () => {
  it("repeated calls with the same input produce byte-stable JSON output", () => {
    const row = fullyPopulatedFoodRow();
    const first = JSON.stringify(projectDirectoryListing({ row, media: null }));
    for (let i = 0; i < 10; i++) {
      expect(JSON.stringify(projectDirectoryListing({ row, media: null }))).toBe(
        first,
      );
    }
  });

  it("minimal-row projection is byte-stable across every entity_type", () => {
    const types: readonly EntityType[] = [
      "food",
      "accommodation",
      "service",
      "professional",
      "vehicle_rental",
      "marketplace_seller",
      "transport_driver",
      "transport_operator",
      "place",
    ];
    for (const et of types) {
      const row = minimalRow(et);
      const first = JSON.stringify(
        projectDirectoryListing({ row, media: null }),
      );
      for (let i = 0; i < 5; i++) {
        expect(JSON.stringify(projectDirectoryListing({ row, media: null }))).toBe(
          first,
        );
      }
    }
  });

  it("ordering of aliases + categoryIds is preserved exactly (never re-sorted)", () => {
    const row: DirectoryCanonicalRow = {
      ...fullyPopulatedFoodRow(),
      aliases: ["Zebra", "Alpha", "Mango"],
      category_ids: ["z-cat", "a-cat", "m-cat"],
    };
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.aliases).toEqual(["Zebra", "Alpha", "Mango"]);
    expect(vm.categoryIds).toEqual(["z-cat", "a-cat", "m-cat"]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · Readonly contract · projector does not mutate its input
// ═════════════════════════════════════════════════════════════════════

describe("projectDirectoryListing · input immutability", () => {
  it("does not mutate the input row object", () => {
    const row = fullyPopulatedFoodRow();
    const snapshot = JSON.stringify(row);
    projectDirectoryListing({ row, media: null });
    expect(JSON.stringify(row)).toBe(snapshot);
  });

  it("does not mutate the input media object", () => {
    const media: DirectoryListingMedia = {
      primaryImage: {
        url: "https://cdn.example/x.jpg",
        altText: "x",
        sourceId: null,
      },
    };
    const snapshot = JSON.stringify(media);
    projectDirectoryListing({ row: fullyPopulatedFoodRow(), media });
    expect(JSON.stringify(media)).toBe(snapshot);
  });

  it("does not mutate the input aliases array", () => {
    const row = fullyPopulatedFoodRow();
    const originalAliases = [...row.aliases];
    const vm = projectDirectoryListing({ row, media: null });
    expect([...row.aliases]).toEqual(originalAliases);
    // VM passes aliases through by reference — this is fine because
    // the VM contract is `readonly string[]`. We don't want to pay
    // the cost of a defensive copy on every projection.
    expect(vm.aliases).toBe(row.aliases);
  });

  it("does not mutate the input category_ids array", () => {
    const row = fullyPopulatedFoodRow();
    const originalCategoryIds = [...row.category_ids];
    const vm = projectDirectoryListing({ row, media: null });
    expect([...row.category_ids]).toEqual(originalCategoryIds);
    expect(vm.categoryIds).toBe(row.category_ids);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §9 · No DB mutation / no side effects
// ═════════════════════════════════════════════════════════════════════

describe("projectDirectoryListing · read-only guarantee", () => {
  it("is a pure function (no observable side effects over N invocations)", () => {
    const row = fullyPopulatedFoodRow();
    const results: unknown[] = [];
    for (let i = 0; i < 50; i++) {
      results.push(projectDirectoryListing({ row, media: null }));
    }
    const serialised = results.map((r) => JSON.stringify(r));
    for (const s of serialised) {
      expect(s).toBe(serialised[0]);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §10 · Batch projection
// ═════════════════════════════════════════════════════════════════════

describe("projectDirectoryListings · batch form", () => {
  it("preserves input order", () => {
    const a: DirectoryCanonicalRow = {
      ...minimalRow("food"),
      canonical_business_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name_canonical: "A",
    };
    const b: DirectoryCanonicalRow = {
      ...minimalRow("accommodation"),
      canonical_business_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name_canonical: "B",
    };
    const c: DirectoryCanonicalRow = {
      ...minimalRow("professional"),
      canonical_business_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name_canonical: "C",
    };
    const vms = projectDirectoryListings({ rows: [a, b, c] });
    expect(vms.map((v) => v.name)).toEqual(["A", "B", "C"]);
    expect(vms.map((v) => v.canonicalBusinessId)).toEqual([
      a.canonical_business_id,
      b.canonical_business_id,
      c.canonical_business_id,
    ]);
  });

  it("returns [] for an empty input", () => {
    expect(projectDirectoryListings({ rows: [] })).toEqual([]);
  });

  it("attaches media when a map is provided and the row's id is a key", () => {
    const row = fullyPopulatedFoodRow();
    const img: DirectoryImage = {
      url: "https://cdn.example/x.jpg",
      altText: "Warung",
      sourceId: "owner_upload",
    };
    const map = new Map<string, DirectoryListingMedia>([
      [row.canonical_business_id, { primaryImage: img }],
    ]);
    const [vm] = projectDirectoryListings({
      rows: [row],
      mediaByCanonicalId: map,
    });
    expect(vm.primaryImage).toEqual(img);
  });

  it("leaves primaryImage null when the row's id is not in the media map", () => {
    const row = fullyPopulatedFoodRow();
    const otherId = "99999999-9999-4999-8999-999999999999";
    const map = new Map<string, DirectoryListingMedia>([
      [
        otherId,
        {
          primaryImage: {
            url: "https://cdn.example/other.jpg",
            altText: "other",
            sourceId: null,
          },
        },
      ],
    ]);
    const [vm] = projectDirectoryListings({
      rows: [row],
      mediaByCanonicalId: map,
    });
    expect(vm.primaryImage).toBe(null);
  });

  it("without a media map, every VM has primaryImage=null", () => {
    const rows: DirectoryCanonicalRow[] = [
      minimalRow("food"),
      minimalRow("professional"),
      minimalRow("place"),
    ];
    const vms = projectDirectoryListings({ rows });
    for (const vm of vms) {
      expect(vm.primaryImage).toBe(null);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §11 · Phase C destination hints · preservation checks
// ═════════════════════════════════════════════════════════════════════

describe("projectDirectoryListing · Phase C destination hints preserved", () => {
  it("lifecycleState is preserved verbatim across all 7 states", () => {
    const states: readonly LifecycleState[] = [
      "DISCOVERED",
      "ENRICHED",
      "VERIFIED",
      "OWNER_CLAIMED",
      "OWNER_VERIFIED",
      "DORMANT",
      "SUPERSEDED",
    ];
    for (const s of states) {
      const row: DirectoryCanonicalRow = {
        ...fullyPopulatedFoodRow(),
        lifecycle_state: s,
      };
      const vm = projectDirectoryListing({ row, media: null });
      expect(vm.lifecycleState).toBe(s);
    }
  });

  it("osmId and wikidataQid are preserved for Phase C deep-link anchors", () => {
    const row = fullyPopulatedFoodRow();
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.osmId).toBe(row.osm_id);
    expect(vm.wikidataQid).toBe(row.wikidata_qid);
  });

  it("phoneE164 and websiteApex are preserved for owner-claim verification", () => {
    const row = fullyPopulatedFoodRow();
    const vm = projectDirectoryListing({ row, media: null });
    expect(vm.phoneE164).toBe(row.phone_e164);
    expect(vm.websiteApex).toBe(row.website_apex);
  });
});
