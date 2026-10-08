// scripts/nex-canonical/canonical-row.test.ts
//
// Pure unit tests for the canonical-row reflection and resolver-input
// projection.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  SEALED_LIFECYCLE_STATES,
  WRITABLE_LIFECYCLE_STATES,
  isLifecycleWritable,
  projectCanonicalRowForResolver,
  type CanonicalRow,
  type LifecycleState,
} from "./canonical-row";
import { SEALED_ENTITY_TYPES } from "./generate-candidates";

// ═════════════════════════════════════════════════════════════════════
// §0 · Fixture
// ═════════════════════════════════════════════════════════════════════

function row(overrides: Partial<CanonicalRow> = {}): CanonicalRow {
  const base: CanonicalRow = {
    canonical_business_id: "00000000-0000-0000-0000-000000000001",
    entity_type: "food",
    country: "ID",
    lifecycle_state: "DISCOVERED",
    name_canonical: "Warung Bu Siti",
    name_norm: "warung bu siti",
    aliases: [],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: null,
    district: null,
    coordinates: null,
    supersedes_business_id: null,
    superseded_by_business_id: null,
    last_verified_at: null,
  };
  return { ...base, ...overrides };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Lifecycle enum
// ═════════════════════════════════════════════════════════════════════

describe("SEALED_LIFECYCLE_STATES", () => {
  test("contains exactly 7 states matching migration 167", () => {
    expect(SEALED_LIFECYCLE_STATES.length).toBe(7);
    expect([...SEALED_LIFECYCLE_STATES]).toEqual([
      "DISCOVERED",
      "ENRICHED",
      "VERIFIED",
      "OWNER_CLAIMED",
      "OWNER_VERIFIED",
      "DORMANT",
      "SUPERSEDED",
    ]);
  });

  test("matches the DB check in migration 167 (via file inspection)", () => {
    const migPath = path.join(
      __dirname,
      "..",
      "..",
      "deploy",
      "postgres",
      "init",
      "167_nex_business_canonical.sql",
    );
    const sql = fs.readFileSync(migPath, "utf8");
    for (const s of SEALED_LIFECYCLE_STATES) {
      expect(sql).toContain(`'${s}'`);
    }
  });
});

describe("WRITABLE_LIFECYCLE_STATES", () => {
  test("contains exactly 5 states · the sealed minus DORMANT and SUPERSEDED", () => {
    expect(WRITABLE_LIFECYCLE_STATES.length).toBe(5);
    expect([...WRITABLE_LIFECYCLE_STATES]).toEqual([
      "DISCOVERED",
      "ENRICHED",
      "VERIFIED",
      "OWNER_CLAIMED",
      "OWNER_VERIFIED",
    ]);
  });
});

describe("isLifecycleWritable", () => {
  test.each<LifecycleState>([
    "DISCOVERED",
    "ENRICHED",
    "VERIFIED",
    "OWNER_CLAIMED",
    "OWNER_VERIFIED",
  ])("accepts %s", (state) => {
    expect(isLifecycleWritable(state)).toBe(true);
  });

  test.each<LifecycleState>(["DORMANT", "SUPERSEDED"])(
    "refuses %s",
    (state) => {
      expect(isLifecycleWritable(state)).toBe(false);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════
// §2 · projectCanonicalRowForResolver
// ═════════════════════════════════════════════════════════════════════

describe("projectCanonicalRowForResolver", () => {
  test("extracts identity signals that a resolver would consume", () => {
    const r = row({
      canonical_business_id: "a",
      entity_type: "accommodation",
      country: "ID",
      name_canonical: "Hotel X",
      name_norm: "hotel x",
      aliases: ["X Hotel"],
      phone_e164: "+6281234567890",
      website_apex: "hotelx.id",
      osm_id: "node/1",
      wikidata_qid: "Q1",
      city: "Jakarta",
      coordinates: { lat: -6.2, lng: 106.8 },
    });
    const p = projectCanonicalRowForResolver(r);
    expect(p.canonical_business_id).toBe("a");
    expect(p.entity_type).toBe("accommodation");
    expect(p.country).toBe("ID");
    expect(p.name_canonical).toBe("Hotel X");
    expect(p.name_norm).toBe("hotel x");
    expect(p.aliases).toEqual(["X Hotel"]);
    expect(p.phone_e164).toBe("+6281234567890");
    expect(p.website_apex).toBe("hotelx.id");
    expect(p.osm_id).toBe("node/1");
    expect(p.wikidata_qid).toBe("Q1");
    expect(p.city).toBe("Jakarta");
    expect(p.coordinates).toEqual({ lat: -6.2, lng: 106.8 });
  });

  test("drops fields a resolver should not see (district, supersession, last_verified_at, lifecycle_state)", () => {
    const r = row({
      district: "Senayan",
      supersedes_business_id: "s1",
      superseded_by_business_id: "s2",
      last_verified_at: "2026-10-08T00:00:00.000Z",
      lifecycle_state: "VERIFIED",
    });
    const p = projectCanonicalRowForResolver(r);
    expect("district" in p).toBe(false);
    expect("supersedes_business_id" in p).toBe(false);
    expect("superseded_by_business_id" in p).toBe(false);
    expect("last_verified_at" in p).toBe(false);
    expect("lifecycle_state" in p).toBe(false);
  });

  test("preserves nulls across all optional identity fields", () => {
    const p = projectCanonicalRowForResolver(row());
    expect(p.phone_e164).toBeNull();
    expect(p.website_apex).toBeNull();
    expect(p.osm_id).toBeNull();
    expect(p.wikidata_qid).toBeNull();
    expect(p.city).toBeNull();
    expect(p.coordinates).toBeNull();
  });

  test("is deterministic · same input → same output across calls", () => {
    const r = row({ canonical_business_id: "det", aliases: ["a", "b"] });
    expect(projectCanonicalRowForResolver(r)).toEqual(
      projectCanonicalRowForResolver(r),
    );
  });

  test("does not mutate the input row", () => {
    const r = row({ aliases: ["x"] });
    const before = JSON.stringify(r);
    projectCanonicalRowForResolver(r);
    expect(JSON.stringify(r)).toBe(before);
  });

  test("accepts every sealed entity_type", () => {
    for (const et of SEALED_ENTITY_TYPES) {
      const r = row({ entity_type: et });
      const p = projectCanonicalRowForResolver(r);
      expect(p.entity_type).toBe(et);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Pure-module grep invariants
// ═════════════════════════════════════════════════════════════════════

describe("canonical-row source · pure module", () => {
  const srcPath = path.join(__dirname, "canonical-row.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("CODE does NOT import pg or pg-executor or extract-candidates", () => {
    expect(code).not.toMatch(/from\s+["']pg["']/);
    expect(code).not.toMatch(/from\s+["']\.\/pg-executor["']/);
    expect(code).not.toMatch(/from\s+["']\.\/extract-candidates["']/);
  });

  test("CODE does NOT import or invoke entity-universe or identity-matching", () => {
    expect(code).not.toMatch(/identity-matching/);
    expect(code).not.toMatch(/entity-universe/);
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
  });

  test("CODE does NOT read fs / env / network / clock / randomness", () => {
    expect(code).not.toMatch(/\bfs\./);
    expect(code).not.toMatch(/\bnet\./);
    expect(code).not.toMatch(/\bhttp\./);
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/\bnew\s+Date\b/);
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\brandomUUID\b/);
    expect(code).not.toMatch(/\brandomBytes\b/);
  });

  test("CODE does not implement a resolver / match / score function", () => {
    expect(code).not.toMatch(/export\s+function\s+matchBusiness\b/);
    expect(code).not.toMatch(/export\s+function\s+resolve\w+/);
    expect(code).not.toMatch(/export\s+function\s+score\w+/);
  });

  test("CODE does not implement any DB write function", () => {
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\.query\s*\(/);
  });

  test("CODE's only local import is ./generate-candidates (type-only)", () => {
    const localImports = [
      ...code.matchAll(/from\s+["']\.\/([^"']+)["']/g),
    ].map((m) => m[1]);
    for (const imp of localImports) {
      expect(imp).toBe("generate-candidates");
    }
  });
});
